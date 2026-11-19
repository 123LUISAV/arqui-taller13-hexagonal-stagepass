/** Excepciones de negocio del núcleo. No dependen de HTTP ni de ninguna tecnología. */
export class ErrorNegocio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class DatosInvalidos extends ErrorNegocio {
  constructor(mensaje: string) {
    super("DATOS_INVALIDOS", mensaje);
  }
}
export class EventoNoEncontrado extends ErrorNegocio {
  constructor(id: string) {
    super("EVENTO_NO_ENCONTRADO", `No existe el evento ${id}`);
  }
}
export class EventoNoDisponible extends ErrorNegocio {
  constructor(motivo: string) {
    super("EVENTO_NO_DISPONIBLE", `El evento no admite ventas: ${motivo}`);
  }
}
export class AsientoNoDisponible extends ErrorNegocio {
  constructor(detalle: string) {
    super("ASIENTO_NO_DISPONIBLE", `Asiento no disponible: ${detalle}`);
  }
}
export class CantidadInvalida extends ErrorNegocio {
  constructor(cantidad: number) {
    super("CANTIDAD_INVALIDA", `Cantidad de boletos inválida: ${cantidad}`);
  }
}
export class LimiteBoletasExcedido extends ErrorNegocio {
  constructor(limite: number, acumuladas: number, solicitadas: number) {
    super(
      "LIMITE_BOLETAS_EXCEDIDO",
      `Un cliente no puede acumular más de ${limite} boletas por evento (tiene ${acumuladas} y solicita ${solicitadas})`,
    );
  }
}
export class TransicionInvalida extends ErrorNegocio {
  constructor(entidad: string, desde: string, hacia: string) {
    super("TRANSICION_INVALIDA", `${entidad}: no se puede pasar de ${desde} a ${hacia}`);
  }
}
export class OrdenNoEncontrada extends ErrorNegocio {
  constructor(id: string) {
    super("ORDEN_NO_ENCONTRADA", `No existe la orden ${id}`);
  }
}
export class PasarelaNoSoportada extends ErrorNegocio {
  constructor(nombre: string) {
    super("PASARELA_NO_SOPORTADA", `Pasarela de pago no soportada: ${nombre}`);
  }
}
export class PagoNoVerificado extends ErrorNegocio {
  constructor(motivo: string) {
    super("PAGO_NO_VERIFICADO", `No se pudo verificar el pago: ${motivo}`);
  }
}
