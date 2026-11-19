import type { Collection, Db } from "mongodb";
import { Boleto } from "../../../../domain/boleto.js";
import { Cliente } from "../../../../domain/cliente.js";
import { Dinero } from "../../../../domain/dinero.js";
import { EstadoOrden, type NombrePasarela } from "../../../../domain/estados.js";
import { Orden } from "../../../../domain/orden.js";
import type { BoletoRepository, ClienteRepository, OrdenRepository } from "../../../../application/ports/out/repositorios-documentales.js";

/* Documentos de MongoDB: modelo técnico propio del adaptador, distinto del dominio. */
interface ClienteDoc {
  _id: string;
  nombreCompleto: string;
  correo: string;
  telefonoMovil: string;
  nacionalidad: string;
}
interface OrdenDoc {
  _id: string;
  cliente: ClienteDoc;
  eventoId: string;
  asientos: { asientoId: string; codigoUbicacion: string; precioBase: number }[];
  liquidacion: {
    valorBase: number;
    tarifaServicio: number;
    descuento: number;
    montoTotal: number;
    porcentajeTarifa: number;
    porcentajeDescuento: number;
  };
  creadaEn: Date;
  expiraEn: Date;
  estado: EstadoOrden;
  pasarela?: NombrePasarela;
  referenciaPago?: string;
}
interface BoletoDoc {
  _id: string;
  ordenId: string;
  eventoId: string;
  asientoId: string;
  codigoUbicacion: string;
  codigoRedencion: string;
  firmaHash: string;
  fechaEmision: Date;
  representacionGrafica: string;
}

const aClienteDoc = (c: Cliente): ClienteDoc => ({ _id: c.id, nombreCompleto: c.nombreCompleto, correo: c.correo, telefonoMovil: c.telefonoMovil, nacionalidad: c.nacionalidad });
const aCliente = (d: ClienteDoc) => new Cliente(d._id, d.nombreCompleto, d.correo, d.telefonoMovil, d.nacionalidad);

export class ClienteRepositoryMongo implements ClienteRepository {
  private readonly col: Collection<ClienteDoc>;
  constructor(db: Db) { this.col = db.collection<ClienteDoc>("clientes"); }
  async inicializar() { await this.col.createIndex({ correo: 1 }, { unique: true }); }
  async buscarPorCorreo(correo: string) {
    const d = await this.col.findOne({ correo });
    return d ? aCliente(d) : null;
  }
  async guardar(cliente: Cliente) {
    await this.col.replaceOne({ _id: cliente.id }, aClienteDoc(cliente), { upsert: true });
  }
}

export class OrdenRepositoryMongo implements OrdenRepository {
  private readonly col: Collection<OrdenDoc>;
  constructor(db: Db) { this.col = db.collection<OrdenDoc>("ordenes"); }

  async inicializar() {
    await this.col.createIndex({ estado: 1, expiraEn: 1 });
    await this.col.createIndex({ pasarela: 1, referenciaPago: 1 });
    await this.col.createIndex({ "cliente._id": 1, eventoId: 1 });
  }

  private aDoc(o: Orden): OrdenDoc {
    const l = o.liquidacion;
    return {
      _id: o.id,
      cliente: aClienteDoc(o.cliente),
      eventoId: o.eventoId,
      asientos: o.asientos.map((a) => ({ asientoId: a.asientoId, codigoUbicacion: a.codigoUbicacion, precioBase: a.precioBase.monto })),
      liquidacion: {
        valorBase: l.valorBase.monto,
        tarifaServicio: l.tarifaServicio.monto,
        descuento: l.descuento.monto,
        montoTotal: l.montoTotal.monto,
        porcentajeTarifa: l.porcentajeTarifa,
        porcentajeDescuento: l.porcentajeDescuento,
      },
      creadaEn: o.creadaEn,
      expiraEn: o.expiraEn,
      estado: o.estado,
      ...(o.pasarela ? { pasarela: o.pasarela } : {}),
      ...(o.referenciaPago ? { referenciaPago: o.referenciaPago } : {}),
    };
  }

  private aDominio(d: OrdenDoc): Orden {
    return Orden.reconstituir({
      id: d._id,
      cliente: aCliente(d.cliente),
      eventoId: d.eventoId,
      asientos: d.asientos.map((a) => ({ asientoId: a.asientoId, codigoUbicacion: a.codigoUbicacion, precioBase: Dinero.cop(a.precioBase) })),
      liquidacion: {
        valorBase: Dinero.cop(d.liquidacion.valorBase),
        tarifaServicio: Dinero.cop(d.liquidacion.tarifaServicio),
        descuento: Dinero.cop(d.liquidacion.descuento),
        montoTotal: Dinero.cop(d.liquidacion.montoTotal),
        porcentajeTarifa: d.liquidacion.porcentajeTarifa,
        porcentajeDescuento: d.liquidacion.porcentajeDescuento,
      },
      creadaEn: d.creadaEn,
      expiraEn: d.expiraEn,
      estado: d.estado,
      pasarela: d.pasarela,
      referenciaPago: d.referenciaPago,
    });
  }

  async guardar(orden: Orden) {
    await this.col.replaceOne({ _id: orden.id }, this.aDoc(orden), { upsert: true });
  }
  async buscarPorId(id: string) {
    const d = await this.col.findOne({ _id: id });
    return d ? this.aDominio(d) : null;
  }
  async buscarPorReferenciaPago(pasarela: NombrePasarela, referencia: string) {
    const d = await this.col.findOne({ pasarela, referenciaPago: referencia });
    return d ? this.aDominio(d) : null;
  }
  async buscarPendientesVencidas(ahora: Date) {
    const docs = await this.col.find({ estado: EstadoOrden.PendientePago, expiraEn: { $lte: ahora } }).toArray();
    return docs.map((d) => this.aDominio(d));
  }
  async contarAsientosActivos(clienteId: string, eventoId: string) {
    const r = await this.col
      .aggregate<{ total: number }>([
        { $match: { "cliente._id": clienteId, eventoId, estado: { $in: [EstadoOrden.PendientePago, EstadoOrden.Aprobada] } } },
        { $group: { _id: null, total: { $sum: { $size: "$asientos" } } } },
      ])
      .toArray();
    return r[0]?.total ?? 0;
  }
}

export class BoletoRepositoryMongo implements BoletoRepository {
  private readonly col: Collection<BoletoDoc>;
  constructor(db: Db) { this.col = db.collection<BoletoDoc>("boletos"); }

  async inicializar() {
    await this.col.createIndex({ codigoRedencion: 1 }, { unique: true });
    await this.col.createIndex({ ordenId: 1 });
  }
  async guardarTodos(boletos: Boleto[]) {
    if (boletos.length === 0) return;
    await this.col.insertMany(
      boletos.map((b) => ({
        _id: b.id,
        ordenId: b.ordenId,
        eventoId: b.eventoId,
        asientoId: b.asientoId,
        codigoUbicacion: b.codigoUbicacion,
        codigoRedencion: b.codigoRedencion,
        firmaHash: b.firmaHash,
        fechaEmision: b.fechaEmision,
        representacionGrafica: b.representacionGrafica,
      })),
    );
  }
  private aDominio(d: BoletoDoc) {
    return new Boleto(d._id, d.ordenId, d.eventoId, d.asientoId, d.codigoUbicacion, d.codigoRedencion, d.firmaHash, d.fechaEmision, d.representacionGrafica);
  }
  async buscarPorOrden(ordenId: string) {
    return (await this.col.find({ ordenId }).toArray()).map((d) => this.aDominio(d));
  }
  async buscarPorCodigo(codigoRedencion: string) {
    const d = await this.col.findOne({ codigoRedencion });
    return d ? this.aDominio(d) : null;
  }
}

/** Crea los tres repositorios documentales sobre la misma base e inicializa índices. */
export async function repositoriosMongo(db: Db) {
  const ordenes = new OrdenRepositoryMongo(db);
  const boletos = new BoletoRepositoryMongo(db);
  const clientes = new ClienteRepositoryMongo(db);
  await Promise.all([ordenes.inicializar(), boletos.inicializar(), clientes.inicializar()]);
  return { ordenes, boletos, clientes };
}
