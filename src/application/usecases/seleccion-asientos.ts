import type { Asiento } from "../../domain/asiento.js";
import { Dinero } from "../../domain/dinero.js";
import { AsientoNoDisponible, DatosInvalidos, EventoNoEncontrado } from "../../domain/errores.js";
import type { Evento } from "../../domain/evento.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";

/** Validación compartida de una selección de asientos para un evento (sin efectos de escritura). */
export async function resolverSeleccion(
  eventos: EventoRepository,
  asientosRepo: AsientoRepository,
  eventoId: string,
  asientoIds: string[],
  ahora: Date,
): Promise<{ evento: Evento; asientos: Asiento[]; valorBase: Dinero }> {
  const evento = await eventos.buscarPorId(eventoId);
  if (!evento) throw new EventoNoEncontrado(eventoId);
  evento.exigirVentaAbierta(ahora);

  const ids = [...new Set(asientoIds)];
  if (ids.length === 0) throw new DatosInvalidos("Debe seleccionar al menos un asiento");
  const asientos = await asientosRepo.buscarPorIds(ids);
  if (asientos.length !== ids.length) throw new AsientoNoDisponible("alguno de los asientos no existe");
  for (const a of asientos) {
    if (a.recintoId !== evento.recintoId) throw new AsientoNoDisponible(`${a.codigo} no pertenece al recinto del evento`);
    if (!a.estaDisponible()) throw new AsientoNoDisponible(`${a.codigo} está ${a.estado}`);
  }
  const valorBase = asientos.reduce((acc, a) => acc.sumar(a.precioBase), Dinero.cero());
  return { evento, asientos, valorBase };
}
