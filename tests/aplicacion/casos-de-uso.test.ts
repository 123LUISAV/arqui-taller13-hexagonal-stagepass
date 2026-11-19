import { describe, expect, it } from "vitest";
import {
  AsientoNoDisponible,
  EventoNoDisponible,
  LimiteBoletasExcedido,
  PasarelaNoSoportada,
} from "../../src/domain/errores.js";
import { EstadoAsiento, EstadoEvento, EstadoOrden } from "../../src/domain/estados.js";
import { ResultadoPago } from "../../src/domain/pagos.js";
import { armarSistema, clienteDatos, ids } from "../soporte.js";

const TEATRO = "rec-teatro";
const compra = (s: ReturnType<typeof armarSistema>, codigos: string[], correo?: string, evento = "evt-hamlet") =>
  s.iniciarCompra.ejecutar({ eventoId: evento, asientoIds: ids(TEATRO, ...codigos), cliente: clienteDatos(correo) });

async function pagar(s: ReturnType<typeof armarSistema>, ordenId: string, pasarela: "wompi" | "paypal" | "pse", resultado: ResultadoPago) {
  const registro = await s.iniciarPago.ejecutar({ ordenId, pasarela });
  const cuerpo = s[pasarela].simularNotificacion(registro.referencia, resultado);
  return s.confirmarPago.ejecutar({ pasarela, cuerpo });
}

describe("IniciarCompra: selección y bloqueo temporal", () => {
  it("bloquea los asientos, liquida con el núcleo y fija la expiración a 10 minutos", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1", "VIP-A2", "General-01"]);
    expect(orden.estado).toBe(EstadoOrden.PendientePago);
    expect(orden.montoTotal.monto).toBe(551_050); // 535.000 + 8 % - 5 %
    expect(orden.expiraEn.getTime() - orden.creadaEn.getTime()).toBe(10 * 60_000);
    const estados = (await s.asientos.buscarPorIds(ids(TEATRO, "VIP-A1", "VIP-A2", "General-01"))).map((a) => a.estado);
    expect(estados).toEqual([EstadoAsiento.Bloqueado, EstadoAsiento.Bloqueado, EstadoAsiento.Bloqueado]);
  });

  it("un asiento bloqueado no se le puede vender a otro cliente", async () => {
    const s = armarSistema();
    await compra(s, ["VIP-A1"]);
    await expect(compra(s, ["VIP-A1"], "otro@example.com")).rejects.toThrow(AsientoNoDisponible);
  });

  it("la reserva de dos compradores simultáneos sobre el mismo asiento solo deja pasar a uno", async () => {
    const s = armarSistema();
    const r = await Promise.allSettled([compra(s, ["VIP-A3"], "a@x.co"), compra(s, ["VIP-A3"], "b@x.co")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("rechaza asientos de otro recinto", async () => {
    const s = armarSistema();
    await expect(
      s.iniciarCompra.ejecutar({ eventoId: "evt-hamlet", asientoIds: ["rec-arena:VIP-A1"], cliente: clienteDatos() }),
    ).rejects.toThrow(AsientoNoDisponible);
  });

  it("no permite comprar en un evento cancelado o ya ocurrido", async () => {
    const s = armarSistema();
    const evento = (await s.eventos.buscarPorId("evt-hamlet"))!;
    evento.cancelar();
    await s.eventos.guardar(evento);
    await expect(compra(s, ["VIP-A1"])).rejects.toThrow(EventoNoDisponible);
  });
});

describe("Límite de 6 boletas por cliente y evento", () => {
  it("permite 6 y rechaza el séptimo", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1", "VIP-A2", "VIP-A3", "VIP-A4", "VIP-A5", "VIP-A6"]);
    expect(orden.liquidacion.porcentajeDescuento).toBe(10); // tramo corporativo
    await expect(compra(s, ["General-01"])).rejects.toThrow(LimiteBoletasExcedido);
  });

  it("acumula entre órdenes (4 + 3 supera el límite)", async () => {
    const s = armarSistema();
    await compra(s, ["VIP-A1", "VIP-A2", "VIP-A3", "VIP-A4"]);
    await expect(compra(s, ["General-01", "General-02", "General-03"])).rejects.toThrow(LimiteBoletasExcedido);
    await expect(compra(s, ["General-01", "General-02"])).resolves.toBeDefined(); // 4 + 2 = 6
  });

  it("el límite es por cliente: otro cliente sí puede comprar", async () => {
    const s = armarSistema();
    await compra(s, ["VIP-A1", "VIP-A2", "VIP-A3", "VIP-A4", "VIP-A5", "VIP-A6"]);
    await expect(compra(s, ["General-01"], "otra@example.com")).resolves.toBeDefined();
  });
});

describe("Expiración automática del bloqueo", () => {
  it("libera los asientos solo cuando se cumplen los 10 minutos", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1", "VIP-A2"]);
    s.reloj.avanzarMinutos(9.9);
    expect(await s.expirar.ejecutar()).toBe(0);
    s.reloj.avanzarMinutos(0.1);
    expect(await s.expirar.ejecutar()).toBe(1);
    const { orden: o } = await s.consultarOrden.ejecutar(orden.id);
    expect(o.estado).toBe(EstadoOrden.Expirada);
    const a = await s.asientos.buscarPorIds(ids(TEATRO, "VIP-A1", "VIP-A2"));
    expect(a.every((x) => x.estaDisponible())).toBe(true);
    await expect(compra(s, ["VIP-A1"], "otro@example.com")).resolves.toBeDefined();
  });

  it("no toca las órdenes ya aprobadas", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    await pagar(s, orden.id, "wompi", ResultadoPago.Aprobado);
    s.reloj.avanzarMinutos(60);
    expect(await s.expirar.ejecutar()).toBe(0);
    expect((await s.asientos.buscarPorIds(ids(TEATRO, "VIP-A1")))[0]?.estado).toBe(EstadoAsiento.Vendido);
  });

  it("no permite iniciar el pago de una orden vencida", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    s.reloj.avanzarMinutos(11);
    await expect(s.iniciarPago.ejecutar({ ordenId: orden.id, pasarela: "pse" })).rejects.toThrow(/expir|bloqueo/i);
  });
});

describe("ConfirmarPago: emisión de boletos", () => {
  it.each(["wompi", "paypal", "pse"] as const)("pago aprobado por %s emite un boleto por asiento", async (pasarela) => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1", "General-01"]);
    const resultado = await pagar(s, orden.id, pasarela, ResultadoPago.Aprobado);
    expect(resultado?.estado).toBe(EstadoOrden.Aprobada);
    const { boletos } = await s.consultarOrden.ejecutar(orden.id);
    expect(boletos).toHaveLength(2);
    expect(new Set(boletos.map((b) => b.codigoRedencion)).size).toBe(2);
    expect((await s.asientos.buscarPorIds(ids(TEATRO, "VIP-A1", "General-01"))).every((a) => a.estado === EstadoAsiento.Vendido)).toBe(true);
    expect(s.whatsapp.enviados).toHaveLength(1);
    expect(s.correo.enviados).toHaveLength(1);
  });

  it("pago rechazado libera los asientos y no emite boletos", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    const r = await pagar(s, orden.id, "pse", ResultadoPago.Rechazado);
    expect(r?.estado).toBe(EstadoOrden.Rechazada);
    expect((await s.consultarOrden.ejecutar(orden.id)).boletos).toHaveLength(0);
    expect((await s.asientos.buscarPorIds(ids(TEATRO, "VIP-A1")))[0]?.estaDisponible()).toBe(true);
  });

  it("una notificación de aprobado que la pasarela no confirma NO emite boletos (verificación)", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    const registro = await s.iniciarPago.ejecutar({ ordenId: orden.id, pasarela: "wompi" });
    // webhook falsificado: dice APPROVED pero la transacción en la pasarela sigue PENDING
    const falso = { event: "transaction.updated", data: { transaction: { id: registro.referencia, status: "APPROVED", amount_in_cents: orden.montoTotal.monto * 100 } } };
    const r = await s.confirmarPago.ejecutar({ pasarela: "wompi", cuerpo: falso });
    expect(r?.estado).toBe(EstadoOrden.Rechazada);
    expect((await s.consultarOrden.ejecutar(orden.id)).boletos).toHaveLength(0);
  });

  it("un monto distinto al de la orden no se acepta", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    const registro = await s.iniciarPago.ejecutar({ ordenId: orden.id, pasarela: "wompi" });
    s.wompi.simularNotificacion(registro.referencia, ResultadoPago.Aprobado);
    const adulterado = { event: "transaction.updated", data: { transaction: { id: registro.referencia, status: "APPROVED", amount_in_cents: 100 } } };
    const r = await s.confirmarPago.ejecutar({ pasarela: "wompi", cuerpo: adulterado });
    expect(r?.estado).toBe(EstadoOrden.Rechazada);
  });

  it("es idempotente: reintentos del webhook no duplican boletos", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1", "VIP-A2"]);
    const registro = await s.iniciarPago.ejecutar({ ordenId: orden.id, pasarela: "paypal" });
    const cuerpo = s.paypal.simularNotificacion(registro.referencia, ResultadoPago.Aprobado);
    await s.confirmarPago.ejecutar({ pasarela: "paypal", cuerpo });
    await s.confirmarPago.ejecutar({ pasarela: "paypal", cuerpo });
    expect((await s.consultarOrden.ejecutar(orden.id)).boletos).toHaveLength(2);
    expect(s.correo.enviados).toHaveLength(1);
  });

  it("un pago que llega después de expirar no emite boletos", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    const registro = await s.iniciarPago.ejecutar({ ordenId: orden.id, pasarela: "wompi" });
    const cuerpo = s.wompi.simularNotificacion(registro.referencia, ResultadoPago.Aprobado);
    s.reloj.avanzarMinutos(10);
    const r = await s.confirmarPago.ejecutar({ pasarela: "wompi", cuerpo });
    expect(r?.estado).toBe(EstadoOrden.Expirada);
    expect((await s.consultarOrden.ejecutar(orden.id)).boletos).toHaveLength(0);
  });

  it("ignora (null) referencias desconocidas y rechaza pasarelas no soportadas", async () => {
    const s = armarSistema();
    const cuerpo = s.wompi.simularNotificacion((await s.iniciarPago.ejecutar({ ordenId: (await compra(s, ["VIP-A1"])).id, pasarela: "wompi" })).referencia, ResultadoPago.Pendiente);
    const desconocida = JSON.parse(JSON.stringify(cuerpo).replace(/WOMPI-[A-Z0-9]+/, "WOMPI-NOEXISTE"));
    expect(await s.confirmarPago.ejecutar({ pasarela: "wompi", cuerpo: desconocida })).toBeNull();
    await expect(s.confirmarPago.ejecutar({ pasarela: "bitcoin", cuerpo })).rejects.toThrow(PasarelaNoSoportada);
  });

  it("marca el evento como Agotado al vender el último asiento", async () => {
    const s = armarSistema();
    const todos = await s.asientos.buscarPorRecinto(TEATRO);
    const codigos = todos.map((a) => a.codigo.valor);
    for (let i = 0; i < codigos.length; i += 6) {
      const orden = await compra(s, codigos.slice(i, i + 6), `cliente${i}@example.com`);
      await pagar(s, orden.id, "wompi", ResultadoPago.Aprobado);
    }
    expect((await s.eventos.buscarPorId("evt-hamlet"))?.estado).toBe(EstadoEvento.Agotado);
    await expect(compra(s, ["VIP-A1"], "tarde@example.com")).rejects.toThrow(EventoNoDisponible);
  });
});

describe("Consultas y verificación de boletos", () => {
  it("lista eventos con asientos disponibles y cotiza sin bloquear", async () => {
    const s = armarSistema();
    const lista = await s.consultarEventos.listar();
    expect(lista).toHaveLength(3);
    const cot = await s.cotizar.ejecutar({ eventoId: "evt-hamlet", asientoIds: ids(TEATRO, "VIP-A1") });
    expect(cot.montoTotal.monto).toBe(242_000);
    expect((await s.consultarEventos.obtener("evt-hamlet")).asientosDisponibles).toBe(24);
  });

  it("verifica un boleto válido y detecta un código inexistente", async () => {
    const s = armarSistema();
    const orden = await compra(s, ["VIP-A1"]);
    await pagar(s, orden.id, "wompi", ResultadoPago.Aprobado);
    const [boleto] = (await s.consultarOrden.ejecutar(orden.id)).boletos;
    expect((await s.verificarBoleto.ejecutar(boleto!.codigoRedencion)).valido).toBe(true);
    expect((await s.verificarBoleto.ejecutar("NOEXISTE1234")).valido).toBe(false);
  });
});
