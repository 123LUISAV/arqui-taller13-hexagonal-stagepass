/**
 * Raíz de composición: la única pieza que conoce el núcleo Y la infraestructura.
 * Aquí se eligen los adaptadores concretos (según variables de entorno) y se inyectan en los casos de uso.
 */
import { CalculadoraTarifas } from "./domain/calculadora-tarifas.js";
import { LimiteBoletasPorEvento } from "./domain/limite-boletas.js";
import { PoliticaBloqueo } from "./domain/politica-bloqueo.js";
import { ConfirmarPagoService } from "./application/usecases/confirmar-pago.js";
import { ConsultarEventosService } from "./application/usecases/consultar-eventos.js";
import { ConsultarOrdenService, VerificarBoletoService } from "./application/usecases/consultar-orden.js";
import { CotizarCompraService } from "./application/usecases/cotizar-compra.js";
import { ExpirarReservasService } from "./application/usecases/expirar-reservas.js";
import { IniciarCompraService } from "./application/usecases/iniciar-compra.js";
import { IniciarPagoService } from "./application/usecases/iniciar-pago.js";
import type { Clock, GeneradorIds, Logger } from "./application/ports/out/utilidades.js";
import type { AsientoRepository, EventoRepository, RecintoRepository } from "./application/ports/out/repositorios-legacy.js";
import type { BoletoRepository, ClienteRepository, OrdenRepository } from "./application/ports/out/repositorios-documentales.js";
import { crearAppWeb } from "./infrastructure/adapters/in/web/servidor-web.js";
import { GeneradorBoletoCriptografico } from "./infrastructure/adapters/out/boletos/generador-boleto-criptografico.js";
import { FacturacionDianMock } from "./infrastructure/adapters/out/dian/facturacion-dian-mock.js";
import { crearSemilla } from "./infrastructure/adapters/out/memoria/datos-semilla.js";
import { repositoriosLegacyMemoria } from "./infrastructure/adapters/out/memoria/repositorios-memoria.js";
import { conectarMongo, iniciarMongoEnMemoria, type ConexionMongo } from "./infrastructure/adapters/out/mongodb/conexion.js";
import { repositoriosMongo } from "./infrastructure/adapters/out/mongodb/repositorios-mongo.js";
import { repositoriosMysql } from "./infrastructure/adapters/out/mysql/repositorios-mysql.js";
import { SendGridMock, WhatsAppMock } from "./infrastructure/adapters/out/notificaciones/notificaciones-mock.js";
import { PasarelaPayPalMock, PasarelaPseMock, PasarelaWompiMock } from "./infrastructure/adapters/out/pagos/pasarelas-mock.js";
import { ResolutorPasarelasEnMapa } from "./infrastructure/adapters/out/pagos/resolutor-pasarelas.js";
import { GeneradorIdsUuid, LoggerConsola, RelojSistema } from "./infrastructure/adapters/out/sistema/sistema.js";

export interface Configuracion {
  puerto: number;
  bloqueoMinutos: number;
  intervaloExpiracionSeg: number;
  mongoUrl?: string;
  mysqlUrl?: string;
  silencioso?: boolean;
  reloj?: Clock;
  ids?: GeneradorIds;
}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  return {
    puerto: Number(env.PORT ?? 3000),
    bloqueoMinutos: Number(env.BLOQUEO_MINUTOS ?? 10),
    intervaloExpiracionSeg: Number(env.EXPIRACION_INTERVALO_SEG ?? 5),
    mongoUrl: env.MONGO_URL || undefined,
    mysqlUrl: env.MYSQL_URL || undefined,
  };
}

export async function construirAplicacion(cfg: Configuracion) {
  const log: Logger = new LoggerConsola(cfg.silencioso);
  const reloj: Clock = cfg.reloj ?? new RelojSistema();
  const ids: GeneradorIds = cfg.ids ?? new GeneradorIdsUuid();
  const cierres: Array<() => Promise<void>> = [];

  // --- Adaptadores secundarios: sistema legacy (MySQL real o sustituto en memoria) ---
  let recintos: RecintoRepository, eventos: EventoRepository, asientos: AsientoRepository;
  let legacy: string;
  if (cfg.mysqlUrl) {
    const { createPool } = await import("mysql2/promise");
    const pool = createPool(cfg.mysqlUrl);
    ({ recintos, eventos, asientos } = repositoriosMysql(pool));
    cierres.push(() => pool.end());
    legacy = "MySQL real (mysql2)";
  } else {
    ({ recintos, eventos, asientos } = repositoriosLegacyMemoria(crearSemilla(reloj.ahora())));
    legacy = "memoria (sustituto del MySQL legacy)";
  }

  // --- Adaptadores secundarios: MongoDB (real; efímero con mongodb-memory-server si no hay MONGO_URL) ---
  const conexion: ConexionMongo = cfg.mongoUrl ? await conectarMongo(cfg.mongoUrl) : await iniciarMongoEnMemoria();
  cierres.push(() => conexion.cerrar());
  const { ordenes, boletos, clientes } = await repositoriosMongo(conexion.db);
  const documental: [OrdenRepository, BoletoRepository, ClienteRepository] = [ordenes, boletos, clientes];

  // --- Pasarelas, notificaciones, facturación y generador de boletos ---
  const paypal = new PasarelaPayPalMock();
  const wompi = new PasarelaWompiMock();
  const pse = new PasarelaPseMock();
  const pasarelas = new ResolutorPasarelasEnMapa([paypal, wompi, pse]);
  const generador = new GeneradorBoletoCriptografico();
  const notificadores = [new WhatsAppMock(log), new SendGridMock(log)];
  const facturacion = new FacturacionDianMock(reloj);

  // --- Servicios de dominio ---
  const calculadora = new CalculadoraTarifas();
  const politica = new PoliticaBloqueo(cfg.bloqueoMinutos);
  const limite = new LimiteBoletasPorEvento();

  // --- Casos de uso ---
  const expirarReservas = new ExpirarReservasService(documental[0], asientos, eventos, reloj, log);
  const app = crearAppWeb({
    consultarEventos: new ConsultarEventosService(eventos, recintos, asientos),
    cotizarCompra: new CotizarCompraService(eventos, asientos, calculadora, reloj),
    iniciarCompra: new IniciarCompraService(eventos, asientos, ordenes, clientes, calculadora, politica, limite, reloj, ids),
    iniciarPago: new IniciarPagoService(ordenes, pasarelas, reloj),
    confirmarPago: new ConfirmarPagoService(pasarelas, ordenes, boletos, asientos, eventos, generador, notificadores, facturacion, reloj, ids, log),
    consultarOrden: new ConsultarOrdenService(ordenes, boletos),
    verificarBoleto: new VerificarBoletoService(boletos, ordenes, eventos, generador),
    pasarelas,
    simuladores: [paypal, wompi, pse],
  });

  // --- Adaptador primario programado: dispara la expiración de reservas ---
  const temporizador = setInterval(() => {
    expirarReservas.ejecutar().catch((e) => log.warn(`Fallo al expirar reservas: ${(e as Error).message}`));
  }, cfg.intervaloExpiracionSeg * 1000);
  temporizador.unref();

  return {
    app,
    resumen: { legacy, mongo: conexion.origen, bloqueoMinutos: cfg.bloqueoMinutos },
    expirarReservas,
    notificadores,
    cerrar: async () => {
      clearInterval(temporizador);
      for (const c of cierres) await c();
    },
  };
}
