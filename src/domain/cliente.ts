import { DatosInvalidos } from "./errores.js";

export class Cliente {
  constructor(
    readonly id: string,
    readonly nombreCompleto: string,
    readonly correo: string,
    readonly telefonoMovil: string,
    readonly nacionalidad: string,
  ) {
    if (nombreCompleto.trim().length < 3) throw new DatosInvalidos("El nombre completo es obligatorio");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new DatosInvalidos("Correo electrónico inválido");
    if (!/^\+?\d{7,15}$/.test(telefonoMovil.replace(/[\s-]/g, ""))) throw new DatosInvalidos("Teléfono móvil inválido");
    if (nacionalidad.trim().length < 2) throw new DatosInvalidos("La nacionalidad es obligatoria");
  }
}
