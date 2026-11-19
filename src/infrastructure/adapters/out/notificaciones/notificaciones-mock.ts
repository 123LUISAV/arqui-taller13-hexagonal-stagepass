import { CanalNotificacion } from "../../../../domain/pagos.js";
import type { MensajeNotificacion, NotificacionPort } from "../../../../application/ports/out/servicios-externos.js";
import type { Logger } from "../../../../application/ports/out/utilidades.js";

abstract class NotificacionMock implements NotificacionPort {
  abstract readonly canal: CanalNotificacion;
  protected abstract destino(m: MensajeNotificacion): string;
  /** Historial en memoria: permite inspeccionar lo "enviado" en pruebas y demos. */
  readonly enviados: MensajeNotificacion[] = [];
  constructor(private readonly log: Logger) {}

  async enviar(m: MensajeNotificacion): Promise<void> {
    this.enviados.push(m);
    this.log.info(`[${this.canal}] -> ${this.destino(m)} | ${m.asunto}`);
  }
}

/** Mock del adaptador de WhatsApp (no llama a ninguna API real). */
export class WhatsAppMock extends NotificacionMock {
  readonly canal = CanalNotificacion.WhatsApp;
  protected destino(m: MensajeNotificacion) { return m.destinatario.telefonoMovil; }
}

/** Mock del adaptador de correo SendGrid (no llama a ninguna API real). */
export class SendGridMock extends NotificacionMock {
  readonly canal = CanalNotificacion.Correo;
  protected destino(m: MensajeNotificacion) { return m.destinatario.correo; }
}
