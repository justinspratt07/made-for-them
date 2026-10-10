import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { GiftDataSource } from "./config";
import * as schema from "./schema";

export type GiftDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
export function queryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[];
  }
  throw new Error("Unexpected database query result.");
}
export type DatabaseConnection = {
  db: GiftDatabase;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

export async function createDatabaseConnection(
  source: Exclude<GiftDataSource, "starter">,
  options: { url?: string; localPath?: string } = {},
): Promise<DatabaseConnection> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (source === "pglite") {
    const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
      import("drizzle-orm/pglite/migrator"),
    ]);
    const localPath = options.localPath ?? process.env.LOCAL_DATABASE_PATH ?? ".data/made-for-them";
    const dataDir = localPath === "memory://" ? localPath :
      path.resolve(/* turbopackIgnore: true */ localPath).replaceAll("\\", "/");
    if (dataDir !== "memory://") await mkdir(/* turbopackIgnore: true */ dataDir, { recursive: true });
    const client = new PGlite(dataDir);
    const db = drizzle(client, { schema });
    return {
      db,
      migrate: () => migrate(db, { migrationsFolder }),
      close: () => client.close(),
    };
  }

  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for PostgreSQL mode.");
  const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import("postgres"),
    import("drizzle-orm/postgres-js"),
    import("drizzle-orm/postgres-js/migrator"),
  ]);
  const client = postgres(url, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  const db = drizzle(client, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.end({ timeout: 5 }),
  };
}
