import { PasarelaNoSoportada } from "../../../../domain/errores.js";
import type { NombrePasarela } from "../../../../domain/estados.js";
import type { PasarelaPagoPort, ResolutorPasarelas } from "../../../../application/ports/out/servicios-externos.js";

export class ResolutorPasarelasEnMapa implements ResolutorPasarelas {
  private readonly mapa = new Map<string, PasarelaPagoPort>();
  constructor(pasarelas: PasarelaPagoPort[]) {
    pasarelas.forEach((p) => this.mapa.set(p.nombre, p));
  }
  obtener(nombre: string): PasarelaPagoPort {
    const p = this.mapa.get(nombre.toLowerCase());
    if (!p) throw new PasarelaNoSoportada(nombre);
    return p;
  }
  disponibles(): NombrePasarela[] {
    return [...this.mapa.keys()] as NombrePasarela[];
  }
}
