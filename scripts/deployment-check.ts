import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { createDatabaseConnection } from "../src/db/connection";
import { verifyRuntimePermissions } from "../src/db/runtime-permissions";
import { assertOwnerDeployment, runtimeDatabaseUrl } from "../src/lib/deployment-config";

async function main() {
  if (process.argv.includes("--preview")) {
    Object.assign(process.env, JSON.parse(await readFile(".preview-runtime.json", "utf8")).env);
  } else loadEnvConfig(process.cwd(), false);
  assertOwnerDeployment();
  if (process.env.GIFT_DATA_SOURCE !== "postgres") throw new Error("Deployment verification requires PostgreSQL.");
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH ?? "") ||
      (process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) throw new Error("Owner credentials are incomplete.");
  for (const access of ["public", "editor"] as const) {
    const connection = await createDatabaseConnection("postgres", { url: runtimeDatabaseUrl(access) });
    try { await verifyRuntimePermissions(connection.db, access); }
    finally { await connection.close(); }
  }
  console.log("Verified separate runtime roles, draft privacy configuration, TLS settings, origin, and owner settings.");
}
main().catch(() => { console.error("Deployment verification failed; check roles and private settings. No secret values were logged."); process.exitCode = 1; });
