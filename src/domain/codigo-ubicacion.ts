import { DatosInvalidos } from "./errores.js";

/** Código de ubicación de una localidad, p. ej. "VIP-A12" o "General-01". */
export class CodigoUbicacion {
  private static readonly PATRON = /^[A-Za-z]+-[A-Za-z0-9]+$/;

  private constructor(readonly valor: string) {}

  static de(valor: string): CodigoUbicacion {
    if (!CodigoUbicacion.PATRON.test(valor)) throw new DatosInvalidos(`Código de ubicación inválido: ${valor}`);
    return new CodigoUbicacion(valor);
  }
  get zona(): string {
    return this.valor.split("-")[0] ?? "";
  }
  toString(): string {
    return this.valor;
  }
}
