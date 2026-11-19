// Genera docker/mysql/init.sql a partir de la misma semilla que usa el adaptador en memoria.
// Uso: npx tsx scripts/generar-init-sql.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { crearSemilla } from "../src/infrastructure/adapters/out/memoria/datos-semilla.js";

const ahora = new Date();
const s = crearSemilla(ahora);
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const dias = (e: { fechaHora: Date }) => Math.round((e.fechaHora.getTime() - ahora.getTime()) / 86_400_000);

const sql = `-- StagePass Live: esquema y datos del sistema relacional legacy (recintos, eventos y asientos).
-- Generado por scripts/generar-init-sql.ts; las fechas de los eventos son relativas a la carga.
CREATE DATABASE IF NOT EXISTS stagepass_legacy CHARACTER SET utf8mb4;
USE stagepass_legacy;

CREATE TABLE IF NOT EXISTS recintos (
  id        VARCHAR(40)  PRIMARY KEY,
  nombre    VARCHAR(120) NOT NULL,
  ciudad    VARCHAR(80)  NOT NULL,
  aforo     INT          NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos (
  id            VARCHAR(40)  PRIMARY KEY,
  nombre        VARCHAR(160) NOT NULL,
  tipo          ENUM('CONCIERTO','TEATRO','FESTIVAL') NOT NULL,
  recinto_id    VARCHAR(40)  NOT NULL,
  fecha_hora    DATETIME     NOT NULL,
  estado        ENUM('PROGRAMADO','AGOTADO','CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
  clave_secreta VARCHAR(120) NOT NULL,
  FOREIGN KEY (recinto_id) REFERENCES recintos(id)
);

CREATE TABLE IF NOT EXISTS asientos (
  id          VARCHAR(60) PRIMARY KEY,
  recinto_id  VARCHAR(40) NOT NULL,
  codigo      VARCHAR(30) NOT NULL,
  precio_base INT         NOT NULL,
  estado      ENUM('DISPONIBLE','BLOQUEADO','VENDIDO') NOT NULL DEFAULT 'DISPONIBLE',
  UNIQUE KEY uq_recinto_codigo (recinto_id, codigo),
  FOREIGN KEY (recinto_id) REFERENCES recintos(id)
);

INSERT INTO recintos (id, nombre, ciudad, aforo) VALUES
${s.recintos.map((r) => `  (${q(r.id)}, ${q(r.nombre)}, ${q(r.ciudad)}, ${r.aforo})`).join(",\n")};

INSERT INTO eventos (id, nombre, tipo, recinto_id, fecha_hora, estado, clave_secreta) VALUES
${s.eventos.map((e) => `  (${q(e.id)}, ${q(e.nombre)}, ${q(e.tipo)}, ${q(e.recintoId)}, DATE_ADD(NOW(), INTERVAL ${dias(e)} DAY), ${q(e.estado)}, ${q(e.claveSecreta)})`).join(",\n")};

INSERT INTO asientos (id, recinto_id, codigo, precio_base, estado) VALUES
${s.asientos.map((a) => `  (${q(a.id)}, ${q(a.recintoId)}, ${q(a.codigo.valor)}, ${a.precioBase.monto}, 'DISPONIBLE')`).join(",\n")};
`;
mkdirSync("docker/mysql", { recursive: true });
writeFileSync("docker/mysql/init.sql", sql);
console.log(`docker/mysql/init.sql generado (${s.asientos.length} asientos)`);
