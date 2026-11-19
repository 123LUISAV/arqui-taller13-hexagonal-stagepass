"use strict";
/* UI de StagePass Live: cliente de la API REST del adaptador web. No contiene reglas de negocio:
   todos los cálculos (tarifas, descuentos, totales, expiración) los hace el núcleo. */

const vista = document.getElementById("vista");
const aviso = document.getElementById("aviso");
const estado = { evento: null, asientos: [], seleccion: new Set(), orden: null, pasarela: null, registro: null, temporizador: null, sondeo: null };
const MAX_SELECCION = 6;

const cop = (n) => "$ " + Number(n).toLocaleString("es-CO");
const fecha = (iso) => new Date(iso).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(ruta, opciones = {}) {
  const r = await fetch(ruta, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.mensaje || "Error " + r.status);
  return datos;
}

function mostrarAviso(texto, ok = false) {
  aviso.textContent = texto;
  aviso.className = "aviso" + (ok ? " ok" : "");
  aviso.hidden = !texto;
  if (texto) window.scrollTo({ top: 0, behavior: "smooth" });
}
function marcarPaso(n) {
  document.querySelectorAll("#pasos span").forEach((s) => s.classList.toggle("activo", Number(s.dataset.paso) === n));
}
function limpiarTimers() {
  clearInterval(estado.temporizador);
  clearInterval(estado.sondeo);
}

/* ---------- 1. Eventos ---------- */
async function verEventos() {
  limpiarTimers();
  mostrarAviso("");
  marcarPaso(1);
  Object.assign(estado, { evento: null, seleccion: new Set(), orden: null, registro: null });
  vista.innerHTML = "<p class='sub'>Cargando eventos…</p>";
  try {
    const eventos = await api("/api/eventos");
    vista.innerHTML = `<h1>Próximos eventos</h1><p class="sub">Elige un evento para ver el mapa de asientos.</p>
      <div class="rejilla">${eventos.map((e) => `
        <article class="tarjeta evento">
          <span class="etiqueta ${e.estado}">${e.tipo} · ${e.estado}</span>
          <h2>${esc(e.nombre)}</h2>
          <div class="meta">${esc(e.recinto.nombre)} · ${esc(e.recinto.ciudad)}<br>${fecha(e.fechaHora)}</div>
          <div class="meta"><strong>${e.asientosDisponibles}</strong> de ${e.recinto.aforo} asientos disponibles</div>
          <button data-evento="${e.id}" ${e.estado !== "PROGRAMADO" ? "disabled" : ""}>Ver asientos</button>
        </article>`).join("")}</div>`;
    vista.querySelectorAll("[data-evento]").forEach((b) => b.addEventListener("click", () => verAsientos(b.dataset.evento)));
  } catch (e) { mostrarAviso(e.message); }
}

/* ---------- 2. Asientos ---------- */
async function verAsientos(eventoId) {
  limpiarTimers();
  marcarPaso(2);
  try {
    const [evento, asientos] = await Promise.all([api("/api/eventos/" + eventoId), api(`/api/eventos/${eventoId}/asientos`)]);
    estado.evento = evento;
    estado.asientos = asientos;
    estado.seleccion = new Set([...estado.seleccion].filter((id) => asientos.some((a) => a.id === id && a.estado === "DISPONIBLE")));
    pintarAsientos();
  } catch (e) { mostrarAviso(e.message); }
}

function pintarAsientos() {
  const e = estado.evento;
  const zonas = {};
  for (const a of estado.asientos) (zonas[a.zona] ||= []).push(a);
  const bloqueZona = (nombre, lista) => {
    const filas = {};
    for (const a of lista) {
      const m = a.codigo.match(/^[A-Za-z]+-([A-Za-z]?)/);
      const clave = m && m[1] ? m[1] : "·";
      (filas[clave] ||= []).push(a);
    }
    return `<div class="zona"><h3>${esc(nombre)} · ${cop(lista[0].precioBase)} c/u</h3>${Object.values(filas).map((fila) =>
      `<div class="fila">${fila.map((a) => `<button class="asiento ${a.estado} ${estado.seleccion.has(a.id) ? "sel" : ""}" data-id="${esc(a.id)}" ${a.estado !== "DISPONIBLE" ? "disabled" : ""} title="${esc(a.codigo)} · ${a.estado}">${esc(a.codigo.split("-")[1])}</button>`).join("")}</div>`).join("")}</div>`;
  };
  vista.innerHTML = `
    <div class="cabecera-vista"><div><h1>${esc(e.nombre)}</h1><p class="sub" style="margin:0">${esc(e.recinto.nombre)} · ${fecha(e.fechaHora)}</p></div>
      <button class="sec" id="volver">← Otros eventos</button></div>
    <div class="dos">
      <section class="tarjeta">
        <div class="escenario">ESCENARIO</div>
        ${Object.entries(zonas).map(([n, l]) => bloqueZona(n, l)).join("")}
        <div class="leyenda"><span><i style="background:#ece6fb"></i>Disponible</span><span><i style="background:#5b2fd1"></i>Seleccionado</span><span><i style="background:#fff1cf"></i>Bloqueado</span><span><i style="background:#e5e3ec"></i>Vendido</span></div>
      </section>
      <aside class="tarjeta resumen" id="panel"></aside>
    </div>`;
  document.getElementById("volver").addEventListener("click", verEventos);
  vista.querySelectorAll(".asiento:not([disabled])").forEach((b) => b.addEventListener("click", () => alternarAsiento(b.dataset.id)));
  pintarPanel();
}

function alternarAsiento(id) {
  if (estado.seleccion.has(id)) estado.seleccion.delete(id);
  else if (estado.seleccion.size >= MAX_SELECCION) return mostrarAviso(`Máximo ${MAX_SELECCION} boletos por evento.`);
  else estado.seleccion.add(id);
  mostrarAviso("");
  pintarAsientos();
}

async function pintarPanel() {
  const panel = document.getElementById("panel");
  if (estado.seleccion.size === 0) {
    panel.innerHTML = "<h2>Tu selección</h2><p class='sub'>Selecciona uno o más asientos del mapa.</p>";
    return;
  }
  const elegidos = estado.asientos.filter((a) => estado.seleccion.has(a.id));
  let cot;
  try {
    cot = await api("/api/cotizaciones", { method: "POST", body: { eventoId: estado.evento.id, asientoIds: [...estado.seleccion] } });
  } catch (e) { panel.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  panel.innerHTML = `
    <h2>Tu selección (${elegidos.length})</h2>
    <table>
      ${elegidos.map((a) => `<tr><td>${esc(a.codigo)}</td><td>${cop(a.precioBase)}</td></tr>`).join("")}
      <tr><td>Valor base</td><td>${cop(cot.valorBase)}</td></tr>
      <tr><td>Tarifa de servicio (${cot.porcentajeTarifa} %)</td><td>+ ${cop(cot.tarifaServicio)}</td></tr>
      <tr class="desc"><td>Descuento (${cot.porcentajeDescuento} %)</td><td>- ${cop(cot.descuentoAplicado)}</td></tr>
      <tr class="total"><td>Total</td><td>${cop(cot.montoTotal)}</td></tr>
    </table>
    <form id="form-cliente">
      <label>Nombre completo<input type="text" name="nombreCompleto" required value="Luisa Fernanda Velandia"></label>
      <label>Correo electrónico<input type="email" name="correo" required value="luisa@example.com"></label>
      <label>Teléfono móvil<input type="tel" name="telefonoMovil" required value="+57 3001234567"></label>
      <label>Nacionalidad<input type="text" name="nacionalidad" required value="Colombiana"></label>
      <p class="meta">Al continuar, los asientos se bloquean por unos minutos mientras pagas.</p>
      <button type="submit" style="width:100%">Bloquear asientos y continuar</button>
    </form>`;
  document.getElementById("form-cliente").addEventListener("submit", iniciarCompra);
}

async function iniciarCompra(ev) {
  ev.preventDefault();
  const f = new FormData(ev.target);
  try {
    estado.orden = await api("/api/compras", {
      method: "POST",
      body: { eventoId: estado.evento.id, asientoIds: [...estado.seleccion], cliente: Object.fromEntries(f) },
    });
    estado.seleccion = new Set();
    mostrarAviso("");
    verPago();
  } catch (e) {
    mostrarAviso(e.message);
    verAsientos(estado.evento.id);
  }
}

/* ---------- 3. Pago ---------- */
async function verPago() {
  limpiarTimers();
  marcarPaso(3);
  const o = estado.orden;
  const pasarelas = await api("/api/pasarelas");
  estado.pasarela = estado.pasarela && pasarelas.includes(estado.pasarela) ? estado.pasarela : pasarelas[0];
  const nombres = { paypal: ["PayPal", "Tarjeta o saldo PayPal"], wompi: ["Wompi", "Tarjetas, Nequi, Bancolombia"], pse: ["PSE", "Débito desde tu banco"] };
  vista.innerHTML = `
    <div class="cabecera-vista"><div><h1>Completa tu pago</h1><p class="sub" style="margin:0">Orden ${esc(o.id)} · ${esc(estado.evento.nombre)}</p></div>
      <div style="text-align:right"><div class="meta">Tiempo restante del bloqueo</div><div class="cuenta" id="cuenta">--:--</div></div></div>
    <div class="dos">
      <section class="tarjeta">
        <h2>Pasarela de pago</h2>
        <div class="opciones" id="opciones">${pasarelas.map((p) => `<div class="opcion ${p === estado.pasarela ? "sel" : ""}" data-p="${p}"><strong>${(nombres[p] || [p])[0]}</strong><small>${(nombres[p] || ["", ""])[1]}</small></div>`).join("")}</div>
        <button id="pagar">Ir a pagar con <span id="nom-pasarela"></span></button>
        <div id="zona-simulador" style="margin-top:18px"></div>
      </section>
      <aside class="tarjeta resumen">
        <h2>Resumen de la orden</h2>
        <table>
          ${o.asientos.map((a) => `<tr><td>${esc(a.codigoUbicacion)}</td><td>${cop(a.precioBase)}</td></tr>`).join("")}
          <tr><td>Valor base</td><td>${cop(o.valorBase)}</td></tr>
          <tr><td>Tarifa de servicio (${o.porcentajeTarifa} %)</td><td>+ ${cop(o.tarifaServicio)}</td></tr>
          <tr class="desc"><td>Descuento (${o.porcentajeDescuento} %)</td><td>- ${cop(o.descuentoAplicado)}</td></tr>
          <tr class="total"><td>Total</td><td>${cop(o.montoTotal)}</td></tr>
        </table>
      </aside>
    </div>`;
  const actualizarNombre = () => (document.getElementById("nom-pasarela").textContent = (nombres[estado.pasarela] || [estado.pasarela])[0]);
  actualizarNombre();
  document.querySelectorAll(".opcion").forEach((el) => el.addEventListener("click", () => {
    estado.pasarela = el.dataset.p;
    document.querySelectorAll(".opcion").forEach((x) => x.classList.toggle("sel", x === el));
    actualizarNombre();
  }));
  document.getElementById("pagar").addEventListener("click", registrarPago);
  iniciarCuenta();
  estado.sondeo = setInterval(sondearOrden, 2000);
}

function iniciarCuenta() {
  const cuenta = document.getElementById("cuenta");
  const pintar = () => {
    const ms = new Date(estado.orden.expiraEn) - Date.now();
    if (ms <= 0) { cuenta.textContent = "00:00"; return; }
    const s = Math.ceil(ms / 1000);
    cuenta.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    cuenta.classList.toggle("poco", s <= 30);
  };
  pintar();
  estado.temporizador = setInterval(pintar, 500);
}

async function sondearOrden() {
  try {
    const { orden, boletos } = await api("/api/ordenes/" + estado.orden.id);
    if (orden.estado !== "PENDIENTE_PAGO") verResultado(orden, boletos);
  } catch { /* se reintenta en el siguiente ciclo */ }
}

async function registrarPago() {
  const boton = document.getElementById("pagar");
  boton.disabled = true;
  try {
    estado.registro = await api(`/api/ordenes/${estado.orden.id}/pago`, { method: "POST", body: { pasarela: estado.pasarela } });
    mostrarAviso("");
    document.getElementById("zona-simulador").innerHTML = `
      <div class="simulador">
        <strong>Pasarela simulada: ${esc(estado.registro.pasarela.toUpperCase())}</strong>
        <p class="meta" style="margin:6px 0 0">Referencia <span class="codigo" style="font-size:14px">${esc(estado.registro.referencia)}</span><br>${esc(estado.registro.urlPago)}</p>
        <p class="meta">En producción la pasarela real notificaría al webhook cuando el banco responda. Aquí simulas esa respuesta:</p>
        <div class="acciones"><button class="ok" data-r="APROBADO">Simular pago aprobado</button><button class="mal" data-r="RECHAZADO">Simular pago rechazado</button></div>
      </div>`;
    document.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => simular(b.dataset.r)));
  } catch (e) { mostrarAviso(e.message); boton.disabled = false; }
}

async function simular(resultado) {
  document.querySelectorAll("[data-r]").forEach((b) => (b.disabled = true));
  try {
    const { cuerpoWebhook } = await api("/api/simulador/pagos", { method: "POST", body: { pasarela: estado.registro.pasarela, referencia: estado.registro.referencia, resultado } });
    await api("/webhooks/pagos/" + estado.registro.pasarela, { method: "POST", body: cuerpoWebhook });
    await sondearOrden();
  } catch (e) { mostrarAviso(e.message); }
}

/* ---------- 4. Resultado ---------- */
function verResultado(orden, boletos) {
  limpiarTimers();
  marcarPaso(4);
  if (orden.estado === "APROBADA") {
    vista.innerHTML = `
      <div class="cabecera-vista"><div><h1>¡Compra aprobada!</h1><p class="sub" style="margin:0">Estos son tus boletos para ${esc(estado.evento.nombre)}. También se enviaron por WhatsApp y correo (simulados).</p></div>
        <button class="sec" id="inicio">Comprar más boletos</button></div>
      <div style="display:grid;gap:14px">${boletos.map((b) => `
        <article class="tarjeta boleto">
          <img alt="QR del boleto ${esc(b.codigoUbicacion)}" src="${b.representacionGrafica}">
          <div>
            <span class="etiqueta">${esc(b.codigoUbicacion)}</span>
            <div class="meta" style="margin-top:8px">Código de redención</div><div class="codigo">${esc(b.codigoRedencion)}</div>
            <div class="meta" style="margin-top:8px">Firma de seguridad (HMAC-SHA256)</div><div class="firma">${esc(b.firmaHash)}</div>
            <div class="meta" style="margin-top:6px">Emitido: ${fecha(b.fechaEmision)}</div>
            <button class="sec" data-codigo="${esc(b.codigoRedencion)}" style="margin-top:8px;padding:6px 12px">Verificar firma</button>
            <div class="verif" id="v-${esc(b.codigoRedencion)}"></div>
          </div>
        </article>`).join("")}</div>`;
    vista.querySelectorAll("[data-codigo]").forEach((b) => b.addEventListener("click", async () => {
      const r = await api(`/api/boletos/${b.dataset.codigo}/verificar`);
      const el = document.getElementById("v-" + b.dataset.codigo);
      el.className = "verif " + (r.valido ? "ok" : "mal");
      el.textContent = r.valido ? "Boleto válido: la firma coincide con la orden y el evento." : "Inválido: " + r.motivo;
    }));
  } else {
    const msg = { RECHAZADA: "El pago fue rechazado. Los asientos quedaron liberados.", EXPIRADA: "El tiempo de bloqueo terminó sin pago. Los asientos fueron liberados." }[orden.estado] || orden.estado;
    vista.innerHTML = `<div class="tarjeta" style="max-width:560px;margin:40px auto;text-align:center"><h1>${orden.estado === "EXPIRADA" ? "Reserva expirada" : "Pago rechazado"}</h1><p class="sub">${msg}</p><button id="inicio">Volver a los eventos</button></div>`;
  }
  document.getElementById("inicio").addEventListener("click", verEventos);
}

document.getElementById("ir-inicio").addEventListener("click", verEventos);
verEventos();
