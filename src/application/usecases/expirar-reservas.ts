import type { ExpirarReservas } from "../ports/in/casos-de-uso.js";
import type { OrdenRepository } from "../ports/out/repositorios-documentales.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";
import type { Clock, Logger } from "../ports/out/utilidades.js";
import { liberarAsientosDeOrden } from "./liberacion.js";

/** Libera automáticamente los asientos de las órdenes cuyo bloqueo venció sin pago confirmado. */
export class ExpirarReservasService implements ExpirarReservas {
  constructor(
    private readonly ordenes: OrdenRepository,
    private readonly asientos: AsientoRepository,
    private readonly eventos: EventoRepository,
    private readonly clock: Clock,
    private readonly log: Logger,
  ) {}

  async ejecutar(): Promise<number> {
    const vencidas = await this.ordenes.buscarPendientesVencidas(this.clock.ahora());
    for (const orden of vencidas) {
      orden.expirar();
      await this.ordenes.guardar(orden);
      await liberarAsientosDeOrden(orden, this.asientos, this.eventos);
      this.log.info(`Orden ${orden.id} expirada; ${orden.cantidad} asiento(s) liberado(s)`);
    }
    return vencidas.length;
  }
}
