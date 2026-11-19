import { CalculadoraTarifas } from "../src/domain/calculadora-tarifas.js";
import { LimiteBoletasPorEvento } from "../src/domain/limite-boletas.js";
import { PoliticaBloqueo } from "../src/domain/politica-bloqueo.js";
import { ConfirmarPagoService } from "../src/application/usecases/confirmar-pago.js";
import { ConsultarEventosService } from "../src/application/usecases/consultar-eventos.js";
import { ConsultarOrdenService, VerificarBoletoService } from "../src/application/usecases/consultar-orden.js";
import { CotizarCompraService } from "../src/application/usecases/cotizar-compra.js";
import { ExpirarReservasService } from "../src/application/usecases/expirar-reservas.js";
import { IniciarCompraService } from "../src/application/usecases/iniciar-compra.js";
import { IniciarPagoService } from "../src/application/usecases/iniciar-pago.js";
import type { Clock, GeneradorIds, Logger } from "../src/application/ports/out/utilidades.js";
import { GeneradorBoletoCriptografico } from "../src/infrastructure/adapters/out/boletos/generador-boleto-criptografico.js";
import { FacturacionDianMock } from "../src/infrastructure/adapters/out/dian/facturacion-dian-mock.js";
import { crearSemilla } from "../src/infrastructure/adapters/out/memoria/datos-semilla.js";
import {
  BoletoRepositoryMemoria,
  ClienteRepositoryMemoria,
  OrdenRepositoryMemoria,
  repositoriosLegacyMemoria,
} from "../src/infrastructure/adapters/out/memoria/repositorios-memoria.js";
import { SendGridMock, WhatsAppMock } from "../src/infrastructure/adapters/out/notificaciones/notificaciones-mock.js";
import { PasarelaPayPalMock, PasarelaPseMock, PasarelaWompiMock } from "../src/infrastructure/adapters/out/pagos/pasarelas-mock.js";
import { ResolutorPasarelasEnMapa } from "../src/infrastructure/adapters/out/pagos/resolutor-pasarelas.js";

/** Reloj controlable: las pruebas avanzan el tiempo sin esperar. */
export class RelojFalso implements Clock {
  constructor(private actual = new Date("2026-11-18T10:00:00Z")) {}
  ahora() { return new Date(this.actual); }
  avanzarMinutos(m: number) { this.actual = new Date(this.actual.getTime() + m * 60_000); }
}

export class IdsSecuenciales implements GeneradorIds {
  private n = 0;
  nuevo(prefijo: string) { return `${prefijo}_${++this.n}`; }
}

export const loggerSilencioso: Logger = { info() {}, warn() {} };

export const clienteDatos = (correo = "luisa@example.com") => ({
  nombreCompleto: "Luisa Fernanda Velandia",
  correo,
  telefonoMovil: "+573001234567",
  nacionalidad: "Colombiana",
});

/** Ensambla el núcleo completo con adaptadores en memoria y mocks (sin Express ni Mongo). */
export function armarSistema(bloqueoMinutos = 10) {
  const reloj = new RelojFalso();
  const ids = new IdsSecuenciales();
  const semilla = crearSemilla(reloj.ahora());
  const { recintos, eventos, asientos } = repositoriosLegacyMemoria(semilla);
  const ordenes = new OrdenRepositoryMemoria();
  const boletos = new BoletoRepositoryMemoria();
  const clientes = new ClienteRepositoryMemoria();
  const paypal = new PasarelaPayPalMock();
  const wompi = new PasarelaWompiMock();
  const pse = new PasarelaPseMock();
  const pasarelas = new ResolutorPasarelasEnMapa([paypal, wompi, pse]);
  const generador = new GeneradorBoletoCriptografico();
  const whatsapp = new WhatsAppMock(loggerSilencioso);
  const correo = new SendGridMock(loggerSilencioso);
  const calculadora = new CalculadoraTarifas();

  return {
    reloj, ordenes, boletos, asientos, eventos, clientes, whatsapp, correo, generador, pasarelas, paypal, wompi, pse,
    consultarEventos: new ConsultarEventosService(eventos, recintos, asientos),
    cotizar: new CotizarCompraService(eventos, asientos, calculadora, reloj),
    iniciarCompra: new IniciarCompraService(eventos, asientos, ordenes, clientes, calculadora, new PoliticaBloqueo(bloqueoMinutos), new LimiteBoletasPorEvento(), reloj, ids),
    iniciarPago: new IniciarPagoService(ordenes, pasarelas, reloj),
    confirmarPago: new ConfirmarPagoService(pasarelas, ordenes, boletos, asientos, eventos, generador, [whatsapp, correo], new FacturacionDianMock(reloj), reloj, ids, loggerSilencioso),
    expirar: new ExpirarReservasService(ordenes, asientos, eventos, reloj, loggerSilencioso),
    consultarOrden: new ConsultarOrdenService(ordenes, boletos),
    verificarBoleto: new VerificarBoletoService(boletos, ordenes, eventos, generador),
  };
}

export const ids = (recinto: string, ...codigos: string[]) => codigos.map((c) => `${recinto}:${c}`);
