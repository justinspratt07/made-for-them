import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createDatabaseConnection } from "../src/db/connection";
import { verifyRuntimePermissions } from "../src/db/runtime-permissions";
import { takeDatabaseLoginAttempt, resetDatabaseLoginAttempts } from "../src/db/login-limit";

test("real PostgreSQL logins enforce roles and share an atomic allowance across independent pools", async () => {
  const { env } = JSON.parse(await readFile(".preview-runtime.json", "utf8"));
  const endpoint = new URL(env.DATABASE_URL);
  assert.equal(process.env.CI, "true");
  assert.equal(endpoint.hostname, "127.0.0.1");
  assert.equal(endpoint.pathname, "/made_for_them_ci");
  const reader = await createDatabaseConnection("postgres", { url: env.DATABASE_URL });
  const editorA = await createDatabaseConnection("postgres", { url: env.ADMIN_DATABASE_URL });
  const editorB = await createDatabaseConnection("postgres", { url: env.ADMIN_DATABASE_URL });
  const attacker = randomBytes(32).toString("hex"), owner = randomBytes(32).toString("hex");
  try {
    await verifyRuntimePermissions(reader.db, "public");
    await verifyRuntimePermissions(editorA.db, "editor");
    const results = await Promise.all(Array.from({ length: 35 }, (_, index) =>
      takeDatabaseLoginAttempt(index % 2 ? editorA.db : editorB.db, attacker)));
    assert.equal(results.filter(Boolean).length, 10);
    assert.equal(await takeDatabaseLoginAttempt(editorB.db, owner), true);
    await resetDatabaseLoginAttempts(editorA.db, owner);
    assert.equal(await takeDatabaseLoginAttempt(editorB.db, attacker), false);
    await assert.rejects(takeDatabaseLoginAttempt(reader.db, owner));
  } finally { await reader.close(); await editorA.close(); await editorB.close(); }
});
