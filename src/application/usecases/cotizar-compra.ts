import { CalculadoraTarifas } from "../../domain/calculadora-tarifas.js";
import type { Liquidacion } from "../../domain/orden.js";
import type { CotizarCompra, SolicitudCotizacion } from "../ports/in/casos-de-uso.js";
import type { AsientoRepository, EventoRepository } from "../ports/out/repositorios-legacy.js";
import type { Clock } from "../ports/out/utilidades.js";
import { resolverSeleccion } from "./seleccion-asientos.js";

export class CotizarCompraService implements CotizarCompra {
  constructor(
    private readonly eventos: EventoRepository,
    private readonly asientos: AsientoRepository,
    private readonly calculadora: CalculadoraTarifas,
    private readonly clock: Clock,
  ) {}

  async ejecutar(s: SolicitudCotizacion): Promise<Liquidacion> {
    const { asientos, valorBase } = await resolverSeleccion(this.eventos, this.asientos, s.eventoId, s.asientoIds, this.clock.ahora());
    return this.calculadora.calcular(valorBase, asientos.length);
  }
}
