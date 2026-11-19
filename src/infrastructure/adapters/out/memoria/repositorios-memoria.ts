import { Asiento } from "../../../../domain/asiento.js";
import type { Boleto } from "../../../../domain/boleto.js";
import type { Cliente } from "../../../../domain/cliente.js";
import { EstadoAsiento, EstadoOrden, type NombrePasarela } from "../../../../domain/estados.js";
import type { Evento } from "../../../../domain/evento.js";
import type { Orden } from "../../../../domain/orden.js";
import type { Recinto } from "../../../../domain/recinto.js";
import type { BoletoRepository, ClienteRepository, OrdenRepository } from "../../../../application/ports/out/repositorios-documentales.js";
import type { AsientoRepository, EventoRepository, RecintoRepository } from "../../../../application/ports/out/repositorios-legacy.js";
import type { Semilla } from "./datos-semilla.js";

/** Sustituto en memoria del sistema relacional legacy (modo por defecto sin MySQL). */
export class RecintoRepositoryMemoria implements RecintoRepository {
  constructor(private readonly datos: Recinto[]) {}
  async listar() { return [...this.datos]; }
  async buscarPorId(id: string) { return this.datos.find((r) => r.id === id) ?? null; }
}

export class EventoRepositoryMemoria implements EventoRepository {
  private readonly datos = new Map<string, Evento>();
  constructor(eventos: Evento[]) { eventos.forEach((e) => this.datos.set(e.id, e)); }
  async listar() { return [...this.datos.values()]; }
  async buscarPorId(id: string) { return this.datos.get(id) ?? null; }
  async guardar(evento: Evento) { this.datos.set(evento.id, evento); }
}

export class AsientoRepositoryMemoria implements AsientoRepository {
  private readonly datos = new Map<string, Asiento>();
  constructor(asientos: Asiento[]) { asientos.forEach((a) => this.datos.set(a.id, a)); }

  private copia(a: Asiento): Asiento {
    return new Asiento(a.id, a.recintoId, a.codigo, a.precioBase, a.estado);
  }
  async buscarPorRecinto(recintoId: string) {
    return [...this.datos.values()].filter((a) => a.recintoId === recintoId).map((a) => this.copia(a));
  }
  async buscarPorIds(ids: string[]) {
    return ids.flatMap((id) => (this.datos.has(id) ? [this.copia(this.datos.get(id)!)] : []));
  }
  async cambiarEstadoSiEs(ids: string[], desde: EstadoAsiento, hacia: EstadoAsiento) {
    const objetivo = ids.map((id) => this.datos.get(id));
    if (objetivo.some((a) => !a || a.estado !== desde)) return false;
    for (const a of objetivo as Asiento[]) {
      this.datos.set(a.id, new Asiento(a.id, a.recintoId, a.codigo, a.precioBase, hacia));
    }
    return true;
  }
  async contarPorEstado(recintoId: string) {
    const conteo: Record<EstadoAsiento, number> = { DISPONIBLE: 0, BLOQUEADO: 0, VENDIDO: 0 };
    for (const a of this.datos.values()) if (a.recintoId === recintoId) conteo[a.estado]++;
    return conteo;
  }
}

export function repositoriosLegacyMemoria(s: Semilla) {
  return {
    recintos: new RecintoRepositoryMemoria(s.recintos),
    eventos: new EventoRepositoryMemoria(s.eventos),
    asientos: new AsientoRepositoryMemoria(s.asientos),
  };
}

/** Equivalentes en memoria de los repositorios documentales (útiles como fakes y para correr sin Mongo). */
export class OrdenRepositoryMemoria implements OrdenRepository {
  private readonly datos = new Map<string, Orden>();
  async guardar(orden: Orden) { this.datos.set(orden.id, orden); }
  async buscarPorId(id: string) { return this.datos.get(id) ?? null; }
  async buscarPorReferenciaPago(pasarela: NombrePasarela, referencia: string) {
    return [...this.datos.values()].find((o) => o.pasarela === pasarela && o.referenciaPago === referencia) ?? null;
  }
  async buscarPendientesVencidas(ahora: Date) {
    return [...this.datos.values()].filter((o) => o.estaPendiente() && o.haExpirado(ahora));
  }
  async contarAsientosActivos(clienteId: string, eventoId: string) {
    return [...this.datos.values()]
      .filter((o) => o.cliente.id === clienteId && o.eventoId === eventoId)
      .filter((o) => o.estado === EstadoOrden.PendientePago || o.estado === EstadoOrden.Aprobada)
      .reduce((acc, o) => acc + o.cantidad, 0);
  }
}

export class BoletoRepositoryMemoria implements BoletoRepository {
  private readonly datos = new Map<string, Boleto>();
  async guardarTodos(boletos: Boleto[]) { boletos.forEach((b) => this.datos.set(b.id, b)); }
  async buscarPorOrden(ordenId: string) { return [...this.datos.values()].filter((b) => b.ordenId === ordenId); }
  async buscarPorCodigo(codigo: string) { return [...this.datos.values()].find((b) => b.codigoRedencion === codigo) ?? null; }
}

export class ClienteRepositoryMemoria implements ClienteRepository {
  private readonly datos = new Map<string, Cliente>();
  async buscarPorCorreo(correo: string) { return [...this.datos.values()].find((c) => c.correo === correo) ?? null; }
  async guardar(cliente: Cliente) { this.datos.set(cliente.id, cliente); }
}
