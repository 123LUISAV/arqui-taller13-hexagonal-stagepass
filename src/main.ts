import { construirAplicacion, leerConfiguracion } from "./composicion.js";

const cfg = leerConfiguracion();
console.log("Iniciando StagePass Live...");
const sistema = await construirAplicacion(cfg);

const servidor = sistema.app.listen(cfg.puerto, () => {
  console.log(`StagePass Live en http://localhost:${cfg.puerto}`);
  console.log(`  Legacy (recintos/asientos): ${sistema.resumen.legacy}`);
  console.log(`  MongoDB (órdenes/boletos):  ${sistema.resumen.mongo}`);
  console.log(`  Bloqueo temporal de asientos: ${sistema.resumen.bloqueoMinutos} min`);
});

async function apagar() {
  servidor.close();
  await sistema.cerrar();
  process.exit(0);
}
process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
