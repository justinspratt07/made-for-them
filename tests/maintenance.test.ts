import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("database preparation requires an explicit apply flag before maintenance work", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/prepare-database-access.ts"], {
    env: { ...process.env, DATABASE_URL: "", MIGRATION_DATABASE_URL: "", POSTGRES_TOOL_DIRECTORY: "", DATABASE_PREPARATION_DIRECTORY: "" },
    encoding: "utf8", timeout: 30_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Database preparation could not start/);
  assert.equal(result.stdout, "");
});

test("database preparation rejects missing private paths without connecting or provisioning", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/prepare-database-access.ts", "--apply"], {
    env: { ...process.env, DATABASE_URL: "", MIGRATION_DATABASE_URL: "", POSTGRES_TOOL_DIRECTORY: "", DATABASE_PREPARATION_DIRECTORY: "" },
    encoding: "utf8", timeout: 30_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Database preparation could not start/);
  assert.equal(result.stdout, "");
});
