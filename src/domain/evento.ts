import { EstadoEvento, TipoEvento } from "./estados.js";
import { EventoNoDisponible, TransicionInvalida } from "./errores.js";

/** Evento/Función (concierto, teatro o festival). */
export class Evento {
  constructor(
    readonly id: string,
    readonly nombre: string,
    readonly tipo: TipoEvento,
    readonly recintoId: string,
    readonly fechaHora: Date,
    private _estado: EstadoEvento,
    /** Clave secreta del evento: insumo de la firma de seguridad de los boletos. */
    readonly claveSecreta: string,
  ) {}

  get estado(): EstadoEvento {
    return this._estado;
  }
  /** Lanza EventoNoDisponible si el evento no admite ventas en este momento. */
  exigirVentaAbierta(ahora: Date): void {
    if (this._estado === EstadoEvento.Cancelado) throw new EventoNoDisponible("el evento fue cancelado");
    if (this._estado === EstadoEvento.Agotado) throw new EventoNoDisponible("el evento está agotado");
    if (this.fechaHora.getTime() <= ahora.getTime()) throw new EventoNoDisponible("el evento ya ocurrió");
  }
  marcarAgotado(): void {
    if (this._estado !== EstadoEvento.Programado) throw new TransicionInvalida("Evento", this._estado, EstadoEvento.Agotado);
    this._estado = EstadoEvento.Agotado;
  }
  reabrirVenta(): void {
    if (this._estado === EstadoEvento.Agotado) this._estado = EstadoEvento.Programado;
  }
  cancelar(): void {
    this._estado = EstadoEvento.Cancelado;
  }
}
