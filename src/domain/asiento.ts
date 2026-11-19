import { CodigoUbicacion } from "./codigo-ubicacion.js";
import { Dinero } from "./dinero.js";
import { EstadoAsiento } from "./estados.js";
import { TransicionInvalida } from "./errores.js";

/** Localidad/Asiento de un recinto. Objeto de dominio puro. */
export class Asiento {
  constructor(
    readonly id: string,
    readonly recintoId: string,
    readonly codigo: CodigoUbicacion,
    readonly precioBase: Dinero,
    private _estado: EstadoAsiento = EstadoAsiento.Disponible,
  ) {}

  get estado(): EstadoAsiento {
    return this._estado;
  }
  estaDisponible(): boolean {
    return this._estado === EstadoAsiento.Disponible;
  }
  bloquear(): void {
    this.exigir(EstadoAsiento.Disponible, EstadoAsiento.Bloqueado);
    this._estado = EstadoAsiento.Bloqueado;
  }
  vender(): void {
    this.exigir(EstadoAsiento.Bloqueado, EstadoAsiento.Vendido);
    this._estado = EstadoAsiento.Vendido;
  }
  liberar(): void {
    this.exigir(EstadoAsiento.Bloqueado, EstadoAsiento.Disponible);
    this._estado = EstadoAsiento.Disponible;
  }
  private exigir(requerido: EstadoAsiento, destino: EstadoAsiento): void {
    if (this._estado !== requerido) throw new TransicionInvalida("Asiento", this._estado, destino);
  }
}
