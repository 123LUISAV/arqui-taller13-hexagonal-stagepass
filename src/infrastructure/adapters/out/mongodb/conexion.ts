import { MongoClient, type Db } from "mongodb";

export interface ConexionMongo {
  db: Db;
  cerrar(): Promise<void>;
  /** Descripción legible del origen, para el log de arranque. */
  origen: string;
}

/** Conecta a un MongoDB existente (variable MONGO_URL). */
export async function conectarMongo(url: string, nombreBd = "stagepass"): Promise<ConexionMongo> {
  const client = new MongoClient(url);
  await client.connect();
  return { db: client.db(nombreBd), cerrar: () => client.close(), origen: url };
}

/**
 * Levanta un mongod efímero con mongodb-memory-server (desarrollo y pruebas de integración).
 * Se importa dinámicamente para que producción no lo necesite.
 */
export async function iniciarMongoEnMemoria(nombreBd = "stagepass"): Promise<ConexionMongo> {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const servidor = await MongoMemoryServer.create();
  const client = new MongoClient(servidor.getUri());
  await client.connect();
  return {
    db: client.db(nombreBd),
    origen: "mongodb-memory-server (efímero)",
    cerrar: async () => {
      await client.close();
      await servidor.stop();
    },
  };
}
