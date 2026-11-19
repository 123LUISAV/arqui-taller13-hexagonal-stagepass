import type { Asiento } from "../../domain/asiento.js";
import { EventoNoEncontrado } from "../../domain/errores.js";
import { EstadoAsiento } from "../../domain/estados.js";
import type { ConsultarEventos, VistaEvento } from "../ports/in/casos-de-uso.js";
import type { AsientoRepository, EventoRepository, RecintoRepository } from "../ports/out/repositorios-legacy.js";

export class ConsultarEventosService implements ConsultarEventos {
  constructor(
    private readonly eventos: EventoRepository,
    private readonly recintos: RecintoRepository,
    private readonly asientosRepo: AsientoRepository,
  ) {}

  async listar(): Promise<VistaEvento[]> {
    const todos = await this.eventos.listar();
    return Promise.all(todos.map((e) => this.obtener(e.id)));
  }

  async obtener(eventoId: string): Promise<VistaEvento> {
    const evento = await this.eventos.buscarPorId(eventoId);
    if (!evento) throw new EventoNoEncontrado(eventoId);
    const recinto = await this.recintos.buscarPorId(evento.recintoId);
    if (!recinto) throw new EventoNoEncontrado(`${eventoId} (recinto ${evento.recintoId} inexistente)`);
    const conteo = await this.asientosRepo.contarPorEstado(evento.recintoId);
    return { evento, recinto, asientosDisponibles: conteo[EstadoAsiento.Disponible] };
  }

  async asientos(eventoId: string): Promise<Asiento[]> {
    const evento = await this.eventos.buscarPorId(eventoId);
    if (!evento) throw new EventoNoEncontrado(eventoId);
    return this.asientosRepo.buscarPorRecinto(evento.recintoId);
  }
}
