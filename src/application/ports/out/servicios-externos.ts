import type { Boleto } from "../../../domain/boleto.js";
import type { Cliente } from "../../../domain/cliente.js";
import type { Evento } from "../../../domain/evento.js";
import type { NombrePasarela } from "../../../domain/estados.js";
import type { Orden } from "../../../domain/orden.js";
import type { CanalNotificacion, ComprobanteFiscal, NotificacionPago, RegistroPago } from "../../../domain/pagos.js";

/** Puerto común de pasarelas de pago (PayPal, Wompi, PSE implementan lo mismo). */
export interface PasarelaPagoPort {
  readonly nombre: NombrePasarela;
  registrarPago(orden: Orden): Promise<RegistroPago>;
  /** Traduce el cuerpo crudo de la notificación asíncrona al lenguaje del dominio. */
  interpretarNotificacion(cuerpo: unknown): NotificacionPago;
  /** Consulta directa a la pasarela del estado real de la transacción. */
  verificarTransaccion(referencia: string): Promise<NotificacionPago>;
}

/** Punto de acceso a las pasarelas configuradas. */
export interface ResolutorPasarelas {
  obtener(nombre: string): PasarelaPagoPort;
  disponibles(): NombrePasarela[];
}

export interface MaterialBoleto {
  readonly codigoRedencion: string;
  readonly firmaHash: string;
  readonly representacionGrafica: string;
}

export interface SolicitudBoleto {
  readonly boletoId: string;
  readonly orden: Orden;
  readonly asientoId: string;
  readonly evento: Evento;
}

/** Generación de la representación gráfica y criptográfica del boleto. */
export interface GeneradorBoletoPort {
  generar(solicitud: SolicitudBoleto): Promise<MaterialBoleto>;
  verificarFirma(boleto: Boleto, orden: Orden, evento: Evento): boolean;
}

export interface MensajeNotificacion {
  readonly destinatario: Cliente;
  readonly asunto: string;
  readonly cuerpo: string;
}

export interface NotificacionPort {
  readonly canal: CanalNotificacion;
  enviar(mensaje: MensajeNotificacion): Promise<void>;
}

export interface FacturacionElectronicaPort {
  emitir(orden: Orden): Promise<ComprobanteFiscal>;
}
