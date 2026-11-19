import type { Asiento } from "../../../domain/asiento.js";
import type { Boleto } from "../../../domain/boleto.js";
import type { Evento } from "../../../domain/evento.js";
import type { Orden, Liquidacion } from "../../../domain/orden.js";
import type { Recinto } from "../../../domain/recinto.js";
import type { RegistroPago } from "../../../domain/pagos.js";

/** Puertos de entrada: lo que el mundo exterior puede pedirle al núcleo. */

export interface VistaEvento {
  evento: Evento;
  recinto: Recinto;
  asientosDisponibles: number;
}

export interface ConsultarEventos {
  listar(): Promise<VistaEvento[]>;
  obtener(eventoId: string): Promise<VistaEvento>;
  asientos(eventoId: string): Promise<Asiento[]>;
}

export interface SolicitudCotizacion {
  eventoId: string;
  asientoIds: string[];
}
export interface CotizarCompra {
  ejecutar(solicitud: SolicitudCotizacion): Promise<Liquidacion>;
}

export interface DatosCliente {
  nombreCompleto: string;
  correo: string;
  telefonoMovil: string;
  nacionalidad: string;
}
export interface SolicitudInicioCompra {
  eventoId: string;
  asientoIds: string[];
  cliente: DatosCliente;
}
/** Selección de asientos + bloqueo temporal + creación de la orden pendiente. */
export interface IniciarCompra {
  ejecutar(solicitud: SolicitudInicioCompra): Promise<Orden>;
}

export interface SolicitudPago {
  ordenId: string;
  pasarela: string;
}
export interface IniciarPago {
  ejecutar(solicitud: SolicitudPago): Promise<RegistroPago>;
}

export interface SolicitudConfirmacion {
  pasarela: string;
  /** Cuerpo crudo recibido de la pasarela; solo el adaptador de esa pasarela lo entiende. */
  cuerpo: unknown;
}
export interface ConfirmarPago {
  ejecutar(solicitud: SolicitudConfirmacion): Promise<Orden | null>;
}

export interface ExpirarReservas {
  ejecutar(): Promise<number>;
}

export interface DetalleOrden {
  orden: Orden;
  boletos: Boleto[];
}
export interface ConsultarOrden {
  ejecutar(ordenId: string): Promise<DetalleOrden>;
}

export interface ResultadoVerificacion {
  valido: boolean;
  motivo?: string;
  boleto?: Boleto;
}
export interface VerificarBoleto {
  ejecutar(codigoRedencion: string): Promise<ResultadoVerificacion>;
}
