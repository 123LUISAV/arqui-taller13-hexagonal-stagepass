import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Boleto } from "../../src/domain/boleto.js";
import { CalculadoraTarifas } from "../../src/domain/calculadora-tarifas.js";
import { Cliente } from "../../src/domain/cliente.js";
import { Dinero } from "../../src/domain/dinero.js";
import { EstadoOrden, NombrePasarela } from "../../src/domain/estados.js";
import { Orden } from "../../src/domain/orden.js";
import { iniciarMongoEnMemoria, type ConexionMongo } from "../../src/infrastructure/adapters/out/mongodb/conexion.js";
import { repositoriosMongo } from "../../src/infrastructure/adapters/out/mongodb/repositorios-mongo.js";

let conexion: ConexionMongo;
let repos: Awaited<ReturnType<typeof repositoriosMongo>>;

const cliente = new Cliente("c1", "Luisa Velandia", "l@x.co", "3001234567", "Colombiana");
const nuevaOrden = (id: string, expiraEn: Date, cantidad = 2, clienteOrden = cliente, eventoId = "e1") =>
  Orden.crear({
    id,
    cliente: clienteOrden,
    eventoId,
    asientos: Array.from({ length: cantidad }, (_, i) => ({ asientoId: `${id}-a${i}`, codigoUbicacion: `VIP-A${i + 1}`, precioBase: Dinero.cop(100_000) })),
    liquidacion: new CalculadoraTarifas().calcular(Dinero.cop(100_000 * cantidad), cantidad),
    creadaEn: new Date("2026-11-18T10:00:00Z"),
    expiraEn,
  });

beforeAll(async () => {
  conexion = await iniciarMongoEnMemoria("test_stagepass");
  repos = await repositoriosMongo(conexion.db);
});
afterAll(async () => {
  await conexion.cerrar();
});
beforeEach(async () => {
  await Promise.all(["ordenes", "boletos", "clientes"].map((c) => conexion.db.collection(c).deleteMany({})));
});

describe("OrdenRepositoryMongo (MongoDB real)", () => {
  it("guarda y recupera una orden con toda su liquidación", async () => {
    const o = nuevaOrden("o1", new Date("2026-11-18T10:10:00Z"), 3);
    await repos.ordenes.guardar(o);
    const leida = (await repos.ordenes.buscarPorId("o1"))!;
    expect(leida.estado).toBe(EstadoOrden.PendientePago);
    expect(leida.cantidad).toBe(3);
    expect(leida.montoTotal.monto).toBe(o.montoTotal.monto);
    expect(leida.tarifaServicio.monto).toBe(o.tarifaServicio.monto);
    expect(leida.descuentoAplicado.monto).toBe(o.descuentoAplicado.monto);
    expect(leida.cliente.correo).toBe("l@x.co");
    expect(leida.expiraEn.toISOString()).toBe("2026-11-18T10:10:00.000Z");
  });

  it("persiste cambios de estado y la referencia de pago", async () => {
    const o = nuevaOrden("o2", new Date("2026-11-18T10:10:00Z"));
    await repos.ordenes.guardar(o);
    o.asignarPago(NombrePasarela.Wompi, "WOMPI-1");
    o.aprobar();
    await repos.ordenes.guardar(o);
    const porRef = (await repos.ordenes.buscarPorReferenciaPago(NombrePasarela.Wompi, "WOMPI-1"))!;
    expect(porRef.id).toBe("o2");
    expect(porRef.estado).toBe(EstadoOrden.Aprobada);
    expect(await repos.ordenes.buscarPorReferenciaPago(NombrePasarela.PSE, "WOMPI-1")).toBeNull();
    expect(await repos.ordenes.buscarPorId("no-existe")).toBeNull();
  });

  it("encuentra solo las pendientes vencidas", async () => {
    await repos.ordenes.guardar(nuevaOrden("vencida", new Date("2026-11-18T10:10:00Z")));
    await repos.ordenes.guardar(nuevaOrden("vigente", new Date("2026-11-18T12:00:00Z")));
    const aprobada = nuevaOrden("aprobada", new Date("2026-11-18T10:10:00Z"));
    aprobada.aprobar();
    await repos.ordenes.guardar(aprobada);
    const r = await repos.ordenes.buscarPendientesVencidas(new Date("2026-11-18T11:00:00Z"));
    expect(r.map((o) => o.id)).toEqual(["vencida"]);
  });

  it("cuenta asientos activos (pendientes + aprobadas) por cliente y evento", async () => {
    const otro = new Cliente("c2", "Otro Cliente", "o@x.co", "3001234567", "Colombiana");
    await repos.ordenes.guardar(nuevaOrden("a", new Date("2027-01-01"), 2));
    const b = nuevaOrden("b", new Date("2027-01-01"), 3);
    b.aprobar();
    await repos.ordenes.guardar(b);
    const c = nuevaOrden("c", new Date("2027-01-01"), 4);
    c.rechazar();
    await repos.ordenes.guardar(c);
    await repos.ordenes.guardar(nuevaOrden("d", new Date("2027-01-01"), 5, otro));
    await repos.ordenes.guardar(nuevaOrden("e", new Date("2027-01-01"), 1, cliente, "e2"));
    expect(await repos.ordenes.contarAsientosActivos("c1", "e1")).toBe(5);
    expect(await repos.ordenes.contarAsientosActivos("c2", "e1")).toBe(5);
    expect(await repos.ordenes.contarAsientosActivos("nadie", "e1")).toBe(0);
  });
});

describe("BoletoRepositoryMongo y ClienteRepositoryMongo", () => {
  const boleto = (id: string, codigo: string) => new Boleto(id, "o1", "e1", "a1", "VIP-A1", codigo, "f".repeat(64), new Date("2026-11-18T10:05:00Z"), "data:image/svg+xml;base64,AAAA");

  it("guarda boletos y los recupera por orden y por código de redención", async () => {
    await repos.boletos.guardarTodos([boleto("b1", "AAAAAAAAAAAA"), boleto("b2", "BBBBBBBBBBBB")]);
    expect(await repos.boletos.buscarPorOrden("o1")).toHaveLength(2);
    const b = (await repos.boletos.buscarPorCodigo("BBBBBBBBBBBB"))!;
    expect(b.id).toBe("b2");
    expect(b.fechaEmision.toISOString()).toBe("2026-11-18T10:05:00.000Z");
    expect(await repos.boletos.buscarPorCodigo("ZZZZZZZZZZZZ")).toBeNull();
  });

  it("garantiza unicidad del código de redención con un índice único", async () => {
    await repos.boletos.guardarTodos([boleto("b1", "AAAAAAAAAAAA")]);
    await expect(repos.boletos.guardarTodos([boleto("b2", "AAAAAAAAAAAA")])).rejects.toThrow(/duplicate key/i);
  });

  it("guarda y busca clientes por correo (upsert)", async () => {
    await repos.clientes.guardar(cliente);
    await repos.clientes.guardar(new Cliente("c1", "Luisa F. Velandia", "l@x.co", "3001234567", "Colombiana"));
    const c = (await repos.clientes.buscarPorCorreo("l@x.co"))!;
    expect(c.id).toBe("c1");
    expect(c.nombreCompleto).toBe("Luisa F. Velandia");
    expect(await repos.clientes.buscarPorCorreo("x@y.z")).toBeNull();
  });
});
