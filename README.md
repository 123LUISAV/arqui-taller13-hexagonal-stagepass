# StagePass Live — Event & Concert Platform

**Taller 13 · Arquitectura Hexagonal (Puertos y Adaptadores)**

| | |
|---|---|
| **Estudiante** | Luisa Fernanda Velandia Salamanca |
| **Código** | U00179371 |
| **Universidad** | Universidad Autónoma de Bucaramanga (UNAB) |
| **Asignatura** | Arquitectura de Software |
| **Docente** | MSc. Feisar Moreno |
| **Fecha** | Noviembre de 2026 |
| **Repositorio** | https://github.com/123LUISAV/arqui-taller13-hexagonal-stagepass |

## 1. Descripción

StagePass Live es una plataforma de venta y expedición de boletería digital para conciertos, festivales y teatro. El
sistema habla con servicios heterogéneos (pasarelas de pago, notificaciones, generación criptográfica de credenciales y
facturación electrónica) y convive con dos tecnologías de persistencia en transición: un **MySQL legacy** (recintos,
aforos y asientos) y un **MongoDB** (reservas activas y boletas emitidas).

Las reglas de negocio —tarifas dinámicas, bloqueo temporal de asientos y emisión de boletas— viven en un **núcleo
hexagonal** que no conoce ninguna tecnología: ni Express, ni SQL, ni MongoDB, ni librerías de QR. Todo lo externo se
conecta por **puertos** (interfaces) y se implementa en **adaptadores** (principio de inversión de dependencias, DIP).

### Reglas de negocio implementadas

| Regla | Dónde vive |
|---|---|
| Bloqueo temporal de asientos: 10 min (configurable con `BLOQUEO_MINUTOS`) y liberación automática si no llega el pago | `PoliticaBloqueo` + `ExpirarReservasService` |
| 1–2 boletos: tarifa administrativa 10 %, descuento 0 % | `CalculadoraTarifas` |
| 3–5 boletos: tarifa 8 %, descuento comercial 5 % | `CalculadoraTarifas` |
| Más de 5 (corporativa): tarifa fija 5 %, descuento 10 % | `CalculadoraTarifas` |
| Máximo 6 boletas acumuladas por cliente y evento | `LimiteBoletasPorEvento` + `OrdenRepository.contarAsientosActivos` |
| Boleto solo si el pago fue exitoso **y verificado** (consulta a la pasarela + monto igual al de la orden) | `ConfirmarPagoService` |
| Firma hash = HMAC-SHA256(clave secreta del evento, datos inmutables de la orden) | `Orden.datosInmutables()` + `GeneradorBoletoCriptografico` |

## 2. Cómo correrlo

Requisitos: **Node.js 22 o superior** (probado con Node 24) y conexión a internet solo la primera vez (el paquete
`mongodb-memory-server` descarga un binario de MongoDB).

```bash
npm install
npm run dev
```

Abrir http://localhost:3000. Con `npm run dev` no se necesita Docker ni bases externas:

- MongoDB: se levanta un `mongod` efímero con `mongodb-memory-server` (los datos se pierden al detener la app).
- Legacy (recintos/eventos/asientos): se usa un adaptador **en memoria** con los mismos datos semilla del `init.sql`.

Otros scripts:

```bash
npm run build      # compila a dist/ y copia la UI estática
npm start          # ejecuta dist/main.js
npm test           # Vitest (dominio, casos de uso, Mongo, e2e, arquitectura)
npm run typecheck  # tsc --noEmit
```

### Variables de entorno

| Variable | Por defecto | Efecto |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `BLOQUEO_MINUTOS` | `10` | Duración del bloqueo de asientos (admite decimales, p. ej. `0.5` para demo) |
| `EXPIRACION_INTERVALO_SEG` | `5` | Cada cuánto el scheduler ejecuta `ExpirarReservas` |
| `MONGO_URL` | _(vacío)_ | Si existe, usa ese MongoDB real; si no, `mongodb-memory-server` |
| `MYSQL_URL` | _(vacío)_ | Si existe, usa el adaptador MySQL real (`mysql2`); si no, el sustituto en memoria |

### Activar MySQL y MongoDB reales (Docker)

```bash
docker compose up -d
MYSQL_URL=mysql://stagepass:stagepass@localhost:3307/stagepass_legacy MONGO_URL=mongodb://localhost:27018 npm run dev
```

`docker/mysql/init.sql` crea el esquema y carga los datos semilla (se genera con `npx tsx scripts/generar-init-sql.ts`
desde la misma semilla del adaptador en memoria). **Nota honesta:** en la máquina de desarrollo no había Docker, por lo
que el adaptador MySQL está implementado y compila pero **no se ejecutó contra un servidor MySQL real**; el adaptador de
MongoDB sí se probó contra un `mongod` real (ver pruebas).

## 3. Ejemplos con curl

```bash
# 1. Eventos y asientos
curl -s localhost:3000/api/eventos
curl -s localhost:3000/api/eventos/evt-hamlet/asientos

# 2. Cotizar (el núcleo calcula tarifa, descuento y total)
curl -s -X POST localhost:3000/api/cotizaciones -H 'Content-Type: application/json' \
  -d '{"eventoId":"evt-hamlet","asientoIds":["rec-teatro:VIP-A1","rec-teatro:VIP-A2","rec-teatro:General-01"]}'

# 3. Iniciar la compra: bloquea los asientos y crea la orden PENDIENTE_PAGO
curl -s -X POST localhost:3000/api/compras -H 'Content-Type: application/json' \
  -d '{"eventoId":"evt-hamlet","asientoIds":["rec-teatro:VIP-A1","rec-teatro:VIP-A2","rec-teatro:General-01"],"cliente":{"nombreCompleto":"Luisa Velandia","correo":"luisa@example.com","telefonoMovil":"+573001234567","nacionalidad":"Colombiana"}}'

# 4. Elegir pasarela (paypal | wompi | pse) -> devuelve la referencia de pago
curl -s -X POST localhost:3000/api/ordenes/ORD_ID/pago -H 'Content-Type: application/json' -d '{"pasarela":"wompi"}'

# 5. (Solo demo) pedir al simulador el webhook que enviaría la pasarela
curl -s -X POST localhost:3000/api/simulador/pagos -H 'Content-Type: application/json' \
  -d '{"pasarela":"wompi","referencia":"WOMPI-XXXXXXXX","resultado":"APROBADO"}'

# 6. Webhook de la pasarela (cuerpo propio de Wompi)
curl -s -X POST localhost:3000/webhooks/pagos/wompi -H 'Content-Type: application/json' \
  -d '{"event":"transaction.updated","data":{"transaction":{"id":"WOMPI-XXXXXXXX","status":"APPROVED","amount_in_cents":55105000}}}'

# 7. Ver la orden y sus boletos, y verificar la firma de un boleto
curl -s localhost:3000/api/ordenes/ORD_ID
curl -s localhost:3000/api/boletos/CODIGO_REDENCION/verificar
```

Cuerpos de webhook propios de cada pasarela (los mapea cada adaptador al dominio):

```jsonc
// PayPal
{"event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"PAYPAL-XXXX","amount":{"value":"551050.00","currency_code":"COP"}}}
// PSE
{"ticketId":"PSE-XXXX","transactionState":"OK","transactionValue":551050,"bankName":"Banco de Pruebas"}
```

Importante: el webhook **no basta** para emitir boletos. El núcleo vuelve a consultar la transacción a la pasarela
(`verificarTransaccion`) y compara el monto con el de la orden; un webhook falsificado termina en orden `RECHAZADA` y los
asientos se liberan.

## 4. Arquitectura hexagonal

```
src/
├── domain/                      NÚCLEO: entidades, value objects, excepciones y reglas puras
├── application/
│   ├── ports/in/                Puertos primarios (interfaces de los casos de uso)
│   ├── ports/out/               Puertos secundarios (repositorios y servicios externos)
│   └── usecases/                Implementación de los casos de uso (solo dependen de puertos)
├── infrastructure/adapters/
│   ├── in/web/                  Adaptador primario Express: REST + webhook + UI estática (public/)
│   └── out/
│       ├── mongodb/             OrdenRepository, BoletoRepository, ClienteRepository  (REAL)
│       ├── boletos/             GeneradorBoletoCriptografico: HMAC-SHA256 + QR        (REAL)
│       ├── mysql/               Recinto/Evento/AsientoRepository                      (implementado, ver nota)
│       ├── memoria/             Sustitutos en memoria + datos semilla
│       ├── pagos/               Pasarelas PayPal, Wompi y PSE                         (MOCK)
│       ├── notificaciones/      WhatsApp y SendGrid                                   (MOCK)
│       ├── dian/                Facturación electrónica                               (MOCK)
│       └── sistema/             Reloj, generador de ids y logger
├── composicion.ts               Raíz de composición: ÚNICO lugar que conoce núcleo e infraestructura
└── main.ts                      Arranque del servidor
```

### Reglas de aislamiento

1. **Core** (`domain` + `application`): sin anotaciones de frameworks, sin `HttpRequest`, sin SQL, sin HTTP; solo
   excepciones de negocio, interfaces de casos de uso y de repositorios/servicios.
2. **Puertos** (`application/ports`): interfaces puras que hablan con tipos del dominio; ningún DTO de pasarela ni firma
   tecnológica. El cuerpo crudo de un webhook viaja como `unknown` y solo el adaptador de esa pasarela lo interpreta.
3. **Adaptadores** (`infrastructure`): conocen las tecnologías y traducen modelos técnicos (documentos Mongo, filas
   MySQL, DTO de pasarelas) al dominio; **no** contienen lógica de negocio ni alteran cálculos.

Esto se verifica automáticamente: `tests/arquitectura/aislamiento.test.ts` escanea los imports de `src/domain` y
`src/application` y falla si aparece `infrastructure`, `express`, `mongodb`, `mysql2`, `qrcode`, `node:http`, etc.

### Qué es real y qué es mock

| Adaptador | Estado |
|---|---|
| Web Express (REST, webhook, UI) | **Real** |
| MongoDB (órdenes, boletas, clientes) con el driver oficial | **Real** (probado con `mongodb-memory-server`) |
| Generador criptográfico de boletos (HMAC-SHA256 + QR + verificación) | **Real** |
| MySQL legacy (`mysql2`) + `init.sql` + `docker-compose.yml` | Implementado; no ejecutado contra MySQL real |
| Legacy en memoria | Real (modo por defecto) |
| PayPal, Wompi, PSE | **Mock** con DTO propios de cada pasarela |
| WhatsApp, SendGrid | **Mock** (registran en consola) |
| Facturación DIAN | **Mock** |

## 5. Diagramas

Archivos en `docs/diagramas/`:

- `stagepass-hexagonal-clases.drawio` — diagrama de clases UML editable con draw.io / diagrams.net (2 páginas: clases
  completo y vista hexagonal). Exportado en `stagepass-hexagonal-clases.png/.svg` y `stagepass-vista-hexagonal.png/.svg`.
- `mermaid/*.mmd` (+ `.svg`/`.png`) — el mismo modelo partido por paquetes, legible a tamaño completo.
- Todo se genera desde `scripts/modelo-diagramas.mjs` con `node scripts/generar-diagramas.mjs`.

### Vista hexagonal

![Vista hexagonal](docs/diagramas/stagepass-vista-hexagonal.png)

### Diagrama de clases completo

![Diagrama de clases](docs/diagramas/stagepass-hexagonal-clases.png)

### Dominio (Mermaid)

```mermaid
classDiagram
  direction TB
  class Evento {
    +id string
    +nombre string
    +tipo TipoEvento
    +recintoId string
    +fechaHora Date
    +estado EstadoEvento
    +claveSecreta string
    +exigirVentaAbierta(ahora) void
    +marcarAgotado() void
    +reabrirVenta() void
    +cancelar() void
  }
  class Asiento {
    +id string
    +recintoId string
    +codigo CodigoUbicacion
    +precioBase Dinero
    +estado EstadoAsiento
    +estaDisponible() boolean
    +bloquear() void
    +vender() void
    +liberar() void
  }
  class Recinto {
    +id string
    +nombre string
    +ciudad string
    +aforo number
  }
  class Cliente {
    +id string
    +nombreCompleto string
    +correo string
    +telefonoMovil string
    +nacionalidad string
  }
  class Orden {
    +id string
    +cliente Cliente
    +eventoId string
    +asientos ItemOrden[]
    +liquidacion Liquidacion
    +creadaEn Date
    +expiraEn Date
    +estado EstadoOrden
    +pasarela? NombrePasarela
    +referenciaPago? string
    +crear(datos) Orden
    +asignarPago(pasarela, ref) void
    +aprobar() void
    +rechazar() void
    +expirar() void
    +haExpirado(ahora) boolean
    +datosInmutables(asientoId) string
  }
  class Boleto {
    +id string
    +ordenId string
    +eventoId string
    +asientoId string
    +codigoUbicacion string
    +codigoRedencion string
    +firmaHash string
    +fechaEmision Date
    +representacionGrafica string
  }
  class ItemOrden {
    <<value object>>
    +asientoId string
    +codigoUbicacion string
    +precioBase Dinero
  }
  class Liquidacion {
    <<value object>>
    +valorBase Dinero
    +tarifaServicio Dinero
    +descuento Dinero
    +montoTotal Dinero
    +porcentajeTarifa number
    +porcentajeDescuento number
  }
  class Dinero {
    <<value object>>
    +monto number
    +cop(monto) Dinero
    +sumar(otro) Dinero
    +restar(otro) Dinero
    +porcentaje(pct) Dinero
    +igual(otro) boolean
  }
  class CodigoUbicacion {
    <<value object>>
    +valor string
    +de(valor) CodigoUbicacion
    zona string
  }
  class CalculadoraTarifas {
    +calcular(valorBase, cantidad) Liquidacion
  }
  class PoliticaBloqueo {
    +minutos number = 10
    +calcularExpiracion(ahora) Date
  }
  class LimiteBoletasPorEvento {
    +MAXIMO = 6
    +verificar(acumuladas, nuevas) void
  }
  class ErrorNegocio {
    +codigo string
    Subclases DatosInvalidos,
    EventoNoEncontrado, EventoNoDisponible,
    AsientoNoDisponible, CantidadInvalida,
    LimiteBoletasExcedido, TransicionInvalida,
    OrdenNoEncontrada, PasarelaNoSoportada,
    PagoNoVerificado
  }
  class Estados {
    <<enumeration>>
    +TipoEvento CONCIERTO / TEATRO / FESTIVAL
    +EstadoEvento PROGRAMADO / AGOTADO / CANCELADO
    +EstadoAsiento DISPONIBLE / BLOQUEADO / VENDIDO
    +EstadoOrden PENDIENTE_PAGO / APROBADA /
    +  RECHAZADA / EXPIRADA
    +NombrePasarela paypal / wompi / pse
    +ResultadoPago APROBADO / RECHAZADO / PENDIENTE
  }
  class NotificacionPago {
    <<value object>>
    +pasarela NombrePasarela
    +referencia string
    +resultado ResultadoPago
    +montoPagado Dinero
  }
  class RegistroPago {
    <<value object>>
    +pasarela NombrePasarela
    +referencia string
    +urlPago string
  }
  class ComprobanteFiscal {
    <<value object>>
    +numero string
    +cufe string
    +emitidoEn Date
  }
  Orden *-- ItemOrden
  Orden *-- Liquidacion
  Orden --> Cliente
  Asiento --> Dinero
  Asiento --> CodigoUbicacion
  Liquidacion --> Dinero
  Evento --> Recinto : se realiza en
  Boleto --> Orden : emitido por
  CalculadoraTarifas ..> Liquidacion
  Evento ..> Estados
  Orden ..> Estados
```

### Casos de uso y puertos de entrada (Mermaid)

```mermaid
classDiagram
  direction TB
  class ConsultarEventos {
    <<interface>>
    +listar() VistaEvento[]
    +obtener(eventoId) VistaEvento
    +asientos(eventoId) Asiento[]
  }
  class CotizarCompra {
    <<interface>>
    +ejecutar(solicitud) Liquidacion
  }
  class IniciarCompra {
    <<interface>>
    +ejecutar(solicitud) Orden
  }
  class IniciarPago {
    <<interface>>
    +ejecutar(solicitud) RegistroPago
  }
  class ConfirmarPago {
    <<interface>>
    +ejecutar(solicitud) Orden / null
  }
  class ExpirarReservas {
    <<interface>>
    +ejecutar() number
  }
  class ConsultarOrden {
    <<interface>>
    +ejecutar(ordenId) DetalleOrden
  }
  class VerificarBoleto {
    <<interface>>
    +ejecutar(codigo) ResultadoVerificacion
  }
  class ConsultarEventosService {
    +listar()
    +obtener(eventoId)
    +asientos(eventoId)
  }
  class CotizarCompraService {
    +ejecutar(solicitud)
  }
  class IniciarCompraService {
    +ejecutar(solicitud)
  }
  class IniciarPagoService {
    +ejecutar(solicitud)
  }
  class ConfirmarPagoService {
    +ejecutar(solicitud)
    -rechazarorden
    -aprobarorden
    -pagoValidoorden, aviso, verif
    -efectosSecundariosorden, ...
  }
  class ExpirarReservasService {
    +ejecutar()
  }
  class ConsultarOrdenService {
    +ejecutar(ordenId)
  }
  class VerificarBoletoService {
    +ejecutar(codigo)
  }
  ConsultarEventosService ..|> ConsultarEventos
  CotizarCompraService ..|> CotizarCompra
  IniciarCompraService ..|> IniciarCompra
  IniciarPagoService ..|> IniciarPago
  ConfirmarPagoService ..|> ConfirmarPago
  ExpirarReservasService ..|> ExpirarReservas
  ConsultarOrdenService ..|> ConsultarOrden
  VerificarBoletoService ..|> VerificarBoleto
```

### Puertos de salida (Mermaid)

```mermaid
classDiagram
  direction TB
  class RecintoRepository {
    <<interface>>
    +listar() Recinto[]
    +buscarPorId(id) Recinto / null
  }
  class EventoRepository {
    <<interface>>
    +listar() Evento[]
    +buscarPorId(id) Evento / null
    +guardar(evento) void
  }
  class AsientoRepository {
    <<interface>>
    +buscarPorRecinto(id) Asiento[]
    +buscarPorIds(ids) Asiento[]
    +cambiarEstadoSiEs(ids, desde, hacia) boolean
    +contarPorEstado(recintoId) Record
  }
  class OrdenRepository {
    <<interface>>
    +guardar(orden) void
    +buscarPorId(id) Orden / null
    +buscarPorReferenciaPago(p, ref) Orden / null
    +buscarPendientesVencidas(ahora) Orden[]
    +contarAsientosActivos(cli, evt) number
  }
  class BoletoRepository {
    <<interface>>
    +guardarTodos(boletos) void
    +buscarPorOrden(ordenId) Boleto[]
    +buscarPorCodigo(codigo) Boleto / null
  }
  class ClienteRepository {
    <<interface>>
    +buscarPorCorreo(correo) Cliente / null
    +guardar(cliente) void
  }
  class PasarelaPagoPort {
    <<interface>>
    +nombre NombrePasarela
    +registrarPago(orden) RegistroPago
    +interpretarNotificacion(cuerpo) NotificacionPago
    +verificarTransaccion(ref) NotificacionPago
  }
  class ResolutorPasarelas {
    <<interface>>
    +obtener(nombre) PasarelaPagoPort
    +disponibles() NombrePasarela[]
  }
  class GeneradorBoletoPort {
    <<interface>>
    +generar(solicitud) MaterialBoleto
    +verificarFirma(boleto, orden, evento) boolean
  }
  class NotificacionPort {
    <<interface>>
    +canal CanalNotificacion
    +enviar(mensaje) void
  }
  class FacturacionElectronicaPort {
    <<interface>>
    +emitir(orden) ComprobanteFiscal
  }
  class Clock {
    <<interface>>
    +ahora() Date
  }
  class GeneradorIds {
    <<interface>>
    +nuevo(prefijo) string
  }
  class Logger {
    <<interface>>
    +info(mensaje) void
    +warn(mensaje) void
  }
  OrdenRepository ..> Orden
  AsientoRepository ..> Asiento
  EventoRepository ..> Evento
  RecintoRepository ..> Recinto
  BoletoRepository ..> Boleto
  ClienteRepository ..> Cliente
  PasarelaPagoPort ..> NotificacionPago
  PasarelaPagoPort ..> RegistroPago
  FacturacionElectronicaPort ..> ComprobanteFiscal
  GeneradorBoletoPort ..> Boleto
  class Orden
  class Asiento
  class Evento
  class Recinto
  class Boleto
  class Cliente
  class NotificacionPago
  class RegistroPago
  class ComprobanteFiscal
```

### Adaptadores (Mermaid)

```mermaid
classDiagram
  direction TB
  class ServidorWeb {
    +app Express
    +crearAppWeb(dependencias)
    GET /api/eventos, /api/eventos/:id/asientos
    POST /api/cotizaciones, /api/compras
    POST /api/ordenes/:id/pago
    GET /api/ordenes/:id, /api/boletos/:c/verificar
  }
  class WebhookPagos {
    POST /webhooks/pagos/:pasarela
    recibe notificaciones asíncronas
  }
  class SchedulerExpiracion {
    +intervalo setInterval
    ejecutar ExpirarReservas cada N s
  }
  class OrdenRepositoryMongo {
    +col Collection~OrdenDoc~
    implementa OrdenRepository
    +aDoc() / aDominio()
  }
  class BoletoRepositoryMongo {
    +col Collection~BoletoDoc~
    implementa BoletoRepository
    índice único codigoRedencion
  }
  class ClienteRepositoryMongo {
    +col Collection~ClienteDoc~
    implementa ClienteRepository
  }
  class RecintoRepositoryMysql {
    +pool Pool (mysql2)
    implementa RecintoRepository
  }
  class EventoRepositoryMysql {
    +pool Pool (mysql2)
    implementa EventoRepository
  }
  class AsientoRepositoryMysql {
    +pool Pool (mysql2)
    implementa AsientoRepository
    UPDATE condicional transaccional
  }
  class ReposMemoria {
    Recinto/Evento/AsientoRepositoryMemoria
    Orden/Boleto/ClienteRepositoryMemoria
    sustituto legacy y fakes de prueba
  }
  class GeneradorBoletoCriptografico {
    +ALFABETO string
    +generar(solicitud) MaterialBoleto
    +verificarFirma(boleto, orden, evento)
    -firmarclave, datos HMAC-SHA256
    -nuevoCodigo string CSPRNG
  }
  class PasarelaMockBase {
    +transacciones Map
    +registrarPago(orden)
    +interpretarNotificacion(cuerpo)
    +verificarTransaccion(ref)
    +simularNotificacion(ref, resultado)
  }
  class PasarelaPayPalMock {
    +DTO PayPalWebhook
    +traducirCuerpo(cuerpo)
    +construirCuerpo(ref, monto, r)
  }
  class PasarelaWompiMock {
    +DTO WompiWebhook
    +traducirCuerpo(cuerpo)
    +construirCuerpo(ref, monto, r)
  }
  class PasarelaPseMock {
    +DTO PseWebhook
    +traducirCuerpo(cuerpo)
    +construirCuerpo(ref, monto, r)
  }
  class ResolutorPasarelasEnMapa {
    +mapa Map
    +obtener(nombre)
    +disponibles()
  }
  class WhatsAppMock {
    +enviados Mensaje[]
    +enviar(mensaje)
  }
  class SendGridMock {
    +enviados Mensaje[]
    +enviar(mensaje)
  }
  class FacturacionDianMock {
    +consecutivo number
    +emitir(orden) ComprobanteFiscal
  }
  class RelojSistema {
    +ahora() Date
  }
  class GeneradorIdsUuid {
    +nuevo(prefijo) string
  }
  class LoggerConsola {
    +info(mensaje)
    +warn(mensaje)
  }
  ServidorWeb ..> ConsultarEventos
  ServidorWeb ..> CotizarCompra
  ServidorWeb ..> IniciarCompra
  ServidorWeb ..> IniciarPago
  ServidorWeb ..> ConsultarOrden
  ServidorWeb ..> VerificarBoleto
  WebhookPagos ..> ConfirmarPago
  SchedulerExpiracion ..> ExpirarReservas
  ServidorWeb *-- WebhookPagos
  OrdenRepositoryMongo ..|> OrdenRepository
  BoletoRepositoryMongo ..|> BoletoRepository
  ClienteRepositoryMongo ..|> ClienteRepository
  RecintoRepositoryMysql ..|> RecintoRepository
  EventoRepositoryMysql ..|> EventoRepository
  AsientoRepositoryMysql ..|> AsientoRepository
  GeneradorBoletoCriptografico ..|> GeneradorBoletoPort
  PasarelaMockBase ..|> PasarelaPagoPort
  ResolutorPasarelasEnMapa ..|> ResolutorPasarelas
  WhatsAppMock ..|> NotificacionPort
  SendGridMock ..|> NotificacionPort
  FacturacionDianMock ..|> FacturacionElectronicaPort
  RelojSistema ..|> Clock
  GeneradorIdsUuid ..|> GeneradorIds
  LoggerConsola ..|> Logger
  PasarelaPayPalMock ..|> PasarelaMockBase : extiende
  PasarelaWompiMock ..|> PasarelaMockBase : extiende
  PasarelaPseMock ..|> PasarelaMockBase : extiende
  class ConsultarEventos
  <<interface>> ConsultarEventos
  class CotizarCompra
  <<interface>> CotizarCompra
  class IniciarCompra
  <<interface>> IniciarCompra
  class IniciarPago
  <<interface>> IniciarPago
  class ConsultarOrden
  <<interface>> ConsultarOrden
  class VerificarBoleto
  <<interface>> VerificarBoleto
  class ConfirmarPago
  <<interface>> ConfirmarPago
  class ExpirarReservas
  <<interface>> ExpirarReservas
  class OrdenRepository
  <<interface>> OrdenRepository
  class BoletoRepository
  <<interface>> BoletoRepository
  class ClienteRepository
  <<interface>> ClienteRepository
  class RecintoRepository
  <<interface>> RecintoRepository
  class EventoRepository
  <<interface>> EventoRepository
  class AsientoRepository
  <<interface>> AsientoRepository
  class GeneradorBoletoPort
  <<interface>> GeneradorBoletoPort
  class PasarelaPagoPort
  <<interface>> PasarelaPagoPort
  class ResolutorPasarelas
  <<interface>> ResolutorPasarelas
  class NotificacionPort
  <<interface>> NotificacionPort
  class FacturacionElectronicaPort
  <<interface>> FacturacionElectronicaPort
  class Clock
  <<interface>> Clock
  class GeneradorIds
  <<interface>> GeneradorIds
  class Logger
  <<interface>> Logger
```

## 6. Pruebas

```bash
npm test
```

| Archivo | Qué cubre |
|---|---|
| `tests/dominio/reglas.test.ts` | Tramos de tarifas (1, 2, 3, 5, 6 boletos), redondeo, límite de 6, política de bloqueo, máquinas de estado de Asiento y Orden, value objects |
| `tests/dominio/firma-boleto.test.ts` | HMAC-SHA256, código de redención, QR, detección de orden alterada, clave distinta y firma manipulada |
| `tests/aplicacion/casos-de-uso.test.ts` | Bloqueo y carreras entre compradores, límite acumulado, expiración con reloj falso, aprobación/rechazo por las 3 pasarelas, webhook falsificado, monto alterado, idempotencia, pago tardío, evento agotado |
| `tests/integracion/mongo.test.ts` | Repositorios Mongo contra un `mongod` real (índices únicos, consultas de vencidas, conteo activo) |
| `tests/integracion/web-e2e.test.ts` | Flujo HTTP completo con Express + Mongo + generador, códigos 400/404/409 |
| `tests/arquitectura/aislamiento.test.ts` | El núcleo no importa infraestructura ni frameworks |

Resultado de la última corrida: ver `docs/BITACORA.md`.

## 7. Capturas de la UI

| Eventos | Asientos y cotización |
|---|---|
| ![Eventos](docs/capturas/01-eventos.png) | ![Asientos](docs/capturas/02-asientos-cotizacion.png) |

| Pago y cuenta regresiva | Pasarela simulada |
|---|---|
| ![Pago](docs/capturas/03-pago-cuenta-regresiva.png) | ![Pasarela](docs/capturas/04-pasarela-simulada.png) |

| Boletos emitidos | Verificación de firma |
|---|---|
| ![Boletos](docs/capturas/05-boletos-emitidos.png) | ![Verificación](docs/capturas/06-boleto-verificado.png) |

![Pago rechazado](docs/capturas/07-pago-rechazado.png)

## 8. Documentación adicional

- `docs/BITACORA.md` — bitácora, decisiones de diseño e interpretación de reglas.
- `docs/informe/Informe-Taller13-LuisaVelandia.docx` y `.pdf` — informe del taller.
