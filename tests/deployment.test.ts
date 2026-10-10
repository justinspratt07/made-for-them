import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { createDatabaseConnection, queryRows, type GiftDatabase } from "../src/db/connection";
import { readGiftRecords, saveGiftRecord, seedGiftLibrary } from "../src/db/gift-repository";
import { takeDatabaseLoginAttempt, resetDatabaseLoginAttempts } from "../src/db/login-limit";
import { verifyRuntimePermissions } from "../src/db/runtime-permissions";
import { giftIdeas } from "../src/lib/gift-ideas";
import { ownerClientKey } from "../src/lib/admin-client";
import { assertOwnerDeployment, configuredAdminOrigin, runtimeDatabaseUrl } from "../src/lib/deployment-config";
import { OwnerLoginLimit } from "../src/lib/admin-login-rate";

const env = {
  APP_DEPLOYMENT: "production", GIFT_DATA_SOURCE: "postgres",
  DATABASE_URL: "postgresql://reader:test-password@database.example/app?sslmode=require",
  ADMIN_DATABASE_URL: "postgresql://editor:test-password@database.example/app?sslmode=require",
  ADMIN_ORIGIN: "https://gifts.example", ADMIN_CLIENT_IP_HEADER: "x-real-ip",
  ADMIN_SESSION_SECRET: "test-only-client-identity-secret-".repeat(2),
};

test("hosted configuration rejects shared users, plaintext transport, migration secrets, and unsafe origins", () => {
  assert.doesNotThrow(() => assertOwnerDeployment(env));
  for (const overrides of [
    { ADMIN_DATABASE_URL: env.DATABASE_URL }, { ADMIN_DATABASE_URL: "" },
    { DATABASE_URL: env.DATABASE_URL.replace("?sslmode=require", "") },
    { MIGRATION_DATABASE_URL: "private-value" }, { GIFT_DATA_SOURCE: "pglite" },
    { ADMIN_ORIGIN: "https://gifts.example/" }, { ADMIN_ORIGIN: "http://gifts.example" },
    { ADMIN_ORIGIN: "" }, { ADMIN_CLIENT_IP_HEADER: "x-forwarded-for" },
    { APP_DEPLOYMENT: "local", NODE_ENV: "production" },
    { ADMIN_DATABASE_URL: env.ADMIN_DATABASE_URL.replace("sslmode=require", "sslmode=require&sslmode=disable") },
    { ADMIN_DATABASE_URL: env.ADMIN_DATABASE_URL + "&options=-c%20role%3Dmft_public" },
    { ADMIN_DATABASE_URL: env.ADMIN_DATABASE_URL.replace("editor", "%72eader") },
  ]) assert.throws(() => assertOwnerDeployment({ ...env, ...overrides }));
  assert.equal(configuredAdminOrigin({ APP_DEPLOYMENT: "local", ADMIN_ORIGIN: "http://127.0.0.1:3000" }), "http://127.0.0.1:3000");
  assert.equal(runtimeDatabaseUrl("editor", env), env.ADMIN_DATABASE_URL);
});

function request(ip?: string) {
  return new Request("https://gifts.example/api/admin/login", { headers: ip ? { "x-real-ip": ip } : {} });
}

test("trusted client identity normalizes IPv6 and mapped IPv4 without trusting chains or other headers", () => {
  assert.equal(ownerClientKey(request("::ffff:192.0.2.1"), env), ownerClientKey(request("192.0.2.1"), env));
  assert.equal(ownerClientKey(request("2001:db8::1"), env), ownerClientKey(request("2001:0db8:0:0:0:0:0:1"), env));
  assert.notEqual(ownerClientKey(request("192.0.2.1"), env), ownerClientKey(request("192.0.2.2"), env));
  for (const ip of [undefined, "192.0.2.1, 192.0.2.2", "192.0.2.1:1234", "[::1]", "fe80::1%eth0", "anything"]) {
    assert.throws(() => ownerClientKey(request(ip), env));
  }
  assert.throws(() => ownerClientKey(new Request("https://gifts.example", {
    headers: { "x-forwarded-for": "192.0.2.1", cookie: "client=owner" },
  }), env));
});

test("local access ignores forwarded identities and rejects non-loopback requests", () => {
  const local = { APP_DEPLOYMENT: "local", ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET };
  const a = new Request("http://127.0.0.1:3000", { headers: { "x-real-ip": "192.0.2.1" } });
  const b = new Request("http://127.0.0.1:3000", { headers: { "x-real-ip": "192.0.2.2" } });
  assert.equal(ownerClientKey(a, local), ownerClientKey(b, local));
  assert.throws(() => ownerClientKey(new Request("http://192.0.2.1:3000"), local));
  assert.throws(() => ownerClientKey(new Request("http://127.0.0.1:3000", { headers: { host: "evil.example" } }), local));
});

test("local client counters are bounded without evicting active budgets", () => {
  let now = 0;
  const limit = new OwnerLoginLimit(() => now);
  for (let i = 0; i < 5000; i++) assert.equal(limit.take(String(i)), true);
  assert.equal(limit.take("new-client"), false);
  for (let i = 1; i < 10; i++) assert.equal(limit.take("0"), true);
  assert.equal(limit.take("0"), false);
  now = 15 * 60 * 1000;
  assert.equal(limit.take("new-client"), true);
});

async function asRole<T>(db: GiftDatabase, role: "mft_public" | "mft_editor", work: () => Promise<T>) {
  const original = queryRows<{ role: string }>(await db.execute(sql`select session_user as role`))[0].role;
  await db.execute(role === "mft_public" ? sql`set session authorization mft_public` : sql`set session authorization mft_editor`);
  try { return await work(); } finally { await db.execute(sql`set session authorization ${sql.identifier(original)}`); }
}

test("rolling windows do not release a burst of recent attempts at the first attempt's expiry", () => {
  let now = 0;
  const limit = new OwnerLoginLimit(() => now);
  assert.equal(limit.take("a"), true);
  now = 15 * 60 * 1000 - 1;
  for (let i = 0; i < 9; i++) assert.equal(limit.take("a"), true);
  now++;
  assert.equal(limit.take("a"), true);
  assert.equal(limit.take("a"), false);
});

test("runtime database groups enforce draft privacy, read-only browsing, and legitimate editing", async () => {
  const connection = await createDatabaseConnection("pglite", { localPath: "memory://" });
  const db = connection.db;
  try {
    await connection.migrate();
    await seedGiftLibrary(db, [giftIdeas[0]]);
    const draft = await saveGiftRecord(db, { gift: { ...giftIdeas[0], id: "private-project" }, published: false, version: null });
    await assert.rejects(verifyRuntimePermissions(db, "public"));
    await asRole(db, "mft_public", async () => {
      await verifyRuntimePermissions(db, "public");
      assert.equal((await readGiftRecords(db, true)).length, 1);
      const children = await db.execute(sql`select * from gift_items where gift_id = 'private-project'`);
      assert.equal(queryRows(children).length, 0);
      await assert.rejects(db.execute(sql`update gift_ideas set title = 'unauthorized'`));
      await assert.rejects(takeDatabaseLoginAttempt(db, "a".repeat(64)));
    });
    await asRole(db, "mft_editor", async () => {
      await verifyRuntimePermissions(db, "editor");
      assert.equal((await readGiftRecords(db, true)).length, 2);
      const published = await saveGiftRecord(db, { ...draft, published: true });
      await saveGiftRecord(db, { ...published, gift: { ...published.gift, steps: ["Edited concrete step"] } });
      await assert.rejects(db.execute(sql`delete from gift_ideas`));
      await assert.rejects(db.execute(sql`select * from app_private.owner_login_attempts`));
    });
    await asRole(db, "mft_public", async () => assert.equal((await readGiftRecords(db, true)).length, 2));
  } finally { await connection.close(); }
});

test("shared counters survive worker changes, isolate clients, expire, and admit only ten parallel attempts", async () => {
  const connection = await createDatabaseConnection("pglite", { localPath: "memory://" });
  const db = connection.db;
  const attacker = "a".repeat(64), owner = "b".repeat(64);
  try {
    await connection.migrate();
    await asRole(db, "mft_editor", async () => {
      const firstWorker = { take: (key: string) => takeDatabaseLoginAttempt(db, key) };
      const secondWorker = { take: (key: string) => takeDatabaseLoginAttempt(db, key) };
      const allowed = await Promise.all(Array.from({ length: 25 }, (_, i) =>
        (i % 2 ? firstWorker : secondWorker).take(attacker)));
      assert.equal(allowed.filter(Boolean).length, 10);
      assert.equal(await secondWorker.take(owner), true);
      await resetDatabaseLoginAttempts(db, owner);
      assert.equal(await firstWorker.take(attacker), false);
      assert.equal(await secondWorker.take(owner), true);
      await assert.rejects(takeDatabaseLoginAttempt(db, "invalid-key"));
    });
    await db.execute(sql`update app_private.owner_login_attempts set
      attempted_at = array[clock_timestamp() - interval '16 minutes'],
      expires_at = clock_timestamp() - interval '1 second'`);
    await asRole(db, "mft_editor", async () => assert.equal(await takeDatabaseLoginAttempt(db, attacker), true));
  } finally { await connection.close(); }
});

test("permission probes reject masked roles, extra memberships, altered privacy guards, and missing editor deletes", async () => {
  const connection = await createDatabaseConnection("pglite", { localPath: "memory://" });
  const db = connection.db;
  try {
    await connection.migrate();
    await seedGiftLibrary(db, [giftIdeas[0]]);
    await saveGiftRecord(db, { gift: { ...giftIdeas[0], id: "guard-private" }, published: false, version: null });
    await db.execute(sql`set role mft_public`);
    await assert.rejects(verifyRuntimePermissions(db, "public"));
    await db.execute(sql`reset role`);
    await db.execute(sql`create role unrelated_writer nologin`);
    await db.execute(sql`alter role mft_public noinherit`);
    await db.execute(sql`grant unrelated_writer to mft_public`);
    await asRole(db, "mft_public", async () => assert.rejects(verifyRuntimePermissions(db, "public")));
    await db.execute(sql`revoke unrelated_writer from mft_public`);
    await db.execute(sql`alter role mft_public inherit`);
    await db.execute(sql`create policy old_broad_policy on gift_ideas for select to public using (true)`);
    await asRole(db, "mft_public", async () => {
      await verifyRuntimePermissions(db, "public");
      assert.equal((await readGiftRecords(db, true)).length, 1);
    });
    await db.execute(sql`alter policy gift_public_guard on gift_ideas using (true)`);
    await asRole(db, "mft_public", async () => assert.rejects(verifyRuntimePermissions(db, "public")));
    await db.execute(sql`alter policy gift_public_guard on gift_ideas using (published)`);
    await db.execute(sql`revoke delete on gift_items from mft_editor`);
    await asRole(db, "mft_editor", async () => assert.rejects(verifyRuntimePermissions(db, "editor")));
  } finally { await connection.close(); }
});
