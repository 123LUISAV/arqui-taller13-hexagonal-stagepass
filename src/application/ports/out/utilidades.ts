/** Reloj inyectable: permite probar expiraciones sin esperar. */
export interface Clock {
  ahora(): Date;
}

export interface GeneradorIds {
  nuevo(prefijo: string): string;
}

export interface Logger {
  info(mensaje: string): void;
  warn(mensaje: string): void;
}
