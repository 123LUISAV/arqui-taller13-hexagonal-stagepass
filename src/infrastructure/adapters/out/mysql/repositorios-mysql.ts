import type { Pool, RowDataPacket } from "mysql2/promise";
import { Asiento } from "../../../../domain/asiento.js";
import { CodigoUbicacion } from "../../../../domain/codigo-ubicacion.js";
import { Dinero } from "../../../../domain/dinero.js";
import type { EstadoAsiento, EstadoEvento, TipoEvento } from "../../../../domain/estados.js";
import { Evento } from "../../../../domain/evento.js";
import { Recinto } from "../../../../domain/recinto.js";
import type { AsientoRepository, EventoRepository, RecintoRepository } from "../../../../application/ports/out/repositorios-legacy.js";

/**
 * Adaptadores hacia el MySQL legacy (esquema en docker/mysql/init.sql).
 * Traducen filas relacionales (snake_case) a los objetos puros del dominio.
 */
export class RecintoRepositoryMysql implements RecintoRepository {
  constructor(private readonly pool: Pool) {}
  private aDominio(r: RowDataPacket) { return new Recinto(r.id, r.nombre, r.ciudad, r.aforo); }

  async listar() {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT id, nombre, ciudad, aforo FROM recintos ORDER BY nombre");
    return rows.map((r) => this.aDominio(r));
  }
  async buscarPorId(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT id, nombre, ciudad, aforo FROM recintos WHERE id = ?", [id]);
    return rows[0] ? this.aDominio(rows[0]) : null;
  }
}

export class EventoRepositoryMysql implements EventoRepository {
  constructor(private readonly pool: Pool) {}
  private aDominio(r: RowDataPacket) {
    return new Evento(r.id, r.nombre, r.tipo as TipoEvento, r.recinto_id, new Date(r.fecha_hora), r.estado as EstadoEvento, r.clave_secreta);
  }
  async listar() {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM eventos ORDER BY fecha_hora");
    return rows.map((r) => this.aDominio(r));
  }
  async buscarPorId(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM eventos WHERE id = ?", [id]);
    return rows[0] ? this.aDominio(rows[0]) : null;
  }
  async guardar(evento: Evento) {
    await this.pool.query("UPDATE eventos SET estado = ? WHERE id = ?", [evento.estado, evento.id]);
  }
}

export class AsientoRepositoryMysql implements AsientoRepository {
  constructor(private readonly pool: Pool) {}
  private aDominio(r: RowDataPacket) {
    return new Asiento(r.id, r.recinto_id, CodigoUbicacion.de(r.codigo), Dinero.cop(r.precio_base), r.estado as EstadoAsiento);
  }
  async buscarPorRecinto(recintoId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM asientos WHERE recinto_id = ? ORDER BY id", [recintoId]);
    return rows.map((r) => this.aDominio(r));
  }
  async buscarPorIds(ids: string[]) {
    if (ids.length === 0) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM asientos WHERE id IN (?)", [ids]);
    return rows.map((r) => this.aDominio(r));
  }
  /** UPDATE condicional dentro de una transacción: si no se afectan todas las filas, se revierte. */
  async cambiarEstadoSiEs(ids: string[], desde: EstadoAsiento, hacia: EstadoAsiento) {
    if (ids.length === 0) return true;
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query<import("mysql2/promise").ResultSetHeader>(
        "UPDATE asientos SET estado = ? WHERE id IN (?) AND estado = ?",
        [hacia, ids, desde],
      );
      if (res.affectedRows !== ids.length) {
        await conn.rollback();
        return false;
      }
      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
  async contarPorEstado(recintoId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT estado, COUNT(*) AS n FROM asientos WHERE recinto_id = ? GROUP BY estado", [recintoId]);
    const conteo: Record<EstadoAsiento, number> = { DISPONIBLE: 0, BLOQUEADO: 0, VENDIDO: 0 };
    for (const r of rows) conteo[r.estado as EstadoAsiento] = Number(r.n);
    return conteo;
  }
}

export function repositoriosMysql(pool: Pool) {
  return { recintos: new RecintoRepositoryMysql(pool), eventos: new EventoRepositoryMysql(pool), asientos: new AsientoRepositoryMysql(pool) };
}
