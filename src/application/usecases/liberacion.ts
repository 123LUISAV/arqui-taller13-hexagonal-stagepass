import { EstadoAsiento } from "../../domain/estados.js";
import type { Orden } from "../../domain/orden.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";

/** Devuelve a Disponible los asientos bloqueados de una orden y reabre la venta si estaba agotado. */
export async function liberarAsientosDeOrden(
  orden: Orden,
  asientos: AsientoRepository,
  eventos: EventoRepository,
): Promise<void> {
  await asientos.cambiarEstadoSiEs(
    orden.asientos.map((a) => a.asientoId),
    EstadoAsiento.Bloqueado,
    EstadoAsiento.Disponible,
  );
  const evento = await eventos.buscarPorId(orden.eventoId);
  if (evento) {
    const antes = evento.estado;
    evento.reabrirVenta();
    if (evento.estado !== antes) await eventos.guardar(evento);
  }
}
