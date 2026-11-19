import { describe, expect, it } from "vitest";
import { Asiento } from "../../src/domain/asiento.js";
import { CalculadoraTarifas } from "../../src/domain/calculadora-tarifas.js";
import { Cliente } from "../../src/domain/cliente.js";
import { CodigoUbicacion } from "../../src/domain/codigo-ubicacion.js";
import { Dinero } from "../../src/domain/dinero.js";
import { CantidadInvalida, DatosInvalidos, LimiteBoletasExcedido, TransicionInvalida } from "../../src/domain/errores.js";
import { EstadoAsiento, EstadoOrden } from "../../src/domain/estados.js";
import { LimiteBoletasPorEvento } from "../../src/domain/limite-boletas.js";
import { Orden } from "../../src/domain/orden.js";
import { PoliticaBloqueo } from "../../src/domain/politica-bloqueo.js";

const calc = new CalculadoraTarifas();

describe("CalculadoraTarifas: tramos por cantidad de boletos", () => {
  it.each([
    { n: 1, base: 100_000, tarifa: 10_000, desc: 0, total: 110_000, pt: 10, pd: 0 },
    { n: 2, base: 200_000, tarifa: 20_000, desc: 0, total: 220_000, pt: 10, pd: 0 },
    { n: 3, base: 300_000, tarifa: 24_000, desc: 15_000, total: 309_000, pt: 8, pd: 5 },
    { n: 5, base: 500_000, tarifa: 40_000, desc: 25_000, total: 515_000, pt: 8, pd: 5 },
    { n: 6, base: 600_000, tarifa: 30_000, desc: 60_000, total: 570_000, pt: 5, pd: 10 },
  ])("$n boleto(s): tarifa $pt %, descuento $pd %", ({ n, base, tarifa, desc, total, pt, pd }) => {
    const l = calc.calcular(Dinero.cop(base), n);
    expect(l.tarifaServicio.monto).toBe(tarifa);
    expect(l.descuento.monto).toBe(desc);
    expect(l.montoTotal.monto).toBe(total);
    expect(l.porcentajeTarifa).toBe(pt);
    expect(l.porcentajeDescuento).toBe(pd);
  });

  it("rechaza cantidades menores a 1 o no enteras", () => {
    expect(() => calc.calcular(Dinero.cop(1000), 0)).toThrow(CantidadInvalida);
    expect(() => calc.calcular(Dinero.cop(1000), 1.5)).toThrow(CantidadInvalida);
  });

  it("redondea al peso más cercano", () => {
    // 3 boletos, base 100.001: tarifa 8 % = 8000,08 -> 8000; descuento 5 % = 5000,05 -> 5000
    const l = calc.calcular(Dinero.cop(100_001), 3);
    expect(l.tarifaServicio.monto).toBe(8_000);
    expect(l.descuento.monto).toBe(5_000);
  });
});

describe("LimiteBoletasPorEvento", () => {
  const limite = new LimiteBoletasPorEvento();
  it("permite llegar exactamente a 6", () => {
    expect(() => limite.verificar(0, 6)).not.toThrow();
    expect(() => limite.verificar(4, 2)).not.toThrow();
  });
  it("rechaza pasar de 6 acumuladas", () => {
    expect(() => limite.verificar(0, 7)).toThrow(LimiteBoletasExcedido);
    expect(() => limite.verificar(4, 3)).toThrow(LimiteBoletasExcedido);
    expect(() => limite.verificar(6, 1)).toThrow(LimiteBoletasExcedido);
  });
});

describe("PoliticaBloqueo", () => {
  it("expira 10 minutos después por defecto", () => {
    const t = new Date("2026-11-18T10:00:00Z");
    expect(new PoliticaBloqueo().calcularExpiracion(t).toISOString()).toBe("2026-11-18T10:10:00.000Z");
  });
  it("admite duración configurable y rechaza valores no positivos", () => {
    const t = new Date("2026-11-18T10:00:00Z");
    expect(new PoliticaBloqueo(0.5).calcularExpiracion(t).toISOString()).toBe("2026-11-18T10:00:30.000Z");
    expect(() => new PoliticaBloqueo(0)).toThrow(RangeError);
  });
});

describe("Asiento: máquina de estados", () => {
  const nuevo = () => new Asiento("a1", "r1", CodigoUbicacion.de("VIP-A12"), Dinero.cop(100));
  it("Disponible -> Bloqueado -> Vendido", () => {
    const a = nuevo();
    a.bloquear();
    expect(a.estado).toBe(EstadoAsiento.Bloqueado);
    a.vender();
    expect(a.estado).toBe(EstadoAsiento.Vendido);
  });
  it("Bloqueado -> Disponible al liberar", () => {
    const a = nuevo();
    a.bloquear();
    a.liberar();
    expect(a.estaDisponible()).toBe(true);
  });
  it("no se puede vender un asiento sin bloquear ni bloquear uno vendido", () => {
    const a = nuevo();
    expect(() => a.vender()).toThrow(TransicionInvalida);
    a.bloquear();
    a.vender();
    expect(() => a.bloquear()).toThrow(TransicionInvalida);
  });
});

describe("Orden: transiciones de estado", () => {
  const crear = () => {
    const l = calc.calcular(Dinero.cop(100_000), 1);
    return Orden.crear({
      id: "o1",
      cliente: new Cliente("c1", "Luisa Velandia", "l@x.co", "3001234567", "Colombiana"),
      eventoId: "e1",
      asientos: [{ asientoId: "a1", codigoUbicacion: "VIP-A1", precioBase: Dinero.cop(100_000) }],
      liquidacion: l,
      creadaEn: new Date("2026-11-18T10:00:00Z"),
      expiraEn: new Date("2026-11-18T10:10:00Z"),
    });
  };
  it("nace pendiente y solo transiciona una vez", () => {
    const o = crear();
    expect(o.estado).toBe(EstadoOrden.PendientePago);
    o.aprobar();
    expect(o.estado).toBe(EstadoOrden.Aprobada);
    expect(() => o.rechazar()).toThrow(TransicionInvalida);
    expect(() => o.expirar()).toThrow(TransicionInvalida);
  });
  it("detecta expiración por tiempo", () => {
    const o = crear();
    expect(o.haExpirado(new Date("2026-11-18T10:09:59Z"))).toBe(false);
    expect(o.haExpirado(new Date("2026-11-18T10:10:00Z"))).toBe(true);
  });
  it("sus datos inmutables dependen de orden, cliente, evento, asiento y total", () => {
    expect(crear().datosInmutables("a1")).toBe("o1|c1|e1|a1|VIP-A1|110000");
    expect(() => crear().datosInmutables("zzz")).toThrow(TransicionInvalida);
  });
});

describe("Value objects y validaciones", () => {
  it("CodigoUbicacion valida el formato", () => {
    expect(CodigoUbicacion.de("General-01").zona).toBe("General");
    expect(() => CodigoUbicacion.de("sin guion")).toThrow(DatosInvalidos);
  });
  it("Dinero no admite negativos y opera en pesos enteros", () => {
    expect(() => Dinero.cop(-1)).toThrow(DatosInvalidos);
    expect(Dinero.cop(10).sumar(Dinero.cop(5)).monto).toBe(15);
  });
  it("Cliente valida correo y teléfono", () => {
    expect(() => new Cliente("c", "Luisa V", "no-es-correo", "3001234567", "CO")).toThrow(DatosInvalidos);
    expect(() => new Cliente("c", "Luisa V", "l@x.co", "abc", "CO")).toThrow(DatosInvalidos);
  });
});
