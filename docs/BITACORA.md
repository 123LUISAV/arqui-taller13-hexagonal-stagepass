# Bitácora del Taller 13 — StagePass Live (Arquitectura Hexagonal)

Autora: Luisa Fernanda Velandia Salamanca (U00179371) · UNAB · Arquitectura de Software · Docente: MSc. Feisar Moreno · Noviembre de 2026

## 1. Cronología

| Paso | Qué se hizo | Commit |
|---|---|---|
| 1 | Estructura del proyecto (TypeScript estricto, Node 24, Vitest), dependencias | `chore: estructura inicial…` |
| 2 | Dominio: entidades (`Evento`, `Asiento`, `Cliente`, `Orden`, `Boleto`, `Recinto`), value objects (`Dinero`, `CodigoUbicacion`), estados, excepciones y servicios de dominio (`CalculadoraTarifas`, `PoliticaBloqueo`, `LimiteBoletasPorEvento`) | `feat(dominio)…` |
| 3 | Aplicación: 8 puertos de entrada, 14 puertos de salida y 8 casos de uso | `feat(aplicacion)…` |
| 4 | Adaptadores de salida: MongoDB, generador criptográfico, MySQL, pasarelas, notificaciones, DIAN, memoria | `feat(adaptadores)…` |
| 5 | Adaptador web Express, webhook, UI estática y raíz de composición | `feat(web)…` |
| 6 | Pruebas (67) incluyendo el test de arquitectura | `test…` |
| 7 | Diagrama de clases en draw.io, vista hexagonal y diagramas Mermaid | `docs: diagrama…` |
| 8 | Capturas de la UI, README, bitácora e informe | `docs…` |

## 2. Decisiones de diseño

**TypeScript + Node 24 en modo estricto.** El tipado fuerte hace explícitas las fronteras: los puertos son `interface` y
el compilador impide que un adaptador devuelva algo distinto al tipo del dominio.

**Express solo en el adaptador de entrada.** El resto del sistema no sabe que existe HTTP. El adaptador web recibe un
objeto con *interfaces de casos de uso* (puertos primarios), nunca clases concretas.

**Raíz de composición (`src/composicion.ts`).** Es el único archivo que importa a la vez núcleo e infraestructura. Allí se
eligen adaptadores por variables de entorno (`MONGO_URL`, `MYSQL_URL`) y se inyectan por constructor.

**Por qué MongoDB y el generador de boletos son los adaptadores "reales".** El enunciado pide al menos dos adaptadores
completos. Se eligieron los dos con más riesgo de acoplamiento y más valor para demostrar la arquitectura:
- *MongoDB* demuestra que el núcleo no sabe nada de documentos: el adaptador define sus propios `OrdenDoc`/`BoletoDoc` y
  convierte de ida y vuelta con el dominio (`Orden.reconstituir`). Crea índices (único en `codigoRedencion`).
- *El generador de boletos* concentra la parte criptográfica (`node:crypto`) y gráfica (`qrcode`), dos dependencias que
  no deben filtrarse al núcleo.
El adaptador web Express completa el requisito de "al menos dos" con holgura (son tres reales).

**HMAC-SHA256 para la firma.** Se necesita una firma que dependa de un secreto (la clave del evento) para que nadie pueda
fabricar un boleto válido solo conociendo los datos de la orden. Un hash simple (SHA-256 sin clave) se puede recalcular
por cualquiera; HMAC no. La verificación usa `timingSafeEqual` para evitar fugas por tiempo. El dominio define *qué* se
firma (`Orden.datosInmutables(asientoId)` = `ordenId|clienteId|eventoId|asientoId|código|monto`) y el adaptador define
*cómo* (HMAC-SHA256); así la regla "datos inmutables de la orden" queda en el núcleo y el algoritmo en infraestructura.

**Código de redención.** 12 caracteres alfanuméricos de un alfabeto sin `0/O/1/I`, generados con `crypto.randomInt`
(CSPRNG). El índice único en Mongo garantiza que no se repita.

**Expiración con `Clock` inyectado.** El caso de uso `ExpirarReservas` es una operación pura sobre puertos; un *scheduler*
(`setInterval` en la raíz de composición, adaptador primario programado) lo invoca cada `EXPIRACION_INTERVALO_SEG`. Las
pruebas usan un `RelojFalso` y avanzan el tiempo sin esperar. La duración es configurable (`BLOQUEO_MINUTOS`, defecto 10).

**Verificación del pago en dos pasos.** Cada pasarela puede enviar webhooks; el enunciado exige que la boleta solo exista
"si el pago fue exitoso y verificado". Por eso `ConfirmarPagoService` (1) traduce el webhook con el adaptador de la
pasarela, (2) vuelve a consultar la transacción a la pasarela (`verificarTransaccion`) y (3) exige que el monto sea el de la
orden. Si algo falla, la orden se rechaza y los asientos se liberan. Hay una prueba con un webhook falsificado.

**Idempotencia.** Las pasarelas reintentan notificaciones; si la orden ya no está pendiente, el caso de uso devuelve su
estado sin volver a emitir boletos ni notificaciones (prueba incluida).

**Reserva atómica de asientos.** `AsientoRepository.cambiarEstadoSiEs(ids, desde, hacia)` es "todo o nada": en MySQL es un
`UPDATE … WHERE estado = ?` dentro de una transacción; en memoria, una comprobación síncrona. Si dos compradores piden el
mismo asiento a la vez, solo uno gana (prueba con `Promise.allSettled`).

**Efectos secundarios tolerantes a fallos.** Notificaciones (WhatsApp/correo) y facturación DIAN se ejecutan después de
confirmar la venta; si fallan, se registra una advertencia pero no se revierte el pago ya aprobado.

**Las pasarelas son mocks con DTO propios.** PayPal (`event_type`/`resource`), Wompi (`transaction.updated`, montos en
centavos) y PSE (`transactionState`) tienen formas distintas de webhook. Cada mock las define *dentro de su archivo* y las
traduce al `NotificacionPago` del dominio, demostrando que ningún DTO de pasarela cruza el puerto. El simulador
(`/api/simulador/pagos`) solo existe porque son mocks: fabrica el cuerpo de webhook de la pasarela elegida.

## 3. Interpretación de reglas del enunciado

- **Base de cálculo.** La tarifa de servicio y el descuento se calculan sobre el **valor base** (suma de precios base de
  los asientos). `total = base + tarifa − descuento`. Ejemplo (3 boletos, base 535.000): tarifa 8 % = 42.800, descuento
  5 % = 26.750, total = 551.050.
- **Redondeo.** Al peso colombiano más cercano (`Math.round`), sin decimales.
- **Tramo >5.** Como el máximo por cliente y evento es 6, el tramo corporativo solo se alcanza con exactamente 6 boletos
  en una orden; se implementó igualmente como regla general (`> 5`).
- **"Boletas acumuladas".** Se cuentan los asientos de las órdenes **pendientes de pago y aprobadas** del mismo cliente en
  el mismo evento. Las rechazadas y expiradas no cuentan. Contar también las pendientes evita saltarse el límite abriendo
  varias órdenes en paralelo antes de pagar.
- **Identidad del cliente.** El cliente se identifica por su correo electrónico (normalizado a minúsculas); si ya existe se
  reutiliza su id.
- **Asientos por recinto.** Siguiendo el modelo del enunciado, `Asiento` pertenece a un recinto (no a un evento). Por
  simplicidad se programa una función por recinto. En un sistema real habría que separar el estado del asiento por función
  (`eventoId`); queda como mejora futura.
- **Clave secreta del evento.** El enunciado la menciona pero no la lista entre los atributos de `Evento`; se agregó como
  `claveSecreta`.
- **Pago tardío.** Si una aprobación llega después de expirar la orden, no se emiten boletos (la orden queda `EXPIRADA`) y se
  deja una advertencia en el log; el reembolso quedaría para un proceso operativo fuera del alcance.
- **Evento Agotado.** Se marca cuando al aprobar un pago no quedan asientos disponibles ni bloqueados; si luego se libera un
  bloqueo, la venta se reabre.

## 4. Cómo probar

1. `npm install && npm run dev` y abrir http://localhost:3000.
2. Elegir un evento, seleccionar asientos (la UI muestra tarifa/descuento/total calculados por el núcleo), completar los
   datos y **Bloquear asientos**.
3. Elegir pasarela → **Ir a pagar** → **Simular pago aprobado/rechazado**. La UI llama al webhook real
   `POST /webhooks/pagos/:pasarela` con el cuerpo propio de la pasarela.
4. Ver boletos con QR, código y firma; pulsar **Verificar firma**.
5. Probar la expiración: `BLOQUEO_MINUTOS=0.1 EXPIRACION_INTERVALO_SEG=2 npm run dev`, bloquear un asiento y esperar ~10 s: el
   asiento vuelve a *Disponible* (verificado manualmente, el log muestra `Orden … expirada; 1 asiento(s) liberado(s)`).
6. Ejemplos `curl` en el README.

## 5. Resultados reales

### Pruebas automáticas (`npm test`)

```
Test Files  6 passed (6)
     Tests  67 passed (67)
```

| Archivo | Pruebas |
|---|---|
| tests/dominio/reglas.test.ts | reglas y máquinas de estado |
| tests/dominio/firma-boleto.test.ts | firma y QR |
| tests/aplicacion/casos-de-uso.test.ts | casos de uso con reloj falso y adaptadores en memoria |
| tests/integracion/mongo.test.ts | Mongo real (mongodb-memory-server) |
| tests/integracion/web-e2e.test.ts | HTTP extremo a extremo |
| tests/arquitectura/aislamiento.test.ts | aislamiento del núcleo |

Se comprobó que el test de arquitectura realmente falla: al añadir temporalmente `import express from "express"` en
`src/domain/dinero.ts` el test reportó `domain\dinero.ts importa "express"`; se retiró la línea.

### Otras verificaciones
- `npx tsc --noEmit`: sin errores (modo estricto).
- `npm run build`: compila a `dist/` y copia la UI.
- App ejecutada con `npm run dev`: flujo completo con `curl` (compra → pago Wompi → webhook → boletos) y con la UI
  automatizada con Chrome (capturas en `docs/capturas/`).

### Limitaciones conocidas
- El adaptador MySQL no se probó contra un servidor MySQL real (sin Docker en el equipo de desarrollo).
- Las pasarelas, WhatsApp, SendGrid y DIAN son mocks.
- Los datos de Mongo en modo `npm run dev` son efímeros (se pierden al detener la app).
- El estado del asiento es por recinto, no por función (ver sección 3).
