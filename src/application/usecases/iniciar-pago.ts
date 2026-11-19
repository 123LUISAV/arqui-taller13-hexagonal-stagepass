import { ErrorNegocio, OrdenNoEncontrada } from "../../domain/errores.js";
import type { RegistroPago } from "../../domain/pagos.js";
import type { IniciarPago, SolicitudPago } from "../ports/in/casos-de-uso.js";
import type { OrdenRepository } from "../ports/out/repositorios-documentales.js";
import type { ResolutorPasarelas } from "../ports/out/servicios-externos.js";
import type { Clock } from "../ports/out/utilidades.js";

/** Registra el pago de una orden pendiente en la pasarela elegida por el cliente. */
export class IniciarPagoService implements IniciarPago {
  constructor(
    private readonly ordenes: OrdenRepository,
    private readonly pasarelas: ResolutorPasarelas,
    private readonly clock: Clock,
  ) {}

  async ejecutar(s: SolicitudPago): Promise<RegistroPago> {
    const orden = await this.ordenes.buscarPorId(s.ordenId);
    if (!orden) throw new OrdenNoEncontrada(s.ordenId);
    if (!orden.estaPendiente()) throw new ErrorNegocio("ORDEN_NO_PENDIENTE", `La orden está ${orden.estado}`);
    if (orden.haExpirado(this.clock.ahora())) throw new ErrorNegocio("ORDEN_EXPIRADA", "El tiempo de bloqueo de la orden terminó");

    const pasarela = this.pasarelas.obtener(s.pasarela);
    const registro = await pasarela.registrarPago(orden);
    orden.asignarPago(registro.pasarela, registro.referencia);
    await this.ordenes.guardar(orden);
    return registro;
  }
}
