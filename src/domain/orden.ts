import { Cliente } from "./cliente.js";
import { Dinero } from "./dinero.js";
import { EstadoOrden, NombrePasarela } from "./estados.js";
import { TransicionInvalida } from "./errores.js";

/** Línea de la orden: instantánea inmutable del asiento comprado. */
export interface ItemOrden {
  readonly asientoId: string;
  readonly codigoUbicacion: string;
  readonly precioBase: Dinero;
}

/** Resultado del cálculo de tarifas del núcleo. */
export interface Liquidacion {
  readonly valorBase: Dinero;
  readonly tarifaServicio: Dinero;
  readonly descuento: Dinero;
  readonly montoTotal: Dinero;
  readonly porcentajeTarifa: number;
  readonly porcentajeDescuento: number;
}

export interface PropsOrden {
  id: string;
  cliente: Cliente;
  eventoId: string;
  asientos: ItemOrden[];
  liquidacion: Liquidacion;
  creadaEn: Date;
  expiraEn: Date;
  estado: EstadoOrden;
  pasarela?: NombrePasarela;
  referenciaPago?: string;
}

/** Reserva/Orden de compra. */
export class Orden {
  private constructor(private readonly p: PropsOrden) {}

  static crear(datos: Omit<PropsOrden, "estado">): Orden {
    return new Orden({ ...datos, estado: EstadoOrden.PendientePago });
  }
  /** Rehidrata una orden desde persistencia (sin validar transiciones). */
  static reconstituir(props: PropsOrden): Orden {
    return new Orden({ ...props });
  }

  get id() { return this.p.id; }
  get cliente() { return this.p.cliente; }
  get eventoId() { return this.p.eventoId; }
  get asientos(): readonly ItemOrden[] { return this.p.asientos; }
  get liquidacion(): Liquidacion { return this.p.liquidacion; }
  get tarifaServicio(): Dinero { return this.p.liquidacion.tarifaServicio; }
  get descuentoAplicado(): Dinero { return this.p.liquidacion.descuento; }
  get montoTotal(): Dinero { return this.p.liquidacion.montoTotal; }
  get creadaEn() { return this.p.creadaEn; }
  get expiraEn() { return this.p.expiraEn; }
  get estado(): EstadoOrden { return this.p.estado; }
  get pasarela() { return this.p.pasarela; }
  get referenciaPago() { return this.p.referenciaPago; }
  get cantidad(): number { return this.p.asientos.length; }

  estaPendiente(): boolean { return this.p.estado === EstadoOrden.PendientePago; }
  haExpirado(ahora: Date): boolean { return ahora.getTime() >= this.p.expiraEn.getTime(); }

  asignarPago(pasarela: NombrePasarela, referencia: string): void {
    this.exigirPendiente(this.p.estado);
    this.p.pasarela = pasarela;
    this.p.referenciaPago = referencia;
  }
  aprobar(): void { this.transicionar(EstadoOrden.Aprobada); }
  rechazar(): void { this.transicionar(EstadoOrden.Rechazada); }
  expirar(): void { this.transicionar(EstadoOrden.Expirada); }

  /**
   * Datos inmutables de la orden para un asiento concreto. Es la cadena canónica
   * que el generador de boletos firma junto con la clave secreta del evento.
   */
  datosInmutables(asientoId: string): string {
    const item = this.p.asientos.find((a) => a.asientoId === asientoId);
    if (!item) throw new TransicionInvalida("Orden", `sin asiento ${asientoId}`, "firma");
    return [this.p.id, this.p.cliente.id, this.p.eventoId, item.asientoId, item.codigoUbicacion, this.p.liquidacion.montoTotal.monto].join("|");
  }

  private transicionar(destino: EstadoOrden): void {
    this.exigirPendiente(destino);
    this.p.estado = destino;
  }
  private exigirPendiente(destino: string): void {
    if (this.p.estado !== EstadoOrden.PendientePago) throw new TransicionInvalida("Orden", this.p.estado, destino);
  }
}
