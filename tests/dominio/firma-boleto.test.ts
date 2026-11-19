import { describe, expect, it } from "vitest";
import { Boleto } from "../../src/domain/boleto.js";
import { CalculadoraTarifas } from "../../src/domain/calculadora-tarifas.js";
import { Cliente } from "../../src/domain/cliente.js";
import { Dinero } from "../../src/domain/dinero.js";
import { EstadoEvento, TipoEvento } from "../../src/domain/estados.js";
import { Evento } from "../../src/domain/evento.js";
import { Orden } from "../../src/domain/orden.js";
import { GeneradorBoletoCriptografico } from "../../src/infrastructure/adapters/out/boletos/generador-boleto-criptografico.js";

const generador = new GeneradorBoletoCriptografico();
const evento = (clave = "clave-A") => new Evento("e1", "Concierto", TipoEvento.Concierto, "r1", new Date("2027-01-01"), EstadoEvento.Programado, clave);
const orden = (monto = 100_000) =>
  Orden.crear({
    id: "o1",
    cliente: new Cliente("c1", "Luisa Velandia", "l@x.co", "3001234567", "Colombiana"),
    eventoId: "e1",
    asientos: [{ asientoId: "a1", codigoUbicacion: "VIP-A1", precioBase: Dinero.cop(monto) }],
    liquidacion: new CalculadoraTarifas().calcular(Dinero.cop(monto), 1),
    creadaEn: new Date(),
    expiraEn: new Date(Date.now() + 60_000),
  });

async function emitir(o = orden(), e = evento()) {
  const m = await generador.generar({ boletoId: "b1", orden: o, asientoId: "a1", evento: e });
  const boleto = new Boleto("b1", o.id, "e1", "a1", "VIP-A1", m.codigoRedencion, m.firmaHash, new Date(), m.representacionGrafica);
  return { m, boleto };
}

describe("GeneradorBoletoCriptografico", () => {
  it("genera código alfanumérico de 12 caracteres, firma HMAC-SHA256 (64 hex) y QR", async () => {
    const { m } = await emitir();
    expect(m.codigoRedencion).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(m.firmaHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.representacionGrafica.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(m.representacionGrafica.split(",")[1]!, "base64").toString();
    expect(svg).toContain("<svg");
  });

  it("la firma es determinista para los mismos datos y clave, pero el código es distinto cada vez", async () => {
    const a = await emitir();
    const b = await emitir();
    expect(a.m.firmaHash).toBe(b.m.firmaHash);
    expect(a.m.codigoRedencion).not.toBe(b.m.codigoRedencion);
  });

  it("verifica una firma legítima", async () => {
    const o = orden();
    const e = evento();
    const { boleto } = await emitir(o, e);
    expect(generador.verificarFirma(boleto, o, e)).toBe(true);
  });

  it("detecta una orden alterada (monto distinto)", async () => {
    const e = evento();
    const { boleto } = await emitir(orden(100_000), e);
    expect(generador.verificarFirma(boleto, orden(50_000), e)).toBe(false);
  });

  it("detecta una clave de evento distinta", async () => {
    const o = orden();
    const { boleto } = await emitir(o, evento("clave-A"));
    expect(generador.verificarFirma(boleto, o, evento("clave-B"))).toBe(false);
  });

  it("detecta una firma manipulada o con formato inválido", async () => {
    const o = orden();
    const e = evento();
    const { boleto } = await emitir(o, e);
    const mala = new Boleto(boleto.id, boleto.ordenId, "e1", "a1", "VIP-A1", boleto.codigoRedencion, "00".repeat(32), new Date(), "");
    const corta = new Boleto(boleto.id, boleto.ordenId, "e1", "a1", "VIP-A1", boleto.codigoRedencion, "abcd", new Date(), "");
    expect(generador.verificarFirma(mala, o, e)).toBe(false);
    expect(generador.verificarFirma(corta, o, e)).toBe(false);
  });
});
