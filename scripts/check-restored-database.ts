import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDatabaseConnection } from "../src/db/connection";
import { readGiftRecords } from "../src/db/gift-repository";
import { verifyRuntimePermissions } from "../src/db/runtime-permissions";

async function main() {
  if (process.env.CI !== "true") throw new Error("Recovery verification requires the disposable CI service.");
  const { env } = JSON.parse(await readFile(".preview-runtime.json", "utf8"));
  for (const access of ["public", "editor"] as const) {
    const url = new URL(access === "public" ? env.DATABASE_URL : env.ADMIN_DATABASE_URL);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/made_for_them_ci");
    const original = await createDatabaseConnection("postgres", { url: url.href });
    url.pathname = "/made_for_them_restore_ci";
    const restored = await createDatabaseConnection("postgres", { url: url.href });
    try {
      await verifyRuntimePermissions(restored.db, access);
      const sourceRecords = await readGiftRecords(original.db, access === "editor");
      const restoredRecords = await readGiftRecords(restored.db, access === "editor");
      assert.deepEqual(restoredRecords, sourceRecords);
      console.log(`Recovery verified for ${access}: ${restoredRecords.length} records, including ordered content and versions.`);
    } finally { await original.close(); await restored.close(); }
  }
}
main().catch(() => { console.error("Isolated recovery verification failed."); process.exitCode = 1; });
