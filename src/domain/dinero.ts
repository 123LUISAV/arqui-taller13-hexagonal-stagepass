import { DatosInvalidos } from "./errores.js";

/** Value object de dinero en pesos colombianos (enteros, sin decimales). */
export class Dinero {
  private constructor(readonly monto: number) {}

  static cop(monto: number): Dinero {
    if (!Number.isFinite(monto) || monto < 0) throw new DatosInvalidos(`Monto inválido: ${monto}`);
    return new Dinero(Math.round(monto));
  }
  static cero(): Dinero {
    return new Dinero(0);
  }
  sumar(otro: Dinero): Dinero {
    return new Dinero(this.monto + otro.monto);
  }
  restar(otro: Dinero): Dinero {
    return Dinero.cop(this.monto - otro.monto);
  }
  /** Aplica un porcentaje (0-100) y redondea al peso más cercano. */
  porcentaje(pct: number): Dinero {
    return new Dinero(Math.round((this.monto * pct) / 100));
  }
  igual(otro: Dinero): boolean {
    return this.monto === otro.monto;
  }
  toString(): string {
    return `COP ${this.monto}`;
  }
}
