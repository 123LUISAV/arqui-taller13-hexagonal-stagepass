import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import type { Boleto } from "../../../../domain/boleto.js";
import type { Evento } from "../../../../domain/evento.js";
import type { Orden } from "../../../../domain/orden.js";
import type { GeneradorBoletoPort, MaterialBoleto, SolicitudBoleto } from "../../../../application/ports/out/servicios-externos.js";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusiones al digitar
const LONGITUD_CODIGO = 12;

/**
 * Adaptador de salida: representación criptográfica y gráfica del boleto.
 *  - Firma: HMAC-SHA256(clave secreta del evento, datos inmutables de la orden + asiento).
 *  - Código de redención: 12 caracteres alfanuméricos aleatorios (CSPRNG).
 *  - Representación gráfica: QR en SVG como data URL.
 */
export class GeneradorBoletoCriptografico implements GeneradorBoletoPort {
  async generar(s: SolicitudBoleto): Promise<MaterialBoleto> {
    const firmaHash = this.firmar(s.evento.claveSecreta, s.orden.datosInmutables(s.asientoId));
    const codigoRedencion = this.nuevoCodigo();
    const contenidoQr = `STAGEPASS|${s.boletoId}|${codigoRedencion}|${firmaHash.slice(0, 16)}`;
    const svg = await QRCode.toString(contenidoQr, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return {
      codigoRedencion,
      firmaHash,
      representacionGrafica: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    };
  }

  verificarFirma(boleto: Boleto, orden: Orden, evento: Evento): boolean {
    const esperada = Buffer.from(this.firmar(evento.claveSecreta, orden.datosInmutables(boleto.asientoId)), "hex");
    const recibida = Buffer.from(boleto.firmaHash, "hex");
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
  }

  private firmar(clave: string, datos: string): string {
    return createHmac("sha256", clave).update(datos).digest("hex");
  }

  private nuevoCodigo(): string {
    let codigo = "";
    for (let i = 0; i < LONGITUD_CODIGO; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
    return codigo;
  }
}
