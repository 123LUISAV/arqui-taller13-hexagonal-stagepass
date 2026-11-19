/** Recinto (venue) con su aforo. Dato maestro del sistema legacy. */
export class Recinto {
  constructor(
    readonly id: string,
    readonly nombre: string,
    readonly ciudad: string,
    readonly aforo: number,
  ) {}
}
