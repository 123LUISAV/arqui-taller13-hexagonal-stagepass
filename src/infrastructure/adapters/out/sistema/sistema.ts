import { randomUUID } from "node:crypto";
import type { Clock, GeneradorIds, Logger } from "../../../../application/ports/out/utilidades.js";

export class RelojSistema implements Clock {
  ahora(): Date {
    return new Date();
  }
}

export class GeneradorIdsUuid implements GeneradorIds {
  nuevo(prefijo: string): string {
    return `${prefijo}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
}

export class LoggerConsola implements Logger {
  constructor(private readonly silencioso = false) {}
  info(mensaje: string): void {
    if (!this.silencioso) console.log(`[info] ${mensaje}`);
  }
  warn(mensaje: string): void {
    if (!this.silencioso) console.warn(`[warn] ${mensaje}`);
  }
}
