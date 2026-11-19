import { CantidadInvalida } from "./errores.js";
import { Dinero } from "./dinero.js";
import type { Liquidacion } from "./orden.js";

/**
 * Tarifas dinámicas según la cantidad de boletos (sobre el valor base de las boletas):
 *   1-2  -> tarifa administrativa 10 %, descuento 0 %
 *   3-5  -> tarifa 8 %,               descuento comercial 5 %
 *   > 5  -> corporativa: tarifa fija 5 %, descuento 10 %
 */
export class CalculadoraTarifas {
  calcular(valorBase: Dinero, cantidad: number): Liquidacion {
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new CantidadInvalida(cantidad);
    const { tarifa, descuento } = this.porcentajes(cantidad);
    const tarifaServicio = valorBase.porcentaje(tarifa);
    const descuentoAplicado = valorBase.porcentaje(descuento);
    return {
      valorBase,
      tarifaServicio,
      descuento: descuentoAplicado,
      montoTotal: valorBase.sumar(tarifaServicio).restar(descuentoAplicado),
      porcentajeTarifa: tarifa,
      porcentajeDescuento: descuento,
    };
  }
  private porcentajes(cantidad: number): { tarifa: number; descuento: number } {
    if (cantidad <= 2) return { tarifa: 10, descuento: 0 };
    if (cantidad <= 5) return { tarifa: 8, descuento: 5 };
    return { tarifa: 5, descuento: 10 };
  }
}
