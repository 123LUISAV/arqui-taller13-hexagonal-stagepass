import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test de arquitectura: el núcleo (domain + application) no puede importar infraestructura,
 * frameworks web, drivers de persistencia ni librerías de terceros ligadas a adaptadores.
 */
const RAIZ = path.resolve(__dirname, "../../src");
const PROHIBIDOS: Array<{ nombre: string; patron: RegExp }> = [
  { nombre: "infrastructure", patron: /(^|\/)infrastructure(\/|$)/ },
  { nombre: "express", patron: /^express(\/|$)/ },
  { nombre: "mongodb", patron: /^mongodb(\/|$)/ },
  { nombre: "mysql2", patron: /^mysql2(\/|$)/ },
  { nombre: "qrcode", patron: /^qrcode(\/|$)/ },
  { nombre: "node:http", patron: /^(node:)?https?$/ },
  { nombre: "mongodb-memory-server", patron: /^mongodb-memory-server/ },
];

export function listarTs(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? listarTs(p) : p.endsWith(".ts") ? [p] : [];
  });
}

export function importsDe(codigo: string): string[] {
  const r = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
  const out: string[] = [];
  for (const m of codigo.matchAll(r)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}

function violaciones(dir: string): string[] {
  const v: string[] = [];
  for (const archivo of listarTs(dir)) {
    for (const spec of importsDe(readFileSync(archivo, "utf8"))) {
      for (const p of PROHIBIDOS) if (p.patron.test(spec)) v.push(`${path.relative(RAIZ, archivo)} importa "${spec}" (${p.nombre})`);
    }
  }
  return v;
}

describe("Aislamiento del núcleo hexagonal", () => {
  it("src/domain no importa infraestructura ni frameworks", () => {
    expect(violaciones(path.join(RAIZ, "domain"))).toEqual([]);
  });
  it("src/application no importa infraestructura ni frameworks", () => {
    expect(violaciones(path.join(RAIZ, "application"))).toEqual([]);
  });
  it("src/domain no depende de src/application (el dominio es el centro)", () => {
    const v: string[] = [];
    for (const f of listarTs(path.join(RAIZ, "domain")))
      for (const s of importsDe(readFileSync(f, "utf8"))) if (/application/.test(s)) v.push(`${path.basename(f)} -> ${s}`);
    expect(v).toEqual([]);
  });
  it("los puertos (application/ports) solo dependen del dominio", () => {
    const v: string[] = [];
    for (const f of listarTs(path.join(RAIZ, "application/ports")))
      for (const s of importsDe(readFileSync(f, "utf8"))) if (!s.startsWith(".") || /usecases/.test(s)) v.push(`${path.basename(f)} -> ${s}`);
    expect(v).toEqual([]);
  });
  it("el escáner detecta importaciones prohibidas (control negativo)", () => {
    const muestra = `import express from "express";\nimport { MongoClient } from "mongodb";\nimport x from "../../infrastructure/a.js";\nimport http from "node:http";`;
    const encontrados = importsDe(muestra);
    expect(encontrados).toHaveLength(4);
    expect(encontrados.every((s) => PROHIBIDOS.some((p) => p.patron.test(s)))).toBe(true);
  });
  it("hay archivos que escanear (el test no es vacío)", () => {
    expect(listarTs(path.join(RAIZ, "domain")).length).toBeGreaterThan(10);
    expect(listarTs(path.join(RAIZ, "application")).length).toBeGreaterThan(10);
  });
});
