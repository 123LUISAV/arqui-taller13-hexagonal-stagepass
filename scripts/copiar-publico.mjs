import { cpSync } from "node:fs";
cpSync("src/infrastructure/adapters/in/web/public", "dist/infrastructure/adapters/in/web/public", { recursive: true });
console.log("UI estática copiada a dist/");
