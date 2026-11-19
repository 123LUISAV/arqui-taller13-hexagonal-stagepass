/** Regla de bloqueo temporal de asientos (10 minutos por defecto). */
export class PoliticaBloqueo {
  constructor(readonly minutos: number = 10) {
    if (!(minutos > 0)) throw new RangeError("La duración del bloqueo debe ser positiva");
  }
  calcularExpiracion(ahora: Date): Date {
    return new Date(ahora.getTime() + this.minutos * 60_000);
  }
}
