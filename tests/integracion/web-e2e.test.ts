import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirAplicacion } from "../../src/composicion.js";

let sistema: Awaited<ReturnType<typeof construirAplicacion>>;
let servidor: Server;
let base: string;

beforeAll(async () => {
  sistema = await construirAplicacion({ puerto: 0, bloqueoMinutos: 10, intervaloExpiracionSeg: 3600, silencioso: true });
  servidor = sistema.app.listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => {
  servidor.close();
  await sistema.cerrar();
});

const post = (ruta: string, cuerpo: unknown) =>
  fetch(base + ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
const cliente = (correo: string) => ({ nombreCompleto: "Luisa Fernanda Velandia", correo, telefonoMovil: "+573001234567", nacionalidad: "Colombiana" });

describe("API REST + webhook + Mongo + generador (extremo a extremo)", () => {
  it("flujo completo: eventos -> cotización -> compra -> pago -> webhook -> boletos verificables", async () => {
    const eventos = (await (await fetch(base + "/api/eventos")).json()) as { id: string }[];
    expect(eventos.map((e) => e.id)).toContain("evt-rock");

    const asientoIds = ["rec-arena:VIP-A1", "rec-arena:VIP-A2", "rec-arena:General-01"];
    const cot = await (await post("/api/cotizaciones", { eventoId: "evt-rock", asientoIds })).json();
    expect(cot.valorBase).toBe(1_110_000);
    expect(cot.porcentajeTarifa).toBe(8);
    expect(cot.montoTotal).toBe(1_110_000 + 88_800 - 55_500);

    const resCompra = await post("/api/compras", { eventoId: "evt-rock", asientoIds, cliente: cliente("e2e@example.com") });
    expect(resCompra.status).toBe(201);
    const orden = await resCompra.json();
    expect(orden.estado).toBe("PENDIENTE_PAGO");
    expect(orden.montoTotal).toBe(cot.montoTotal);

    const registro = await (await post(`/api/ordenes/${orden.id}/pago`, { pasarela: "pse" })).json();
    const { cuerpoWebhook } = await (await post("/api/simulador/pagos", { pasarela: "pse", referencia: registro.referencia, resultado: "APROBADO" })).json();
    expect(cuerpoWebhook.transactionState).toBe("OK"); // DTO propio de PSE

    const wh = await post("/webhooks/pagos/pse", cuerpoWebhook);
    expect(wh.status).toBe(200);
    expect((await wh.json()).estado).toBe("APROBADA");

    const detalle = await (await fetch(`${base}/api/ordenes/${orden.id}`)).json();
    expect(detalle.boletos).toHaveLength(3);
    const b = detalle.boletos[0];
    expect(b.firmaHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.representacionGrafica).toContain("data:image/svg+xml");
    const v = await (await fetch(`${base}/api/boletos/${b.codigoRedencion}/verificar`)).json();
    expect(v.valido).toBe(true);

    const asientos = (await (await fetch(base + "/api/eventos/evt-rock/asientos")).json()) as { id: string; estado: string }[];
    expect(asientos.find((a) => a.id === "rec-arena:VIP-A1")?.estado).toBe("VENDIDO");
  });

  it("responde 409 al reservar un asiento ya bloqueado y 400 con datos inválidos", async () => {
    const asientoIds = ["rec-parque:VIP-A1"];
    expect((await post("/api/compras", { eventoId: "evt-raices", asientoIds, cliente: cliente("a@example.com") })).status).toBe(201);
    const choque = await post("/api/compras", { eventoId: "evt-raices", asientoIds, cliente: cliente("b@example.com") });
    expect(choque.status).toBe(409);
    expect((await choque.json()).error).toBe("ASIENTO_NO_DISPONIBLE");
    const mala = await post("/api/compras", { eventoId: "evt-raices", asientoIds: ["rec-parque:VIP-A2"], cliente: { ...cliente("c@example.com"), correo: "no-es-correo" } });
    expect(mala.status).toBe(400);
  });

  it("responde 404 para eventos y órdenes inexistentes, 400 para pasarela desconocida y JSON roto", async () => {
    expect((await fetch(base + "/api/eventos/nada")).status).toBe(404);
    expect((await fetch(base + "/api/ordenes/nada")).status).toBe(404);
    expect((await post("/webhooks/pagos/bitcoin", {})).status).toBe(400);
    const roto = await fetch(base + "/api/compras", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{no-json" });
    expect(roto.status).toBe(400);
  });

  it("el webhook responde 200 a referencias desconocidas sin romper nada", async () => {
    const r = await post("/webhooks/pagos/wompi", { event: "transaction.updated", data: { transaction: { id: "WOMPI-FANTASMA", status: "APPROVED", amount_in_cents: 1 } } });
    expect(r.status).toBe(200);
    expect((await r.json()).ordenId).toBeNull();
  });

  it("sirve la UI estática", async () => {
    const r = await fetch(base + "/");
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("StagePass Live");
  });
});
