import { LimiteBoletasExcedido } from "./errores.js";

/** Un cliente no puede acumular más de 6 boletas para un mismo evento. */
export class LimiteBoletasPorEvento {
  static readonly MAXIMO = 6;

  verificar(yaAcumuladas: number, solicitadas: number): void {
    if (yaAcumuladas + solicitadas > LimiteBoletasPorEvento.MAXIMO) {
      throw new LimiteBoletasExcedido(LimiteBoletasPorEvento.MAXIMO, yaAcumuladas, solicitadas);
    }
  }
}
