import { Boleto } from "../../domain/boleto.js";
import { EstadoAsiento } from "../../domain/estados.js";
import { EventoNoEncontrado } from "../../domain/errores.js";
import type { Orden } from "../../domain/orden.js";
import { ResultadoPago, type NotificacionPago } from "../../domain/pagos.js";
import type { ConfirmarPago, SolicitudConfirmacion } from "../ports/in/casos-de-uso.js";
import type { BoletoRepository, OrdenRepository } from "../ports/out/repositorios-documentales.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";
import type {
  FacturacionElectronicaPort,
  GeneradorBoletoPort,
  NotificacionPort,
  ResolutorPasarelas,
} from "../ports/out/servicios-externos.js";
import type { Clock, GeneradorIds, Logger } from "../ports/out/utilidades.js";
import { liberarAsientosDeOrden } from "./liberacion.js";

/**
 * Procesa la notificación asíncrona de una pasarela. Los boletos solo se emiten si el pago
 * fue exitoso Y verificado (consulta directa a la pasarela + monto igual al de la orden).
 */
export class ConfirmarPagoService implements ConfirmarPago {
  constructor(
    private readonly pasarelas: ResolutorPasarelas,
    private readonly ordenes: OrdenRepository,
    private readonly boletos: BoletoRepository,
    private readonly asientos: AsientoRepository,
    private readonly eventos: EventoRepository,
    private readonly generador: GeneradorBoletoPort,
    private readonly notificadores: NotificacionPort[],
    private readonly facturacion: FacturacionElectronicaPort,
    private readonly clock: Clock,
    private readonly ids: GeneradorIds,
    private readonly log: Logger,
  ) {}

  async ejecutar(s: SolicitudConfirmacion): Promise<Orden | null> {
    const pasarela = this.pasarelas.obtener(s.pasarela);
    const aviso = pasarela.interpretarNotificacion(s.cuerpo);
    const orden = await this.ordenes.buscarPorReferenciaPago(aviso.pasarela, aviso.referencia);
    if (!orden) {
      this.log.warn(`Notificación de ${aviso.pasarela} con referencia desconocida: ${aviso.referencia}`);
      return null;
    }
    // Idempotencia: las pasarelas reintentan notificaciones.
    if (!orden.estaPendiente()) return orden;

    if (orden.haExpirado(this.clock.ahora())) {
      orden.expirar();
      await this.ordenes.guardar(orden);
      await liberarAsientosDeOrden(orden, this.asientos, this.eventos);
      this.log.warn(`Pago ${aviso.referencia} llegó después de expirar la orden ${orden.id}`);
      return orden;
    }
    if (aviso.resultado === ResultadoPago.Pendiente) return orden;
    if (aviso.resultado === ResultadoPago.Rechazado) return this.rechazar(orden);

    const verificado = await pasarela.verificarTransaccion(aviso.referencia);
    if (!this.pagoValido(orden, aviso, verificado)) {
      this.log.warn(`Pago ${aviso.referencia} no verificado para la orden ${orden.id}`);
      return this.rechazar(orden);
    }
    return this.aprobar(orden);
  }

  private pagoValido(orden: Orden, aviso: NotificacionPago, verificado: NotificacionPago): boolean {
    return (
      verificado.resultado === ResultadoPago.Aprobado &&
      verificado.montoPagado.igual(orden.montoTotal) &&
      aviso.montoPagado.igual(orden.montoTotal)
    );
  }

  private async rechazar(orden: Orden): Promise<Orden> {
    orden.rechazar();
    await this.ordenes.guardar(orden);
    await liberarAsientosDeOrden(orden, this.asientos, this.eventos);
    return orden;
  }

  private async aprobar(orden: Orden): Promise<Orden> {
    const evento = await this.eventos.buscarPorId(orden.eventoId);
    if (!evento) throw new EventoNoEncontrado(orden.eventoId);
    const ahora = this.clock.ahora();

    const boletos: Boleto[] = [];
    for (const item of orden.asientos) {
      const id = this.ids.nuevo("bol");
      const material = await this.generador.generar({ boletoId: id, orden, asientoId: item.asientoId, evento });
      boletos.push(
        new Boleto(id, orden.id, evento.id, item.asientoId, item.codigoUbicacion, material.codigoRedencion, material.firmaHash, ahora, material.representacionGrafica),
      );
    }

    await this.asientos.cambiarEstadoSiEs(
      orden.asientos.map((a) => a.asientoId),
      EstadoAsiento.Bloqueado,
      EstadoAsiento.Vendido,
    );
    orden.aprobar();
    await this.boletos.guardarTodos(boletos);
    await this.ordenes.guardar(orden);

    const conteo = await this.asientos.contarPorEstado(evento.recintoId);
    if (conteo[EstadoAsiento.Disponible] + conteo[EstadoAsiento.Bloqueado] === 0) {
      evento.marcarAgotado();
      await this.eventos.guardar(evento);
    }
    await this.efectosSecundarios(orden, evento.nombre, boletos);
    return orden;
  }

  /** Notificaciones y facturación: un fallo aquí no revierte la venta ya confirmada. */
  private async efectosSecundarios(orden: Orden, nombreEvento: string, boletos: Boleto[]): Promise<void> {
    const codigos = boletos.map((b) => `${b.codigoUbicacion}: ${b.codigoRedencion}`).join(", ");
    for (const n of this.notificadores) {
      try {
        await n.enviar({
          destinatario: orden.cliente,
          asunto: `Tus boletos para ${nombreEvento}`,
          cuerpo: `Hola ${orden.cliente.nombreCompleto}, tu compra fue aprobada. Códigos de redención -> ${codigos}`,
        });
      } catch (e) {
        this.log.warn(`Falló la notificación ${n.canal}: ${(e as Error).message}`);
      }
    }
    try {
      const factura = await this.facturacion.emitir(orden);
      this.log.info(`Factura electrónica ${factura.numero} emitida para la orden ${orden.id}`);
    } catch (e) {
      this.log.warn(`Falló la facturación electrónica: ${(e as Error).message}`);
    }
  }
}
