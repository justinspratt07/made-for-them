import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { createDatabaseConnection, queryRows } from "../src/db/connection";

loadEnvConfig(process.cwd(), true);

async function main() {
  if (process.env.GIFT_DATA_SOURCE !== "postgres") throw new Error("PostgreSQL is required.");
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Private maintenance connection is missing.");
  const connection = await createDatabaseConnection("postgres", { url });
  try {
    const details = await connection.db.transaction(async (tx) => {
      const version = queryRows<{ version: number }>(await tx.execute(sql`select current_setting('server_version_num')::integer as version`))[0];
      const counts = queryRows<{ gifts: number; published: number }>(await tx.execute(sql`
        select count(*)::integer as gifts, count(*) filter(where published)::integer as published from public.gift_ideas
      `))[0];
      const tables = queryRows<{ tablename: string }>(await tx.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`));
      const roles = queryRows(await tx.execute(sql`select rolname from pg_roles where rolname in ('mft_reader', 'mft_owner_editor', 'mft_public', 'mft_editor')`));
      const migrations = queryRows<{ applied: number }>(await tx.execute(sql`select count(*)::integer as applied from drizzle.__drizzle_migrations`))[0];
      const permissions = queryRows<{ createRoles: boolean }>(await tx.execute(sql`select rolcreaterole as "createRoles" from pg_roles where rolname = current_user`))[0];
      return { serverVersion: version.version, ...counts, publicTables: tables.map((table) => table.tablename),
        existingRuntimeRoleCount: roles.length, appliedMigrations: migrations.applied, maintenanceCanCreateRoles: permissions.createRoles };
    }, { accessMode: "read only" });
    console.log(JSON.stringify(details));
  } finally { await connection.close(); }
}
main().catch(() => { console.error("Read-only database inspection failed; no private connection values were logged."); process.exitCode = 1; });
