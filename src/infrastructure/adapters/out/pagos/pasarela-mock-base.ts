import { randomUUID } from "node:crypto";
import { Dinero } from "../../../../domain/dinero.js";
import { DatosInvalidos, PagoNoVerificado } from "../../../../domain/errores.js";
import type { NombrePasarela } from "../../../../domain/estados.js";
import type { Orden } from "../../../../domain/orden.js";
import { ResultadoPago, type NotificacionPago, type RegistroPago } from "../../../../domain/pagos.js";
import type { PasarelaPagoPort } from "../../../../application/ports/out/servicios-externos.js";

/** Capacidad extra de los mocks (solo infraestructura): fabricar el webhook que enviaría la pasarela real. */
export interface SimuladorPasarela {
  readonly nombre: NombrePasarela;
  /** Fija el estado real de la transacción y devuelve el cuerpo de webhook con la forma de esa pasarela. */
  simularNotificacion(referencia: string, resultado: ResultadoPago): unknown;
}

interface TransaccionMock {
  monto: Dinero;
  resultado: ResultadoPago;
}

/**
 * Base de los mocks de pasarela. Guarda las transacciones "del lado de la pasarela" y deja a cada
 * subclase la traducción entre su DTO propietario y el modelo del dominio.
 */
export abstract class PasarelaMockBase implements PasarelaPagoPort, SimuladorPasarela {
  abstract readonly nombre: NombrePasarela;
  protected abstract readonly prefijo: string;
  protected abstract urlCheckout(referencia: string): string;
  protected abstract construirCuerpo(referencia: string, monto: Dinero, resultado: ResultadoPago): unknown;
  protected abstract traducirCuerpo(cuerpo: unknown): NotificacionPago;

  protected readonly transacciones = new Map<string, TransaccionMock>();

  async registrarPago(orden: Orden): Promise<RegistroPago> {
    const referencia = `${this.prefijo}-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.transacciones.set(referencia, { monto: orden.montoTotal, resultado: ResultadoPago.Pendiente });
    return { pasarela: this.nombre, referencia, urlPago: this.urlCheckout(referencia) };
  }

  interpretarNotificacion(cuerpo: unknown): NotificacionPago {
    if (typeof cuerpo !== "object" || cuerpo === null) throw new DatosInvalidos("Cuerpo de notificación inválido");
    return this.traducirCuerpo(cuerpo);
  }

  async verificarTransaccion(referencia: string): Promise<NotificacionPago> {
    const t = this.transacciones.get(referencia);
    if (!t) throw new PagoNoVerificado(`${this.nombre} no conoce la transacción ${referencia}`);
    return { pasarela: this.nombre, referencia, resultado: t.resultado, montoPagado: t.monto };
  }

  simularNotificacion(referencia: string, resultado: ResultadoPago): unknown {
    const t = this.transacciones.get(referencia);
    if (!t) throw new PagoNoVerificado(`${this.nombre} no conoce la transacción ${referencia}`);
    t.resultado = resultado;
    return this.construirCuerpo(referencia, t.monto, resultado);
  }
}
