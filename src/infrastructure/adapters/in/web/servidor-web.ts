import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Asiento } from "../../../../domain/asiento.js";
import type { Boleto } from "../../../../domain/boleto.js";
import { ErrorNegocio } from "../../../../domain/errores.js";
import type { Orden } from "../../../../domain/orden.js";
import { ResultadoPago } from "../../../../domain/pagos.js";
import type {
  ConfirmarPago,
  ConsultarEventos,
  ConsultarOrden,
  CotizarCompra,
  IniciarCompra,
  IniciarPago,
  VerificarBoleto,
  VistaEvento,
} from "../../../../application/ports/in/casos-de-uso.js";
import type { ResolutorPasarelas } from "../../../../application/ports/out/servicios-externos.js";
import type { SimuladorPasarela } from "../../out/pagos/pasarela-mock-base.js";

/** Casos de uso (puertos de entrada) que este adaptador primario invoca. Solo interfaces. */
export interface DependenciasWeb {
  consultarEventos: ConsultarEventos;
  cotizarCompra: CotizarCompra;
  iniciarCompra: IniciarCompra;
  iniciarPago: IniciarPago;
  confirmarPago: ConfirmarPago;
  consultarOrden: ConsultarOrden;
  verificarBoleto: VerificarBoleto;
  pasarelas: ResolutorPasarelas;
  /** Opcional: solo existe cuando las pasarelas son mocks (habilita /api/simulador). */
  simuladores?: SimuladorPasarela[];
}

const HTTP_POR_CODIGO: Record<string, number> = {
  EVENTO_NO_ENCONTRADO: 404,
  ORDEN_NO_ENCONTRADA: 404,
  DATOS_INVALIDOS: 400,
  CANTIDAD_INVALIDA: 400,
  PASARELA_NO_SOPORTADA: 400,
};

const dineroDto = (d: { monto: number }) => d.monto;

function eventoDto(v: VistaEvento) {
  const e = v.evento;
  return {
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    estado: e.estado,
    fechaHora: e.fechaHora.toISOString(),
    recinto: { id: v.recinto.id, nombre: v.recinto.nombre, ciudad: v.recinto.ciudad, aforo: v.recinto.aforo },
    asientosDisponibles: v.asientosDisponibles,
  };
}
const asientoDto = (a: Asiento) => ({ id: a.id, codigo: a.codigo.valor, zona: a.codigo.zona, precioBase: dineroDto(a.precioBase), estado: a.estado });

export function ordenDto(o: Orden) {
  const l = o.liquidacion;
  return {
    id: o.id,
    estado: o.estado,
    eventoId: o.eventoId,
    cliente: { id: o.cliente.id, nombreCompleto: o.cliente.nombreCompleto, correo: o.cliente.correo },
    asientos: o.asientos.map((a) => ({ asientoId: a.asientoId, codigoUbicacion: a.codigoUbicacion, precioBase: dineroDto(a.precioBase) })),
    valorBase: dineroDto(l.valorBase),
    tarifaServicio: dineroDto(l.tarifaServicio),
    descuentoAplicado: dineroDto(l.descuento),
    montoTotal: dineroDto(l.montoTotal),
    porcentajeTarifa: l.porcentajeTarifa,
    porcentajeDescuento: l.porcentajeDescuento,
    creadaEn: o.creadaEn.toISOString(),
    expiraEn: o.expiraEn.toISOString(),
    pasarela: o.pasarela ?? null,
    referenciaPago: o.referenciaPago ?? null,
  };
}
const boletoDto = (b: Boleto) => ({
  id: b.id,
  ordenId: b.ordenId,
  codigoUbicacion: b.codigoUbicacion,
  codigoRedencion: b.codigoRedencion,
  firmaHash: b.firmaHash,
  fechaEmision: b.fechaEmision.toISOString(),
  representacionGrafica: b.representacionGrafica,
});

const asincrono =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export function crearAppWeb(dep: DependenciasWeb) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  // ---------- API de consulta ----------
  app.get("/api/pasarelas", (_req, res) => {
    res.json(dep.pasarelas.disponibles());
  });
  app.get("/api/eventos", asincrono(async (_req, res) => {
    res.json((await dep.consultarEventos.listar()).map(eventoDto));
  }));
  app.get("/api/eventos/:id", asincrono(async (req, res) => {
    res.json(eventoDto(await dep.consultarEventos.obtener(String(req.params.id))));
  }));
  app.get("/api/eventos/:id/asientos", asincrono(async (req, res) => {
    res.json((await dep.consultarEventos.asientos(String(req.params.id))).map(asientoDto));
  }));

  // ---------- Flujo de compra ----------
  app.post("/api/cotizaciones", asincrono(async (req, res) => {
    const { eventoId, asientoIds } = req.body ?? {};
    const l = await dep.cotizarCompra.ejecutar({ eventoId, asientoIds: asientoIds ?? [] });
    res.json({
      valorBase: dineroDto(l.valorBase),
      tarifaServicio: dineroDto(l.tarifaServicio),
      descuentoAplicado: dineroDto(l.descuento),
      montoTotal: dineroDto(l.montoTotal),
      porcentajeTarifa: l.porcentajeTarifa,
      porcentajeDescuento: l.porcentajeDescuento,
    });
  }));
  app.post("/api/compras", asincrono(async (req, res) => {
    const { eventoId, asientoIds, cliente } = req.body ?? {};
    const orden = await dep.iniciarCompra.ejecutar({
      eventoId,
      asientoIds: asientoIds ?? [],
      cliente: {
        nombreCompleto: String(cliente?.nombreCompleto ?? ""),
        correo: String(cliente?.correo ?? ""),
        telefonoMovil: String(cliente?.telefonoMovil ?? ""),
        nacionalidad: String(cliente?.nacionalidad ?? ""),
      },
    });
    res.status(201).json(ordenDto(orden));
  }));
  app.post("/api/ordenes/:id/pago", asincrono(async (req, res) => {
    res.status(201).json(await dep.iniciarPago.ejecutar({ ordenId: String(req.params.id), pasarela: String(req.body?.pasarela ?? "") }));
  }));
  app.get("/api/ordenes/:id", asincrono(async (req, res) => {
    const { orden, boletos } = await dep.consultarOrden.ejecutar(String(req.params.id));
    res.json({ orden: ordenDto(orden), boletos: boletos.map(boletoDto) });
  }));
  app.get("/api/boletos/:codigo/verificar", asincrono(async (req, res) => {
    const r = await dep.verificarBoleto.ejecutar(String(req.params.codigo));
    res.json({ valido: r.valido, motivo: r.motivo ?? null, boletoId: r.boleto?.id ?? null });
  }));

  // ---------- Adaptador primario de notificaciones asíncronas de pasarelas ----------
  app.post("/webhooks/pagos/:pasarela", asincrono(async (req, res) => {
    const orden = await dep.confirmarPago.ejecutar({ pasarela: String(req.params.pasarela), cuerpo: req.body });
    // Siempre 200 para que la pasarela no reintente indefinidamente referencias que no conocemos.
    res.status(200).json({ recibido: true, ordenId: orden?.id ?? null, estado: orden?.estado ?? null });
  }));

  // ---------- Simulador de pasarela (solo con mocks) ----------
  if (dep.simuladores?.length) {
    app.post("/api/simulador/pagos", (req, res, next) => {
      try {
        const { pasarela, referencia, resultado } = req.body ?? {};
        const sim = dep.simuladores!.find((s) => s.nombre === String(pasarela).toLowerCase());
        const r = Object.values(ResultadoPago).find((v) => v === resultado);
        if (!sim || !r) throw new ErrorNegocio("DATOS_INVALIDOS", "pasarela o resultado inválido");
        res.json({ cuerpoWebhook: sim.simularNotificacion(String(referencia), r) });
      } catch (e) {
        next(e);
      }
    });
  }

  // ---------- UI estática ----------
  const publico = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
  app.use(express.static(publico));

  app.use((_req, res) => {
    res.status(404).json({ error: "RUTA_NO_ENCONTRADA", mensaje: "Ruta no encontrada" });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ErrorNegocio) {
      res.status(HTTP_POR_CODIGO[err.codigo] ?? 409).json({ error: err.codigo, mensaje: err.message });
      return;
    }
    if (err instanceof SyntaxError && "status" in err) {
      res.status(400).json({ error: "JSON_INVALIDO", mensaje: "El cuerpo de la solicitud no es JSON válido" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado" });
  });
  return app;
}
