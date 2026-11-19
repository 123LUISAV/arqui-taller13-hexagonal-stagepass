// Modelo del diagrama de clases (fuente única para draw.io, SVG y Mermaid).
// kind: class | interface | enum | vo
// pkg: dominio | pin | pout | uc | apri | asec

export const PAQUETES = {
  dominio: { titulo: "Dominio (núcleo)", fill: "#fff2cc", stroke: "#d6b656" },
  pin: { titulo: "Puertos de entrada (application/ports/in)", fill: "#dae8fc", stroke: "#6c8ebf" },
  uc: { titulo: "Casos de uso (application/usecases)", fill: "#d5e8d4", stroke: "#82b366" },
  pout: { titulo: "Puertos de salida (application/ports/out)", fill: "#e1d5e7", stroke: "#9673a6" },
  apri: { titulo: "Adaptadores primarios (infrastructure/adapters/in)", fill: "#f8cecc", stroke: "#b85450" },
  asec: { titulo: "Adaptadores secundarios (infrastructure/adapters/out)", fill: "#ffe6cc", stroke: "#d79b00" },
};

// col/row: posición en la rejilla del paquete.
export const CLASES = [
  // ---------------- DOMINIO ----------------
  { id: "Evento", pkg: "dominio", col: 0, row: 0, attrs: ["id: string", "nombre: string", "tipo: TipoEvento", "recintoId: string", "fechaHora: Date", "estado: EstadoEvento", "claveSecreta: string"], methods: ["exigirVentaAbierta(ahora): void", "marcarAgotado(): void", "reabrirVenta(): void", "cancelar(): void"] },
  { id: "Asiento", pkg: "dominio", col: 1, row: 0, attrs: ["id: string", "recintoId: string", "codigo: CodigoUbicacion", "precioBase: Dinero", "estado: EstadoAsiento"], methods: ["estaDisponible(): boolean", "bloquear(): void", "vender(): void", "liberar(): void"] },
  { id: "Recinto", pkg: "dominio", col: 2, row: 0, attrs: ["id: string", "nombre: string", "ciudad: string", "aforo: number"], methods: [] },
  { id: "Cliente", pkg: "dominio", col: 0, row: 1, attrs: ["id: string", "nombreCompleto: string", "correo: string", "telefonoMovil: string", "nacionalidad: string"], methods: [] },
  { id: "Orden", pkg: "dominio", col: 1, row: 1, attrs: ["id: string", "cliente: Cliente", "eventoId: string", "asientos: ItemOrden[]", "liquidacion: Liquidacion", "creadaEn: Date", "expiraEn: Date", "estado: EstadoOrden", "pasarela?: NombrePasarela", "referenciaPago?: string"], methods: ["crear(datos): Orden", "asignarPago(pasarela, ref): void", "aprobar(): void", "rechazar(): void", "expirar(): void", "haExpirado(ahora): boolean", "datosInmutables(asientoId): string"] },
  { id: "Boleto", pkg: "dominio", col: 2, row: 1, attrs: ["id: string", "ordenId: string", "eventoId: string", "asientoId: string", "codigoUbicacion: string", "codigoRedencion: string", "firmaHash: string", "fechaEmision: Date", "representacionGrafica: string"], methods: [] },
  { id: "ItemOrden", pkg: "dominio", kind: "vo", col: 0, row: 2, attrs: ["asientoId: string", "codigoUbicacion: string", "precioBase: Dinero"], methods: [] },
  { id: "Liquidacion", pkg: "dominio", kind: "vo", col: 1, row: 2, attrs: ["valorBase: Dinero", "tarifaServicio: Dinero", "descuento: Dinero", "montoTotal: Dinero", "porcentajeTarifa: number", "porcentajeDescuento: number"], methods: [] },
  { id: "Dinero", pkg: "dominio", kind: "vo", col: 2, row: 2, attrs: ["monto: number"], methods: ["cop(monto): Dinero", "sumar(otro): Dinero", "restar(otro): Dinero", "porcentaje(pct): Dinero", "igual(otro): boolean"] },
  { id: "CodigoUbicacion", pkg: "dominio", kind: "vo", col: 0, row: 3, attrs: ["valor: string"], methods: ["de(valor): CodigoUbicacion", "zona: string"] },
  { id: "CalculadoraTarifas", pkg: "dominio", col: 1, row: 3, attrs: [], methods: ["calcular(valorBase, cantidad): Liquidacion"] },
  { id: "PoliticaBloqueo", pkg: "dominio", col: 2, row: 3, attrs: ["minutos: number = 10"], methods: ["calcularExpiracion(ahora): Date"] },
  { id: "LimiteBoletasPorEvento", pkg: "dominio", col: 0, row: 4, attrs: ["MAXIMO = 6"], methods: ["verificar(acumuladas, nuevas): void"] },
  { id: "ErrorNegocio", pkg: "dominio", col: 1, row: 4, attrs: ["codigo: string"], methods: ["Subclases: DatosInvalidos,", "EventoNoEncontrado, EventoNoDisponible,", "AsientoNoDisponible, CantidadInvalida,", "LimiteBoletasExcedido, TransicionInvalida,", "OrdenNoEncontrada, PasarelaNoSoportada,", "PagoNoVerificado"] },
  { id: "Estados", pkg: "dominio", kind: "enum", col: 2, row: 4, attrs: ["TipoEvento: CONCIERTO | TEATRO | FESTIVAL", "EstadoEvento: PROGRAMADO | AGOTADO | CANCELADO", "EstadoAsiento: DISPONIBLE | BLOQUEADO | VENDIDO", "EstadoOrden: PENDIENTE_PAGO | APROBADA |", "  RECHAZADA | EXPIRADA", "NombrePasarela: paypal | wompi | pse", "ResultadoPago: APROBADO | RECHAZADO | PENDIENTE"], methods: [] },
  { id: "NotificacionPago", pkg: "dominio", kind: "vo", col: 0, row: 5, attrs: ["pasarela: NombrePasarela", "referencia: string", "resultado: ResultadoPago", "montoPagado: Dinero"], methods: [] },
  { id: "RegistroPago", pkg: "dominio", kind: "vo", col: 1, row: 5, attrs: ["pasarela: NombrePasarela", "referencia: string", "urlPago: string"], methods: [] },
  { id: "ComprobanteFiscal", pkg: "dominio", kind: "vo", col: 2, row: 5, attrs: ["numero: string", "cufe: string", "emitidoEn: Date"], methods: [] },

  // ---------------- PUERTOS DE ENTRADA ----------------
  { id: "ConsultarEventos", pkg: "pin", kind: "interface", col: 0, row: 0, attrs: [], methods: ["listar(): VistaEvento[]", "obtener(eventoId): VistaEvento", "asientos(eventoId): Asiento[]"] },
  { id: "CotizarCompra", pkg: "pin", kind: "interface", col: 1, row: 0, attrs: [], methods: ["ejecutar(solicitud): Liquidacion"] },
  { id: "IniciarCompra", pkg: "pin", kind: "interface", col: 2, row: 0, attrs: [], methods: ["ejecutar(solicitud): Orden"] },
  { id: "IniciarPago", pkg: "pin", kind: "interface", col: 3, row: 0, attrs: [], methods: ["ejecutar(solicitud): RegistroPago"] },
  { id: "ConfirmarPago", pkg: "pin", kind: "interface", col: 4, row: 0, attrs: [], methods: ["ejecutar(solicitud): Orden | null"] },
  { id: "ExpirarReservas", pkg: "pin", kind: "interface", col: 5, row: 0, attrs: [], methods: ["ejecutar(): number"] },
  { id: "ConsultarOrden", pkg: "pin", kind: "interface", col: 6, row: 0, attrs: [], methods: ["ejecutar(ordenId): DetalleOrden"] },
  { id: "VerificarBoleto", pkg: "pin", kind: "interface", col: 7, row: 0, attrs: [], methods: ["ejecutar(codigo): ResultadoVerificacion"] },

  // ---------------- CASOS DE USO ----------------
  { id: "ConsultarEventosService", pkg: "uc", col: 0, row: 0, attrs: [], methods: ["listar()", "obtener(eventoId)", "asientos(eventoId)"] },
  { id: "CotizarCompraService", pkg: "uc", col: 1, row: 0, attrs: [], methods: ["ejecutar(solicitud)"] },
  { id: "IniciarCompraService", pkg: "uc", col: 2, row: 0, attrs: [], methods: ["ejecutar(solicitud)"] },
  { id: "IniciarPagoService", pkg: "uc", col: 3, row: 0, attrs: [], methods: ["ejecutar(solicitud)"] },
  { id: "ConfirmarPagoService", pkg: "uc", col: 4, row: 0, attrs: [], methods: ["ejecutar(solicitud)", "-rechazar(orden)", "-aprobar(orden)", "-pagoValido(orden, aviso, verif)", "-efectosSecundarios(orden, ...)"] },
  { id: "ExpirarReservasService", pkg: "uc", col: 5, row: 0, attrs: [], methods: ["ejecutar()"] },
  { id: "ConsultarOrdenService", pkg: "uc", col: 6, row: 0, attrs: [], methods: ["ejecutar(ordenId)"] },
  { id: "VerificarBoletoService", pkg: "uc", col: 7, row: 0, attrs: [], methods: ["ejecutar(codigo)"] },

  // ---------------- PUERTOS DE SALIDA ----------------
  { id: "RecintoRepository", pkg: "pout", kind: "interface", col: 0, row: 0, attrs: [], methods: ["listar(): Recinto[]", "buscarPorId(id): Recinto | null"] },
  { id: "EventoRepository", pkg: "pout", kind: "interface", col: 1, row: 0, attrs: [], methods: ["listar(): Evento[]", "buscarPorId(id): Evento | null", "guardar(evento): void"] },
  { id: "AsientoRepository", pkg: "pout", kind: "interface", col: 2, row: 0, attrs: [], methods: ["buscarPorRecinto(id): Asiento[]", "buscarPorIds(ids): Asiento[]", "cambiarEstadoSiEs(ids, desde, hacia): boolean", "contarPorEstado(recintoId): Record"] },
  { id: "OrdenRepository", pkg: "pout", kind: "interface", col: 3, row: 0, attrs: [], methods: ["guardar(orden): void", "buscarPorId(id): Orden | null", "buscarPorReferenciaPago(p, ref): Orden | null", "buscarPendientesVencidas(ahora): Orden[]", "contarAsientosActivos(cli, evt): number"] },
  { id: "BoletoRepository", pkg: "pout", kind: "interface", col: 4, row: 0, attrs: [], methods: ["guardarTodos(boletos): void", "buscarPorOrden(ordenId): Boleto[]", "buscarPorCodigo(codigo): Boleto | null"] },
  { id: "ClienteRepository", pkg: "pout", kind: "interface", col: 5, row: 0, attrs: [], methods: ["buscarPorCorreo(correo): Cliente | null", "guardar(cliente): void"] },
  { id: "PasarelaPagoPort", pkg: "pout", kind: "interface", col: 6, row: 0, attrs: ["nombre: NombrePasarela"], methods: ["registrarPago(orden): RegistroPago", "interpretarNotificacion(cuerpo): NotificacionPago", "verificarTransaccion(ref): NotificacionPago"] },
  { id: "ResolutorPasarelas", pkg: "pout", kind: "interface", col: 7, row: 0, attrs: [], methods: ["obtener(nombre): PasarelaPagoPort", "disponibles(): NombrePasarela[]"] },
  { id: "GeneradorBoletoPort", pkg: "pout", kind: "interface", col: 0, row: 1, attrs: [], methods: ["generar(solicitud): MaterialBoleto", "verificarFirma(boleto, orden, evento): boolean"] },
  { id: "NotificacionPort", pkg: "pout", kind: "interface", col: 1, row: 1, attrs: ["canal: CanalNotificacion"], methods: ["enviar(mensaje): void"] },
  { id: "FacturacionElectronicaPort", pkg: "pout", kind: "interface", col: 2, row: 1, attrs: [], methods: ["emitir(orden): ComprobanteFiscal"] },
  { id: "Clock", pkg: "pout", kind: "interface", col: 3, row: 1, attrs: [], methods: ["ahora(): Date"] },
  { id: "GeneradorIds", pkg: "pout", kind: "interface", col: 4, row: 1, attrs: [], methods: ["nuevo(prefijo): string"] },
  { id: "Logger", pkg: "pout", kind: "interface", col: 5, row: 1, attrs: [], methods: ["info(mensaje): void", "warn(mensaje): void"] },

  // ---------------- ADAPTADORES PRIMARIOS ----------------
  { id: "ServidorWeb", pkg: "apri", col: 0, row: 0, attrs: ["app: Express"], methods: ["crearAppWeb(dependencias)", "GET /api/eventos, /api/eventos/:id/asientos", "POST /api/cotizaciones, /api/compras", "POST /api/ordenes/:id/pago", "GET /api/ordenes/:id, /api/boletos/:c/verificar"] },
  { id: "WebhookPagos", pkg: "apri", col: 1, row: 0, attrs: [], methods: ["POST /webhooks/pagos/:pasarela", "(recibe notificaciones asíncronas)"] },
  { id: "SchedulerExpiracion", pkg: "apri", col: 2, row: 0, attrs: ["intervalo: setInterval"], methods: ["ejecutar ExpirarReservas cada N s"] },

  // ---------------- ADAPTADORES SECUNDARIOS ----------------
  { id: "OrdenRepositoryMongo", pkg: "asec", col: 3, row: 0, attrs: ["col: Collection<OrdenDoc>"], methods: ["(implementa OrdenRepository)", "aDoc() / aDominio()"] },
  { id: "BoletoRepositoryMongo", pkg: "asec", col: 4, row: 0, attrs: ["col: Collection<BoletoDoc>"], methods: ["(implementa BoletoRepository)", "índice único codigoRedencion"] },
  { id: "ClienteRepositoryMongo", pkg: "asec", col: 5, row: 0, attrs: ["col: Collection<ClienteDoc>"], methods: ["(implementa ClienteRepository)"] },
  { id: "RecintoRepositoryMysql", pkg: "asec", col: 0, row: 0, attrs: ["pool: Pool (mysql2)"], methods: ["(implementa RecintoRepository)"] },
  { id: "EventoRepositoryMysql", pkg: "asec", col: 1, row: 0, attrs: ["pool: Pool (mysql2)"], methods: ["(implementa EventoRepository)"] },
  { id: "AsientoRepositoryMysql", pkg: "asec", col: 2, row: 0, attrs: ["pool: Pool (mysql2)"], methods: ["(implementa AsientoRepository)", "UPDATE condicional transaccional"] },
  { id: "ReposMemoria", pkg: "asec", col: 6, row: 0, attrs: [], methods: ["Recinto/Evento/AsientoRepositoryMemoria", "Orden/Boleto/ClienteRepositoryMemoria", "(sustituto legacy y fakes de prueba)"] },
  { id: "GeneradorBoletoCriptografico", pkg: "asec", col: 0, row: 1, attrs: ["ALFABETO: string"], methods: ["generar(solicitud): MaterialBoleto", "verificarFirma(boleto, orden, evento)", "-firmar(clave, datos): HMAC-SHA256", "-nuevoCodigo(): string (CSPRNG)"] },
  { id: "PasarelaMockBase", pkg: "asec", col: 1, row: 1, attrs: ["transacciones: Map"], methods: ["registrarPago(orden)", "interpretarNotificacion(cuerpo)", "verificarTransaccion(ref)", "simularNotificacion(ref, resultado)"] },
  { id: "PasarelaPayPalMock", pkg: "asec", col: 2, row: 1, attrs: ["DTO PayPalWebhook"], methods: ["traducirCuerpo(cuerpo)", "construirCuerpo(ref, monto, r)"] },
  { id: "PasarelaWompiMock", pkg: "asec", col: 3, row: 1, attrs: ["DTO WompiWebhook"], methods: ["traducirCuerpo(cuerpo)", "construirCuerpo(ref, monto, r)"] },
  { id: "PasarelaPseMock", pkg: "asec", col: 4, row: 1, attrs: ["DTO PseWebhook"], methods: ["traducirCuerpo(cuerpo)", "construirCuerpo(ref, monto, r)"] },
  { id: "ResolutorPasarelasEnMapa", pkg: "asec", col: 5, row: 1, attrs: ["mapa: Map"], methods: ["obtener(nombre)", "disponibles()"] },
  { id: "WhatsAppMock", pkg: "asec", col: 6, row: 1, attrs: ["enviados: Mensaje[]"], methods: ["enviar(mensaje)"] },
  { id: "SendGridMock", pkg: "asec", col: 0, row: 2, attrs: ["enviados: Mensaje[]"], methods: ["enviar(mensaje)"] },
  { id: "FacturacionDianMock", pkg: "asec", col: 1, row: 2, attrs: ["consecutivo: number"], methods: ["emitir(orden): ComprobanteFiscal"] },
  { id: "RelojSistema", pkg: "asec", col: 2, row: 2, attrs: [], methods: ["ahora(): Date"] },
  { id: "GeneradorIdsUuid", pkg: "asec", col: 3, row: 2, attrs: [], methods: ["nuevo(prefijo): string"] },
  { id: "LoggerConsola", pkg: "asec", col: 4, row: 2, attrs: [], methods: ["info(mensaje)", "warn(mensaje)"] },
];

// Relaciones. tipo: real (realización), dep (dependencia/uso), asoc (asociación), comp (composición)
const R = [];
const add = (tipo, de, a, etiqueta = "") => R.push({ tipo, de, a, etiqueta });

// Casos de uso realizan puertos de entrada
for (const n of ["ConsultarEventos", "CotizarCompra", "IniciarCompra", "IniciarPago", "ConfirmarPago", "ExpirarReservas", "ConsultarOrden", "VerificarBoleto"]) add("real", `${n}Service`, n);
// Adaptadores primarios usan puertos de entrada
add("dep", "ServidorWeb", "ConsultarEventos");
add("dep", "ServidorWeb", "CotizarCompra");
add("dep", "ServidorWeb", "IniciarCompra");
add("dep", "ServidorWeb", "IniciarPago");
add("dep", "ServidorWeb", "ConsultarOrden");
add("dep", "ServidorWeb", "VerificarBoleto");
add("dep", "WebhookPagos", "ConfirmarPago");
add("dep", "SchedulerExpiracion", "ExpirarReservas");
add("comp", "ServidorWeb", "WebhookPagos");
// Casos de uso dependen de puertos de salida
const usa = {
  ConsultarEventosService: ["EventoRepository", "RecintoRepository", "AsientoRepository"],
  CotizarCompraService: ["EventoRepository", "AsientoRepository", "Clock"],
  IniciarCompraService: ["EventoRepository", "AsientoRepository", "OrdenRepository", "ClienteRepository", "Clock", "GeneradorIds"],
  IniciarPagoService: ["OrdenRepository", "ResolutorPasarelas", "Clock"],
  ConfirmarPagoService: ["ResolutorPasarelas", "OrdenRepository", "BoletoRepository", "AsientoRepository", "EventoRepository", "GeneradorBoletoPort", "NotificacionPort", "FacturacionElectronicaPort", "Clock", "GeneradorIds", "Logger"],
  ExpirarReservasService: ["OrdenRepository", "AsientoRepository", "EventoRepository", "Clock", "Logger"],
  ConsultarOrdenService: ["OrdenRepository", "BoletoRepository"],
  VerificarBoletoService: ["BoletoRepository", "OrdenRepository", "EventoRepository", "GeneradorBoletoPort"],
};
for (const [uc, puertos] of Object.entries(usa)) for (const p of puertos) add("dep", uc, p);
// Casos de uso usan servicios de dominio
add("dep", "IniciarCompraService", "CalculadoraTarifas");
add("dep", "IniciarCompraService", "PoliticaBloqueo");
add("dep", "IniciarCompraService", "LimiteBoletasPorEvento");
add("dep", "CotizarCompraService", "CalculadoraTarifas");
// Adaptadores secundarios realizan puertos de salida
const realiza = {
  OrdenRepositoryMongo: "OrdenRepository",
  BoletoRepositoryMongo: "BoletoRepository",
  ClienteRepositoryMongo: "ClienteRepository",
  RecintoRepositoryMysql: "RecintoRepository",
  EventoRepositoryMysql: "EventoRepository",
  AsientoRepositoryMysql: "AsientoRepository",
  GeneradorBoletoCriptografico: "GeneradorBoletoPort",
  PasarelaMockBase: "PasarelaPagoPort",
  ResolutorPasarelasEnMapa: "ResolutorPasarelas",
  WhatsAppMock: "NotificacionPort",
  SendGridMock: "NotificacionPort",
  FacturacionDianMock: "FacturacionElectronicaPort",
  RelojSistema: "Clock",
  GeneradorIdsUuid: "GeneradorIds",
  LoggerConsola: "Logger",
};
for (const [a, p] of Object.entries(realiza)) add("real", a, p);
for (const p of ["PasarelaPayPalMock", "PasarelaWompiMock", "PasarelaPseMock"]) add("real", p, "PasarelaMockBase", "extiende");
// Modelo de dominio
add("comp", "Orden", "ItemOrden");
add("comp", "Orden", "Liquidacion");
add("asoc", "Orden", "Cliente");
add("asoc", "Asiento", "Dinero");
add("asoc", "Asiento", "CodigoUbicacion");
add("asoc", "Liquidacion", "Dinero");
add("asoc", "Evento", "Recinto", "se realiza en");
add("asoc", "Boleto", "Orden", "emitido por");
add("dep", "CalculadoraTarifas", "Liquidacion");
add("dep", "Evento", "Estados");
add("dep", "Orden", "Estados");
// Puertos de salida usan tipos del dominio
add("dep", "OrdenRepository", "Orden");
add("dep", "AsientoRepository", "Asiento");
add("dep", "EventoRepository", "Evento");
add("dep", "RecintoRepository", "Recinto");
add("dep", "BoletoRepository", "Boleto");
add("dep", "ClienteRepository", "Cliente");
add("dep", "PasarelaPagoPort", "NotificacionPago");
add("dep", "PasarelaPagoPort", "RegistroPago");
add("dep", "FacturacionElectronicaPort", "ComprobanteFiscal");
add("dep", "GeneradorBoletoPort", "Boleto");
export const RELACIONES = R;
