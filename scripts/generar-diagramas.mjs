// Genera los diagramas del taller a partir de scripts/modelo-diagramas.mjs:
//   docs/diagramas/stagepass-hexagonal-clases.drawio   (2 páginas: clases completo + vista hexagonal)
//   docs/diagramas/stagepass-hexagonal-clases.svg      (mismo layout que la página 1 del drawio)
//   docs/diagramas/stagepass-vista-hexagonal.svg       (misma vista que la página 2 del drawio)
//   docs/diagramas/mermaid/*.mmd                       (3 diagramas Mermaid por paquete)
// Uso: node scripts/generar-diagramas.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { CLASES, PAQUETES, RELACIONES } from "./modelo-diagramas.mjs";

const SALIDA = "docs/diagramas";
mkdirSync(`${SALIDA}/mermaid`, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/* Layout de clases                                                    */
/* ------------------------------------------------------------------ */
const W = 300, GAP = 26, LH = 14, HEAD = 40, PAD = 18, PKG_HEAD = 34, FONT = 10.5;
const estereotipo = (c) => ({ interface: "«interface»", enum: "«enumeration»", vo: "«value object»" })[c.kind] ?? "";

function altura(c) {
  const a = c.attrs.length * LH + 8;
  const m = c.methods.length * LH + 8;
  return HEAD + (c.attrs.length ? a : 6) + (c.methods.length ? m : 0);
}

function disponer() {
  const orden = ["apri", "pin", "uc", "pout", "asec"];
  const pos = {};
  const paquetes = {};
  const maxCol = (p) => Math.max(...CLASES.filter((c) => c.pkg === p).map((c) => c.col));
  const dibujarPaquete = (p, x0, y0, anchoMin = 0) => {
    const cs = CLASES.filter((c) => c.pkg === p);
    const filas = [...new Set(cs.map((c) => c.row))].sort((a, b) => a - b);
    let y = y0 + PKG_HEAD + PAD;
    for (const f of filas) {
      const fila = cs.filter((c) => c.row === f);
      const h = Math.max(...fila.map(altura));
      for (const c of fila) pos[c.id] = { x: x0 + PAD + c.col * (W + GAP), y, w: W, h: altura(c) };
      y += h + GAP;
    }
    const w = Math.max(anchoMin, (maxCol(p) + 1) * (W + GAP) - GAP + 2 * PAD);
    paquetes[p] = { x: x0, y: y0, w, h: y - y0 - GAP + PAD };
    return paquetes[p].h;
  };
  let y = 20;
  for (const p of orden) y += dibujarPaquete(p, 20, y) + 50;
  const izquierdoAncho = Math.max(...orden.map((p) => paquetes[p].w));
  for (const p of orden) paquetes[p].w = izquierdoAncho; // mismo ancho visual
  dibujarPaquete("dominio", 20 + izquierdoAncho + 60, 20);
  const todos = Object.values(paquetes);
  return { pos, paquetes, ancho: Math.max(...todos.map((p) => p.x + p.w)) + 20, alto: Math.max(...todos.map((p) => p.y + p.h)) + 110 };
}

/* ------------------------------------------------------------------ */
/* Estilos de relaciones                                               */
/* ------------------------------------------------------------------ */
const ESTILO_DRAWIO = {
  real: "endArrow=block;endSize=12;endFill=0;dashed=1;html=1;strokeColor=#333333;",
  dep: "endArrow=open;endSize=8;dashed=1;html=1;strokeColor=#777777;",
  asoc: "endArrow=open;endSize=8;html=1;strokeColor=#333333;",
  comp: "startArrow=diamondThin;startFill=1;startSize=12;endArrow=open;endSize=8;html=1;strokeColor=#333333;",
};

function borde(r, hacia) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const dx = hacia.x - cx, dy = hacia.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const t = Math.min(dx !== 0 ? r.w / 2 / Math.abs(dx) : Infinity, dy !== 0 ? r.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * t, y: cy + dy * t };
}

/* ------------------------------------------------------------------ */
/* SVG de clases                                                       */
/* ------------------------------------------------------------------ */
function svgClases(L) {
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${L.ancho}" height="${L.alto}" viewBox="0 0 ${L.ancho} ${L.alto}" font-family="Segoe UI, Arial, sans-serif">`);
  o.push(`<defs>
<marker id="tri" markerWidth="14" markerHeight="12" refX="13" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L13,6 L1,11 z" fill="#fff" stroke="#333"/></marker>
<marker id="abi" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#555" stroke-width="1.4"/></marker>
<marker id="dia" markerWidth="16" markerHeight="12" refX="1" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1,6 L8,1 L15,6 L8,11 z" fill="#333" stroke="#333"/></marker>
</defs>`);
  o.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  for (const [k, p] of Object.entries(L.paquetes)) {
    const m = PAQUETES[k];
    o.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10" fill="${m.fill}" fill-opacity=".45" stroke="${m.stroke}" stroke-width="2" stroke-dasharray="8 5"/>`);
    o.push(`<text x="${p.x + 16}" y="${p.y + 23}" font-size="16" font-weight="700" fill="#222">${esc("«package» " + m.titulo)}</text>`);
  }
  for (const r of RELACIONES) {
    const a = L.pos[r.de], b = L.pos[r.a];
    if (!a || !b) continue;
    const p1 = borde(a, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
    const p2 = borde(b, { x: a.x + a.w / 2, y: a.y + a.h / 2 });
    const est = { real: `stroke="#333" stroke-dasharray="7 4" marker-end="url(#tri)"`, dep: `stroke="#8a8a8a" stroke-dasharray="4 4" marker-end="url(#abi)"`, asoc: `stroke="#333" marker-end="url(#abi)"`, comp: `stroke="#333" marker-start="url(#dia)" marker-end="url(#abi)"` }[r.tipo];
    o.push(`<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke-width="1.2" ${est} opacity="${r.tipo === "dep" ? 0.55 : 0.9}"/>`);
  }
  for (const c of CLASES) {
    const r = L.pos[c.id];
    const m = PAQUETES[c.pkg];
    o.push(`<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#fff" stroke="${m.stroke}" stroke-width="1.6"/>`);
    o.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${HEAD}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="1.6"/>`);
    const e = estereotipo(c);
    if (e) o.push(`<text x="${r.x + r.w / 2}" y="${r.y + 15}" text-anchor="middle" font-size="10.5" font-style="italic" fill="#333">${esc(e)}</text>`);
    o.push(`<text x="${r.x + r.w / 2}" y="${r.y + (e ? 32 : 26)}" text-anchor="middle" font-size="13" font-weight="700" fill="#111" ${c.kind === "interface" ? "" : ""}>${esc(c.id)}</text>`);
    let y = r.y + HEAD + 14;
    for (const a of c.attrs) { o.push(`<text x="${r.x + 8}" y="${y}" font-size="${FONT}" font-family="Consolas, monospace" fill="#222">${esc("+ " + a)}</text>`); y += LH; }
    if (c.attrs.length || c.methods.length) { const ys = r.y + HEAD + (c.attrs.length ? c.attrs.length * LH + 8 : 6); o.push(`<line x1="${r.x}" y1="${ys}" x2="${r.x + r.w}" y2="${ys}" stroke="${m.stroke}"/>`); y = ys + 14; }
    for (const me of c.methods) { o.push(`<text x="${r.x + 8}" y="${y}" font-size="${FONT}" font-family="Consolas, monospace" fill="#222">${esc((/^[-(]/.test(me) || /^[A-Z]/.test(me) || /^(GET|POST)/.test(me) ? "" : "+ ") + me)}</text>`); y += LH; }
    o.push(`</g>`);
  }
  // leyenda
  const ly = L.alto - 70, lx = 40;
  o.push(`<g font-size="12" fill="#222"><rect x="${lx - 10}" y="${ly - 20}" width="560" height="62" fill="#fff" stroke="#bbb"/>`);
  o.push(`<text x="${lx}" y="${ly}" font-weight="700">Leyenda</text>`);
  o.push(`<line x1="${lx + 70}" y1="${ly - 4}" x2="${lx + 120}" y2="${ly - 4}" stroke="#333" stroke-dasharray="7 4" marker-end="url(#tri)"/><text x="${lx + 128}" y="${ly}">realiza / extiende</text>`);
  o.push(`<line x1="${lx + 270}" y1="${ly - 4}" x2="${lx + 320}" y2="${ly - 4}" stroke="#8a8a8a" stroke-dasharray="4 4" marker-end="url(#abi)"/><text x="${lx + 328}" y="${ly}">depende de / usa</text>`);
  o.push(`<line x1="${lx + 70}" y1="${ly + 22}" x2="${lx + 120}" y2="${ly + 22}" stroke="#333" marker-end="url(#abi)"/><text x="${lx + 128}" y="${ly + 26}">asociación</text>`);
  o.push(`<line x1="${lx + 270}" y1="${ly + 22}" x2="${lx + 320}" y2="${ly + 22}" stroke="#333" marker-start="url(#dia)" marker-end="url(#abi)"/><text x="${lx + 328}" y="${ly + 26}">composición</text></g>`);
  o.push(`</svg>`);
  return o.join("\n");
}

/* ------------------------------------------------------------------ */
/* draw.io de clases                                                   */
/* ------------------------------------------------------------------ */
function celdasClases(L) {
  const x = [];
  for (const [k, p] of Object.entries(L.paquetes)) {
    const m = PAQUETES[k];
    x.push(`<mxCell id="pkg_${k}" value="${esc("«package» " + m.titulo)}" style="rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingLeft=14;spacingTop=4;fontStyle=1;fontSize=15;dashed=1;dashPattern=8 5;strokeWidth=2;fillColor=${m.fill};strokeColor=${m.stroke};opacity=60;arcSize=2;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`);
  }
  for (const r of RELACIONES) {
    if (!L.pos[r.de] || !L.pos[r.a]) continue;
    x.push(`<mxCell id="rel_${r.de}_${r.a}_${r.tipo}" value="${esc(r.etiqueta)}" style="${ESTILO_DRAWIO[r.tipo]}" edge="1" parent="1" source="cls_${r.de}" target="cls_${r.a}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }
  for (const c of CLASES) {
    const r = L.pos[c.id];
    const m = PAQUETES[c.pkg];
    const e = estereotipo(c);
    const titulo = (e ? `&lt;i&gt;${esc(e)}&lt;/i&gt;&lt;br&gt;` : "") + `&lt;b&gt;${esc(c.id)}&lt;/b&gt;`;
    x.push(`<mxCell id="cls_${c.id}" value="${titulo}" style="swimlane;fontStyle=0;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=${HEAD};horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;fillColor=${m.fill};strokeColor=${m.stroke};swimlaneFillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" as="geometry"/></mxCell>`);
    let y = HEAD;
    const estiloTexto = "text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=6;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;fontFamily=Consolas;fontSize=10;";
    if (c.attrs.length) {
      const h = c.attrs.length * LH + 8;
      x.push(`<mxCell id="cls_${c.id}_attrs" value="${c.attrs.map((a) => esc("+ " + a)).join("&lt;br&gt;")}" style="${estiloTexto}" vertex="1" parent="cls_${c.id}"><mxGeometry y="${y}" width="${r.w}" height="${h}" as="geometry"/></mxCell>`);
      y += h;
    } else y += 6;
    if (c.methods.length) {
      x.push(`<mxCell id="cls_${c.id}_sep" value="" style="line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=inherit;" vertex="1" parent="cls_${c.id}"><mxGeometry y="${y - (c.attrs.length ? 0 : 6)}" width="${r.w}" height="1" as="geometry"/></mxCell>`);
      const h = c.methods.length * LH + 8;
      x.push(`<mxCell id="cls_${c.id}_mets" value="${c.methods.map((me) => esc((/^[-(]/.test(me) || /^[A-Z]/.test(me) || /^(GET|POST)/.test(me) ? "" : "+ ") + me)).join("&lt;br&gt;")}" style="${estiloTexto}" vertex="1" parent="cls_${c.id}"><mxGeometry y="${y}" width="${r.w}" height="${h}" as="geometry"/></mxCell>`);
    }
  }
  return x.join("\n");
}

/* ------------------------------------------------------------------ */
/* Vista hexagonal (alto nivel)                                        */
/* ------------------------------------------------------------------ */
const HEX = {
  ancho: 1480,
  alto: 800,
  formas: [
    { id: "hex", tipo: "hexagon", x: 300, y: 50, w: 840, h: 640, fill: "#f3efff", stroke: "#6b4fbb", label: "NÚCLEO HEXAGONAL", top: true },
    { id: "pin", tipo: "rect", x: 350, y: 170, w: 170, h: 440, fill: "#dae8fc", stroke: "#6c8ebf", label: "PUERTOS DE ENTRADA\n(interfaces de casos de uso)\n\nConsultarEventos\nCotizarCompra\nIniciarCompra\nIniciarPago\nConfirmarPago\nExpirarReservas\nConsultarOrden\nVerificarBoleto" },
    { id: "uc", tipo: "rect", x: 560, y: 150, w: 320, h: 170, fill: "#d5e8d4", stroke: "#82b366", label: "CASOS DE USO\n(application/usecases)\n\nIniciarCompraService · ConfirmarPagoService\nExpirarReservasService · CotizarCompraService\nIniciarPagoService · ConsultarOrdenService\nConsultarEventosService · VerificarBoletoService" },
    { id: "dom", tipo: "rect", x: 560, y: 380, w: 320, h: 230, fill: "#fff2cc", stroke: "#d6b656", label: "DOMINIO\n(entidades y reglas puras)\n\nEvento · Asiento · Cliente · Orden · Boleto\nDinero · CodigoUbicacion · Liquidacion\nCalculadoraTarifas · PoliticaBloqueo\nLimiteBoletasPorEvento · ErrorNegocio" },
    { id: "pout", tipo: "rect", x: 920, y: 170, w: 170, h: 440, fill: "#e1d5e7", stroke: "#9673a6", label: "PUERTOS DE SALIDA\n(interfaces)\n\nRecinto/Evento/AsientoRepository\nOrdenRepository\nBoletoRepository\nClienteRepository\nPasarelaPagoPort\nGeneradorBoletoPort\nNotificacionPort\nFacturacionElectronicaPort\nClock · GeneradorIds" },
    // adaptadores primarios
    { id: "act", tipo: "rect", x: 20, y: 60, w: 240, h: 60, fill: "#ffffff", stroke: "#666666", label: "Navegador / app móvil\n(cliente)" },
    { id: "web", tipo: "rect", x: 20, y: 160, w: 240, h: 90, fill: "#f8cecc", stroke: "#b85450", label: "ADAPTADOR WEB REST\nExpress · selección de asientos,\ninicio de compra, pago, consultas" },
    { id: "wh", tipo: "rect", x: 20, y: 300, w: 240, h: 90, fill: "#f8cecc", stroke: "#b85450", label: "ADAPTADOR WEBHOOK\nPOST /webhooks/pagos/:pasarela\n(notificaciones asíncronas)" },
    { id: "ext", tipo: "rect", x: 20, y: 440, w: 240, h: 60, fill: "#ffffff", stroke: "#666666", label: "PayPal · Wompi · PSE\n(servicios externos)" },
    { id: "sch", tipo: "rect", x: 20, y: 550, w: 240, h: 80, fill: "#f8cecc", stroke: "#b85450", label: "ADAPTADOR PROGRAMADO\nScheduler (setInterval)\nexpira reservas vencidas" },
    // adaptadores secundarios
    { id: "mongo", tipo: "rect", x: 1180, y: 50, w: 280, h: 90, fill: "#ffe6cc", stroke: "#d79b00", label: "MongoDB (REAL)\nOrdenRepositoryMongo · BoletoRepositoryMongo\nClienteRepositoryMongo" },
    { id: "mysql", tipo: "rect", x: 1180, y: 160, w: 280, h: 90, fill: "#ffe6cc", stroke: "#d79b00", label: "MySQL legacy\nRecinto/Evento/AsientoRepositoryMysql\n(o sustituto en memoria)" },
    { id: "gen", tipo: "rect", x: 1180, y: 270, w: 280, h: 90, fill: "#ffe6cc", stroke: "#d79b00", label: "GENERADOR DE BOLETOS (REAL)\nHMAC-SHA256 + código + QR\nGeneradorBoletoCriptografico" },
    { id: "pas", tipo: "rect", x: 1180, y: 380, w: 280, h: 90, fill: "#fff7e6", stroke: "#d79b00", label: "Pasarelas de pago (MOCK)\nPasarelaPayPalMock · PasarelaWompiMock\nPasarelaPseMock" },
    { id: "not", tipo: "rect", x: 1180, y: 490, w: 280, h: 80, fill: "#fff7e6", stroke: "#d79b00", label: "Notificaciones (MOCK)\nWhatsAppMock · SendGridMock" },
    { id: "dian", tipo: "rect", x: 1180, y: 590, w: 280, h: 70, fill: "#fff7e6", stroke: "#d79b00", label: "Facturación electrónica (MOCK)\nFacturacionDianMock" },
  ],
  aristas: [
    ["act", "web", "dep", "HTTP"],
    ["ext", "wh", "dep", "webhook"],
    ["web", "pin", "dep", "invoca"],
    ["wh", "pin", "dep", "invoca"],
    ["sch", "pin", "dep", "invoca"],
    ["uc", "pin", "real", "realiza"],
    ["uc", "dom", "dep", "usa"],
    ["uc", "pout", "dep", "usa (DIP)"],
    ["mongo", "pout", "real", "implementa"],
    ["mysql", "pout", "real", "implementa"],
    ["gen", "pout", "real", "implementa"],
    ["pas", "pout", "real", "implementa"],
    ["not", "pout", "real", "implementa"],
    ["dian", "pout", "real", "implementa"],
  ],
  leyendaInf: "Regla de dependencia: todas las flechas apuntan hacia el núcleo. El núcleo solo conoce interfaces (puertos); los adaptadores conocen las tecnologías.",
};

function svgHexagonal() {
  const H = HEX, o = [];
  const forma = Object.fromEntries(H.formas.map((f) => [f.id, f]));
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${H.ancho}" height="${H.alto}" viewBox="0 0 ${H.ancho} ${H.alto}" font-family="Segoe UI, Arial, sans-serif">`);
  o.push(`<defs><marker id="tri" markerWidth="14" markerHeight="12" refX="13" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L13,6 L1,11 z" fill="#fff" stroke="#333"/></marker><marker id="abi" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#444" stroke-width="1.5"/></marker></defs>`);
  o.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  o.push(`<text x="${H.ancho / 2}" y="30" text-anchor="middle" font-size="20" font-weight="700" fill="#222">StagePass Live · Vista hexagonal (puertos y adaptadores)</text>`);
  for (const f of H.formas.filter((f) => f.tipo === "hexagon")) {
    const i = 70;
    o.push(`<polygon points="${f.x + i},${f.y} ${f.x + f.w - i},${f.y} ${f.x + f.w},${f.y + f.h / 2} ${f.x + f.w - i},${f.y + f.h} ${f.x + i},${f.y + f.h} ${f.x},${f.y + f.h / 2}" fill="${f.fill}" stroke="${f.stroke}" stroke-width="3"/>`);
    o.push(`<text x="${f.x + f.w / 2}" y="${f.y + 34}" text-anchor="middle" font-size="17" font-weight="700" fill="${f.stroke}">${esc(f.label)}</text>`);
  }
  for (const [a, b, tipo, et] of H.aristas) {
    const A = forma[a], B = forma[b];
    const p1 = borde(A, { x: B.x + B.w / 2, y: B.y + B.h / 2 }), p2 = borde(B, { x: A.x + A.w / 2, y: A.y + A.h / 2 });
    const est = tipo === "real" ? `stroke="#333" stroke-dasharray="7 4" marker-end="url(#tri)"` : `stroke="#444" marker-end="url(#abi)"`;
    o.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke-width="1.6" ${est}/>`);
    if (a === "mongo" || et !== "implementa") o.push(`<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 5}" text-anchor="middle" font-size="11" fill="#333" paint-order="stroke" stroke="#fff" stroke-width="4">${esc(et)}</text>`);
  }
  for (const f of H.formas.filter((f) => f.tipo === "rect")) {
    o.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="10" fill="${f.fill}" stroke="${f.stroke}" stroke-width="2"/>`);
    const lineas = f.label.split("\n");
    const vertical = f.h > 200;
    const h0 = vertical ? f.y + 26 : f.y + (f.h - lineas.length * 16) / 2 + 13;
    lineas.forEach((l, i) => o.push(`<text x="${f.x + f.w / 2}" y="${h0 + i * 17}" text-anchor="middle" font-size="${i === 0 ? 13 : 11.5}" font-weight="${i === 0 ? 700 : 400}" fill="#222">${esc(l)}</text>`));
  }
  o.push(`<text x="${H.ancho / 2}" y="${H.alto - 40}" text-anchor="middle" font-size="13" fill="#444">${esc(H.leyendaInf)}</text>`);
  o.push(`<text x="${H.ancho / 2}" y="${H.alto - 20}" text-anchor="middle" font-size="12" fill="#444">Línea discontinua con triángulo = realiza/implementa · flecha abierta = invoca/depende · (REAL) = implementación completa · (MOCK) = simulado</text>`);
  o.push(`</svg>`);
  return o.join("\n");
}

function celdasHex() {
  const H = HEX, x = [];
  for (const f of H.formas) {
    const etiqueta = f.label.split("\n").map((l, i) => (i === 0 ? `&lt;b&gt;${esc(l)}&lt;/b&gt;` : esc(l))).join("&lt;br&gt;");
    if (f.tipo === "hexagon") {
      x.push(`<mxCell id="hex_${f.id}" value="&lt;b&gt;${esc(f.label)}&lt;/b&gt;" style="shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=70;whiteSpace=wrap;html=1;verticalAlign=top;fontSize=16;strokeWidth=3;fillColor=${f.fill};strokeColor=${f.stroke};fontColor=${f.stroke};" vertex="1" parent="1"><mxGeometry x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" as="geometry"/></mxCell>`);
    } else {
      x.push(`<mxCell id="hex_${f.id}" value="${etiqueta}" style="rounded=1;whiteSpace=wrap;html=1;fontSize=11;strokeWidth=2;fillColor=${f.fill};strokeColor=${f.stroke};verticalAlign=${f.h > 200 ? "top" : "middle"};" vertex="1" parent="1"><mxGeometry x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" as="geometry"/></mxCell>`);
    }
  }
  H.aristas.forEach(([a, b, tipo, et], i) => {
    x.push(`<mxCell id="hex_e${i}" value="${esc(et)}" style="${ESTILO_DRAWIO[tipo === "real" ? "real" : "asoc"]}fontSize=11;" edge="1" parent="1" source="hex_${a}" target="hex_${b}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  x.push(`<mxCell id="hex_nota" value="${esc(H.leyendaInf)}" style="text;html=1;align=center;verticalAlign=middle;fontSize=13;" vertex="1" parent="1"><mxGeometry x="100" y="${H.alto - 60}" width="${H.ancho - 200}" height="30" as="geometry"/></mxCell>`);
  return x.join("\n");
}

/* ------------------------------------------------------------------ */
/* Escritura                                                           */
/* ------------------------------------------------------------------ */
const L = disponer();
const modelo = (id, ancho, alto, celdas) => `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${ancho}" pageHeight="${alto}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>\n${celdas}\n</root></mxGraphModel>`;
const drawio = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="generar-diagramas.mjs" version="24.0.0"><diagram name="Diagrama de clases (completo)" id="clases">${modelo("clases", L.ancho, L.alto, celdasClases(L))}</diagram><diagram name="Vista hexagonal" id="hexagonal">${modelo("hex", HEX.ancho, HEX.alto, celdasHex())}</diagram></mxfile>\n`;
writeFileSync(`${SALIDA}/stagepass-hexagonal-clases.drawio`, drawio);
writeFileSync(`${SALIDA}/stagepass-hexagonal-clases.svg`, svgClases(L));
writeFileSync(`${SALIDA}/stagepass-vista-hexagonal.svg`, svgHexagonal());

/* Mermaid por paquete */
const fmt = (s) => s.replace(/<([^>]+)>/g, "~$1~").replace(/\): /g, ") ").replace(/: /g, " ").replace(/[|]/g, "/").replace(/[{}]/g, "").replace(/:(w+)/g, "$1");
function mermaid(titulo, pkgs, extra = []) {
  const set = new Set(CLASES.filter((c) => pkgs.includes(c.pkg)).map((c) => c.id));
  const l = ["---", `title: ${titulo}`, "---", "classDiagram", "  direction TB"];
  for (const c of CLASES.filter((c) => set.has(c.id))) {
    l.push(`  class ${c.id} {`);
    const e = { interface: "interface", enum: "enumeration", vo: "value object" }[c.kind];
    if (e) l.push(`    <<${e}>>`);
    for (const a of c.attrs) l.push(`    +${fmt(a)}`);
    for (const m of c.methods) {
      const linea = fmt(m);
      l.push(/\(/.test(linea) && !/^[-(]|^[A-Z]|^(GET|POST)/.test(m) ? `    +${linea}` : `    ${linea.replace(/[()]/g, "")}`);
    }
    l.push("  }");
  }
  const stubs = new Set();
  const flecha = { real: "..|>", dep: "..>", asoc: "-->", comp: "*--" };
  for (const r of RELACIONES) {
    const a = set.has(r.de), b = set.has(r.a);
    if (!a && !b) continue;
    if (!(a && b) && !extra.includes(a ? r.a : r.de) && !(pkgs.includes("asec") || pkgs.includes("apri"))) continue;
    if (!a) stubs.add(r.de);
    if (!b) stubs.add(r.a);
    l.push(`  ${r.de} ${flecha[r.tipo]} ${r.a}${r.etiqueta ? " : " + r.etiqueta : ""}`);
  }
  for (const s of stubs) {
    const c = CLASES.find((c) => c.id === s);
    l.push(`  class ${s}`);
    if (c?.kind === "interface") l.push(`  <<interface>> ${s}`);
  }
  return l.join("\n") + "\n";
}
const idsDe = (p) => CLASES.filter((c) => c.pkg === p).map((c) => c.id);
writeFileSync(`${SALIDA}/mermaid/01-dominio.mmd`, mermaid("Dominio (núcleo)", ["dominio"]));
writeFileSync(`${SALIDA}/mermaid/02-casos-de-uso-y-puertos-de-entrada.mmd`, mermaid("Casos de uso y puertos de entrada", ["pin", "uc"]));
writeFileSync(`${SALIDA}/mermaid/03-puertos-de-salida.mmd`, mermaid("Puertos de salida y tipos del dominio", ["pout"], idsDe("dominio")));
writeFileSync(`${SALIDA}/mermaid/04-adaptadores.mmd`, mermaid("Adaptadores primarios y secundarios", ["apri", "asec"]));
console.log(`Diagramas generados en ${SALIDA} (${CLASES.length} clases, ${RELACIONES.length} relaciones, lienzo ${L.ancho}x${L.alto})`);
