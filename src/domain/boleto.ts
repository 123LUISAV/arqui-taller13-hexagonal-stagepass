/** Boleto digital emitido solo tras un pago verificado. */
export class Boleto {
  constructor(
    readonly id: string,
    readonly ordenId: string,
    readonly eventoId: string,
    readonly asientoId: string,
    readonly codigoUbicacion: string,
    /** Código alfanumérico de redención presentado en el acceso. */
    readonly codigoRedencion: string,
    /** Firma hash de seguridad (datos inmutables de la orden + clave del evento). */
    readonly firmaHash: string,
    readonly fechaEmision: Date,
    /** Representación gráfica (data URL del QR). */
    readonly representacionGrafica: string,
  ) {}
}
