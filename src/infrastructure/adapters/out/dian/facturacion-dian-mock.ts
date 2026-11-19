import { createHash } from "node:crypto";
import type { Orden } from "../../../../domain/orden.js";
import type { ComprobanteFiscal } from "../../../../domain/pagos.js";
import type { FacturacionElectronicaPort } from "../../../../application/ports/out/servicios-externos.js";
import type { Clock } from "../../../../application/ports/out/utilidades.js";

/** Mock de facturación electrónica DIAN: numera y calcula un CUFE de ejemplo (SHA-384), sin llamar a la DIAN. */
export class FacturacionDianMock implements FacturacionElectronicaPort {
  private consecutivo = 0;
  constructor(private readonly clock: Clock) {}

  async emitir(orden: Orden): Promise<ComprobanteFiscal> {
    this.consecutivo++;
    const numero = `SETP${String(this.consecutivo).padStart(6, "0")}`;
    const cufe = createHash("sha384").update(`${numero}|${orden.id}|${orden.montoTotal.monto}`).digest("hex");
    return { numero, cufe, emitidoEn: this.clock.ahora() };
  }
}
