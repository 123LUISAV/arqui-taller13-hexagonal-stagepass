import type { Asiento } from "../../../domain/asiento.js";
import type { Evento } from "../../../domain/evento.js";
import type { Recinto } from "../../../domain/recinto.js";
import type { EstadoAsiento } from "../../../domain/estados.js";

/** Puertos de salida hacia el sistema relacional legacy (recintos, aforos, asientos). */
export interface RecintoRepository {
  listar(): Promise<Recinto[]>;
  buscarPorId(id: string): Promise<Recinto | null>;
}

export interface EventoRepository {
  listar(): Promise<Evento[]>;
  buscarPorId(id: string): Promise<Evento | null>;
  guardar(evento: Evento): Promise<void>;
}

export interface AsientoRepository {
  buscarPorRecinto(recintoId: string): Promise<Asiento[]>;
  buscarPorIds(ids: string[]): Promise<Asiento[]>;
  /**
   * Cambio de estado atómico "todo o nada": solo se aplica si TODOS los asientos
   * están en el estado `desde`. Devuelve false si alguno ya cambió (condición de carrera).
   */
  cambiarEstadoSiEs(ids: string[], desde: EstadoAsiento, hacia: EstadoAsiento): Promise<boolean>;
  contarPorEstado(recintoId: string): Promise<Record<EstadoAsiento, number>>;
}
