export const TipoEvento = { Concierto: "CONCIERTO", Teatro: "TEATRO", Festival: "FESTIVAL" } as const;
export type TipoEvento = (typeof TipoEvento)[keyof typeof TipoEvento];

export const EstadoEvento = { Programado: "PROGRAMADO", Agotado: "AGOTADO", Cancelado: "CANCELADO" } as const;
export type EstadoEvento = (typeof EstadoEvento)[keyof typeof EstadoEvento];

export const EstadoAsiento = { Disponible: "DISPONIBLE", Bloqueado: "BLOQUEADO", Vendido: "VENDIDO" } as const;
export type EstadoAsiento = (typeof EstadoAsiento)[keyof typeof EstadoAsiento];

export const EstadoOrden = {
  PendientePago: "PENDIENTE_PAGO",
  Aprobada: "APROBADA",
  Rechazada: "RECHAZADA",
  Expirada: "EXPIRADA",
} as const;
export type EstadoOrden = (typeof EstadoOrden)[keyof typeof EstadoOrden];

export const NombrePasarela = { PayPal: "paypal", Wompi: "wompi", PSE: "pse" } as const;
export type NombrePasarela = (typeof NombrePasarela)[keyof typeof NombrePasarela];
