import { OrdenNoEncontrada } from "../../domain/errores.js";
import type { ConsultarOrden, DetalleOrden, ResultadoVerificacion, VerificarBoleto } from "../ports/in/casos-de-uso.js";
import type { BoletoRepository, OrdenRepository } from "../ports/out/repositorios-documentales.js";
import type { EventoRepository } from "../ports/out/repositorios-legacy.js";
import type { GeneradorBoletoPort } from "../ports/out/servicios-externos.js";

export class ConsultarOrdenService implements ConsultarOrden {
  constructor(
    private readonly ordenes: OrdenRepository,
    private readonly boletos: BoletoRepository,
  ) {}

  async ejecutar(ordenId: string): Promise<DetalleOrden> {
    const orden = await this.ordenes.buscarPorId(ordenId);
    if (!orden) throw new OrdenNoEncontrada(ordenId);
    return { orden, boletos: await this.boletos.buscarPorOrden(ordenId) };
  }
}

/** Validación de un boleto en el acceso: existe y su firma coincide con la orden y el evento. */
export class VerificarBoletoService implements VerificarBoleto {
  constructor(
    private readonly boletos: BoletoRepository,
    private readonly ordenes: OrdenRepository,
    private readonly eventos: EventoRepository,
    private readonly generador: GeneradorBoletoPort,
  ) {}

  async ejecutar(codigo: string): Promise<ResultadoVerificacion> {
    const boleto = await this.boletos.buscarPorCodigo(codigo);
    if (!boleto) return { valido: false, motivo: "Código de redención desconocido" };
    const orden = await this.ordenes.buscarPorId(boleto.ordenId);
    const evento = await this.eventos.buscarPorId(boleto.eventoId);
    if (!orden || !evento) return { valido: false, motivo: "Orden o evento no encontrados", boleto };
    const valido = this.generador.verificarFirma(boleto, orden, evento);
    return valido ? { valido, boleto } : { valido, motivo: "La firma de seguridad no coincide", boleto };
  }
}
