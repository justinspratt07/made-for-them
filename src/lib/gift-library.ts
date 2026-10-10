import "server-only";
import { getGiftDataSource } from "../db/config";
import { createDatabaseConnection, type DatabaseConnection } from "../db/connection";
import { readGiftLibrary } from "../db/gift-repository";

const databaseGlobal = globalThis as typeof globalThis & {
  giftDatabase?: Promise<DatabaseConnection>;
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

export async function getGiftDatabase() {
  const source = getGiftDataSource();
  if (source === "starter") throw new Error("The editor requires a database connection.");
  databaseGlobal.giftDatabase ??= createDatabaseConnection(source).catch((error) => {
    databaseGlobal.giftDatabase = undefined;
    throw error;
  });
  const { db } = await databaseGlobal.giftDatabase;
  return db;
}
