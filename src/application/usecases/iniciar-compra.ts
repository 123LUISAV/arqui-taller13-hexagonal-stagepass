import { CalculadoraTarifas } from "../../domain/calculadora-tarifas.js";
import { Cliente } from "../../domain/cliente.js";
import { AsientoNoDisponible } from "../../domain/errores.js";
import { EstadoAsiento } from "../../domain/estados.js";
import { LimiteBoletasPorEvento } from "../../domain/limite-boletas.js";
import { Orden } from "../../domain/orden.js";
import { PoliticaBloqueo } from "../../domain/politica-bloqueo.js";
import type { IniciarCompra, SolicitudInicioCompra } from "../ports/in/casos-de-uso.js";
import type { ClienteRepository, OrdenRepository } from "../ports/out/repositorios-documentales.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";
import type { Clock, GeneradorIds } from "../ports/out/utilidades.js";
import { resolverSeleccion } from "./seleccion-asientos.js";

/** Selección de asientos, bloqueo temporal y creación de la orden pendiente de pago. */
export class IniciarCompraService implements IniciarCompra {
  constructor(
    private readonly eventos: EventoRepository,
    private readonly asientosRepo: AsientoRepository,
    private readonly ordenes: OrdenRepository,
    private readonly clientes: ClienteRepository,
    private readonly calculadora: CalculadoraTarifas,
    private readonly politica: PoliticaBloqueo,
    private readonly limite: LimiteBoletasPorEvento,
    private readonly clock: Clock,
    private readonly ids: GeneradorIds,
  ) {}

  async ejecutar(s: SolicitudInicioCompra): Promise<Orden> {
    const ahora = this.clock.ahora();
    const { evento, asientos, valorBase } = await resolverSeleccion(this.eventos, this.asientosRepo, s.eventoId, s.asientoIds, ahora);

    const existente = await this.clientes.buscarPorCorreo(s.cliente.correo.trim().toLowerCase());
    const cliente = new Cliente(
      existente?.id ?? this.ids.nuevo("cli"),
      s.cliente.nombreCompleto.trim(),
      s.cliente.correo.trim().toLowerCase(),
      s.cliente.telefonoMovil.trim(),
      s.cliente.nacionalidad.trim(),
    );

    const acumuladas = await this.ordenes.contarAsientosActivos(cliente.id, evento.id);
    this.limite.verificar(acumuladas, asientos.length);
    const liquidacion = this.calculadora.calcular(valorBase, asientos.length);

    const idsAsientos = asientos.map((a) => a.id);
    const bloqueados = await this.asientosRepo.cambiarEstadoSiEs(idsAsientos, EstadoAsiento.Disponible, EstadoAsiento.Bloqueado);
    if (!bloqueados) throw new AsientoNoDisponible("otro comprador reservó alguno de los asientos primero");

    try {
      await this.clientes.guardar(cliente);
      const orden = Orden.crear({
        id: this.ids.nuevo("ord"),
        cliente,
        eventoId: evento.id,
        asientos: asientos.map((a) => ({ asientoId: a.id, codigoUbicacion: a.codigo.valor, precioBase: a.precioBase })),
        liquidacion,
        creadaEn: ahora,
        expiraEn: this.politica.calcularExpiracion(ahora),
      });
      await this.ordenes.guardar(orden);
      return orden;
    } catch (error) {
      await this.asientosRepo.cambiarEstadoSiEs(idsAsientos, EstadoAsiento.Bloqueado, EstadoAsiento.Disponible);
      throw error;
    }
  }
}
