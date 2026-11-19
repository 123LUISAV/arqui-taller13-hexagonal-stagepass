import { Asiento } from "../../../../domain/asiento.js";
import { CodigoUbicacion } from "../../../../domain/codigo-ubicacion.js";
import { Dinero } from "../../../../domain/dinero.js";
import { EstadoEvento, TipoEvento } from "../../../../domain/estados.js";
import { Evento } from "../../../../domain/evento.js";
import { Recinto } from "../../../../domain/recinto.js";

export interface Semilla {
  recintos: Recinto[];
  eventos: Evento[];
  asientos: Asiento[];
}

interface Zona {
  prefijo: string;
  filas: string[]; // vacío = numeración corrida (General-01...)
  porFila: number;
  precio: number;
}

const DIA = 86_400_000;

/** Datos maestros de ejemplo: los mismos que carga docker/mysql/init.sql (se genera desde aquí). */
export function crearSemilla(ahora: Date): Semilla {
  const recintos = [
    new Recinto("rec-arena", "Arena StagePass", "Bogotá", 40),
    new Recinto("rec-teatro", "Teatro Santander", "Bucaramanga", 24),
    new Recinto("rec-parque", "Parque del Agua", "Bucaramanga", 40),
  ];
  const zonasPorRecinto: Record<string, Zona[]> = {
    "rec-arena": [
      { prefijo: "VIP", filas: ["A", "B"], porFila: 4, precio: 480_000 },
      { prefijo: "General", filas: [], porFila: 32, precio: 150_000 },
    ],
    "rec-teatro": [
      { prefijo: "VIP", filas: ["A"], porFila: 6, precio: 220_000 },
      { prefijo: "General", filas: [], porFila: 18, precio: 95_000 },
    ],
    "rec-parque": [
      { prefijo: "VIP", filas: ["A", "B"], porFila: 4, precio: 350_000 },
      { prefijo: "General", filas: [], porFila: 32, precio: 130_000 },
    ],
  };

  const asientos: Asiento[] = [];
  for (const recinto of recintos) {
    for (const z of zonasPorRecinto[recinto.id] ?? []) {
      if (z.filas.length === 0) {
        for (let n = 1; n <= z.porFila; n++) {
          const codigo = `${z.prefijo}-${String(n).padStart(2, "0")}`;
          asientos.push(new Asiento(`${recinto.id}:${codigo}`, recinto.id, CodigoUbicacion.de(codigo), Dinero.cop(z.precio)));
        }
      } else {
        for (const fila of z.filas) {
          for (let n = 1; n <= z.porFila; n++) {
            const codigo = `${z.prefijo}-${fila}${n}`;
            asientos.push(new Asiento(`${recinto.id}:${codigo}`, recinto.id, CodigoUbicacion.de(codigo), Dinero.cop(z.precio)));
          }
        }
      }
    }
  }

  const eventos = [
    new Evento("evt-rock", "Noche de Rock Sinfónico", TipoEvento.Concierto, "rec-arena", new Date(ahora.getTime() + 30 * DIA), EstadoEvento.Programado, "clave-evt-rock-2026"),
    new Evento("evt-hamlet", "Hamlet - Compañía Nacional", TipoEvento.Teatro, "rec-teatro", new Date(ahora.getTime() + 15 * DIA), EstadoEvento.Programado, "clave-evt-hamlet-2026"),
    new Evento("evt-raices", "Festival Raíces del Oriente", TipoEvento.Festival, "rec-parque", new Date(ahora.getTime() + 60 * DIA), EstadoEvento.Programado, "clave-evt-raices-2026"),
  ];
  return { recintos, eventos, asientos };
}
