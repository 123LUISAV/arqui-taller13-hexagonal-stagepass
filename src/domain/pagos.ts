import { Dinero } from "./dinero.js";
import { NombrePasarela } from "./estados.js";

export const ResultadoPago = { Aprobado: "APROBADO", Rechazado: "RECHAZADO", Pendiente: "PENDIENTE" } as const;
export type ResultadoPago = (typeof ResultadoPago)[keyof typeof ResultadoPago];

/** Registro de un pago iniciado en una pasarela (modelo del dominio, no DTO de pasarela). */
export interface RegistroPago {
  readonly pasarela: NombrePasarela;
  readonly referencia: string;
  /** URL o instrucción hacia donde se dirige al cliente para pagar. */
  readonly urlPago: string;
}

/** Notificación asíncrona de cambio de estado, ya traducida al lenguaje del dominio. */
export interface NotificacionPago {
  readonly pasarela: NombrePasarela;
  readonly referencia: string;
  readonly resultado: ResultadoPago;
  readonly montoPagado: Dinero;
}

export interface ComprobanteFiscal {
  readonly numero: string;
  readonly cufe: string;
  readonly emitidoEn: Date;
}

export const CanalNotificacion = { WhatsApp: "WHATSAPP", Correo: "CORREO" } as const;
export type CanalNotificacion = (typeof CanalNotificacion)[keyof typeof CanalNotificacion];
