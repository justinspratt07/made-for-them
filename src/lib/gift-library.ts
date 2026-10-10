import "server-only";
import { getGiftDataSource } from "../db/config";
import { createDatabaseConnection, type DatabaseConnection } from "../db/connection";
import { readGiftLibrary } from "../db/gift-repository";
import { isHostedDeployment, runtimeDatabaseUrl, type DatabaseAccess } from "./deployment-config";
import { verifyRuntimePermissions } from "../db/runtime-permissions";

const databaseGlobal = globalThis as typeof globalThis & {
  giftDatabasesV2?: Partial<Record<DatabaseAccess, Promise<DatabaseConnection>>>;
};

export async function loadGiftLibrary() {
  const source = getGiftDataSource();
  if (source === "starter") {
    const { giftIdeas } = await import("./gift-ideas");
    return giftIdeas;
  }
  try {
    const db = await getGiftDatabase();
    return await readGiftLibrary(db);
  } catch {
    // Driver errors can include connection details. Keep them out of rendered errors.
    throw new Error("The gift library could not be loaded. Check the database setup on the server.");
  }
}

export async function getGiftDatabase(access: DatabaseAccess = "public") {
  const source = getGiftDataSource();
  if (source === "starter") throw new Error("The editor requires a database connection.");
  const url = runtimeDatabaseUrl(access);
  const connections = databaseGlobal.giftDatabasesV2 ??= {};
  // Local PGlite must share one client because its file cannot be opened twice.
  const key = source === "pglite" ? "public" : access;
  connections[key] ??= (async () => {
    const connection = await createDatabaseConnection(source, { url });
    try {
      if (isHostedDeployment()) await verifyRuntimePermissions(connection.db, access);
      return connection;
    } catch (error) { await connection.close(); throw error; }
  })().catch((error) => { connections[key] = undefined; throw error; });
  const { db } = await connections[key];
  return db;
}
