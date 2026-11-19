import { Dinero } from "../../../../domain/dinero.js";
import { DatosInvalidos } from "../../../../domain/errores.js";
import { NombrePasarela } from "../../../../domain/estados.js";
import { ResultadoPago, type NotificacionPago } from "../../../../domain/pagos.js";
import { PasarelaMockBase } from "./pasarela-mock-base.js";

/* Cada pasarela define su propio DTO de webhook. Estos tipos NO salen de este archivo. */

// ---- PayPal (webhook de captura de pago) ----
interface PayPalWebhook {
  event_type: "PAYMENT.CAPTURE.COMPLETED" | "PAYMENT.CAPTURE.DENIED" | "PAYMENT.CAPTURE.PENDING";
  resource: { id: string; amount: { value: string; currency_code: string } };
}
export class PasarelaPayPalMock extends PasarelaMockBase {
  readonly nombre = NombrePasarela.PayPal;
  protected readonly prefijo = "PAYPAL";
  protected urlCheckout(ref: string) { return `https://www.sandbox.paypal.mock/checkoutnow?token=${ref}`; }

  protected construirCuerpo(ref: string, monto: Dinero, r: ResultadoPago): PayPalWebhook {
    const tipo = { [ResultadoPago.Aprobado]: "PAYMENT.CAPTURE.COMPLETED", [ResultadoPago.Rechazado]: "PAYMENT.CAPTURE.DENIED", [ResultadoPago.Pendiente]: "PAYMENT.CAPTURE.PENDING" } as const;
    return { event_type: tipo[r], resource: { id: ref, amount: { value: monto.monto.toFixed(2), currency_code: "COP" } } };
  }
  protected traducirCuerpo(cuerpo: object): NotificacionPago {
    const c = cuerpo as Partial<PayPalWebhook>;
    if (!c.event_type || !c.resource?.id) throw new DatosInvalidos("Webhook de PayPal malformado");
    const resultado = c.event_type === "PAYMENT.CAPTURE.COMPLETED" ? ResultadoPago.Aprobado : c.event_type === "PAYMENT.CAPTURE.DENIED" ? ResultadoPago.Rechazado : ResultadoPago.Pendiente;
    return { pasarela: this.nombre, referencia: c.resource.id, resultado, montoPagado: Dinero.cop(Number(c.resource.amount?.value)) };
  }
}

// ---- Wompi (evento transaction.updated, montos en centavos) ----
interface WompiWebhook {
  event: "transaction.updated";
  data: { transaction: { id: string; status: "APPROVED" | "DECLINED" | "PENDING" | "ERROR"; amount_in_cents: number } };
}
export class PasarelaWompiMock extends PasarelaMockBase {
  readonly nombre = NombrePasarela.Wompi;
  protected readonly prefijo = "WOMPI";
  protected urlCheckout(ref: string) { return `https://checkout.wompi.mock/p/?reference=${ref}`; }

  protected construirCuerpo(ref: string, monto: Dinero, r: ResultadoPago): WompiWebhook {
    const status = { [ResultadoPago.Aprobado]: "APPROVED", [ResultadoPago.Rechazado]: "DECLINED", [ResultadoPago.Pendiente]: "PENDING" } as const;
    return { event: "transaction.updated", data: { transaction: { id: ref, status: status[r], amount_in_cents: monto.monto * 100 } } };
  }
  protected traducirCuerpo(cuerpo: object): NotificacionPago {
    const t = (cuerpo as Partial<WompiWebhook>).data?.transaction;
    if (!t?.id) throw new DatosInvalidos("Webhook de Wompi malformado");
    const resultado = t.status === "APPROVED" ? ResultadoPago.Aprobado : t.status === "DECLINED" || t.status === "ERROR" ? ResultadoPago.Rechazado : ResultadoPago.Pendiente;
    return { pasarela: this.nombre, referencia: t.id, resultado, montoPagado: Dinero.cop(Number(t.amount_in_cents) / 100) };
  }
}

// ---- PSE (débito bancario vía ACH) ----
interface PseWebhook {
  ticketId: string;
  transactionState: "OK" | "NOT_AUTHORIZED" | "PENDING" | "FAILED";
  transactionValue: number;
  bankName: string;
}
export class PasarelaPseMock extends PasarelaMockBase {
  readonly nombre = NombrePasarela.PSE;
  protected readonly prefijo = "PSE";
  protected urlCheckout(ref: string) { return `https://pse.mock/banco/seleccion?ticket=${ref}`; }

  protected construirCuerpo(ref: string, monto: Dinero, r: ResultadoPago): PseWebhook {
    const estado = { [ResultadoPago.Aprobado]: "OK", [ResultadoPago.Rechazado]: "NOT_AUTHORIZED", [ResultadoPago.Pendiente]: "PENDING" } as const;
    return { ticketId: ref, transactionState: estado[r], transactionValue: monto.monto, bankName: "Banco de Pruebas" };
  }
  protected traducirCuerpo(cuerpo: object): NotificacionPago {
    const c = cuerpo as Partial<PseWebhook>;
    if (!c.ticketId) throw new DatosInvalidos("Notificación PSE malformada");
    const resultado = c.transactionState === "OK" ? ResultadoPago.Aprobado : c.transactionState === "PENDING" ? ResultadoPago.Pendiente : ResultadoPago.Rechazado;
    return { pasarela: this.nombre, referencia: c.ticketId, resultado, montoPagado: Dinero.cop(Number(c.transactionValue)) };
  }
}
