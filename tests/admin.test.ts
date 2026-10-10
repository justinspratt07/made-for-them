import assert from "node:assert/strict";
import { test } from "node:test";
import { sealData, unsealData } from "iron-session";
import { hashOwnerPassword, ownerCredentialVersion, verifyOwnerPassword } from "../src/lib/admin-password";
import { OwnerLoginLimit } from "../src/lib/admin-login-rate";
import { giftEditorSchema } from "../src/lib/gift-editor-schema";
import { createDatabaseConnection } from "../src/db/connection";
import { GiftEditConflict, readGiftLibrary, readGiftRecords, saveGiftRecord, seedGiftLibrary } from "../src/db/gift-repository";
import { giftIdeas } from "../src/lib/gift-ideas";
import type { GiftIdea } from "../src/lib/gift-types";

test("owner passwords are hashed and checked without storing plaintext", async () => {
  const hash = await hashOwnerPassword("a-long-owner-test-password");
  assert.equal(hash.includes("a-long-owner-test-password"), false);
  assert.equal(await verifyOwnerPassword("a-long-owner-test-password", hash), true);
  assert.equal(await verifyOwnerPassword("wrong-password", hash), false);
  assert.equal(await verifyOwnerPassword("x".repeat(257), hash), false);
  assert.equal(await verifyOwnerPassword("anything", "malformed"), false);
  assert.notEqual(ownerCredentialVersion(hash), ownerCredentialVersion(await hashOwnerPassword("another-password")));
});

test("session seals reject tampering and a different encryption key", async () => {
  const password = "test-only-session-key-".repeat(3);
  const session = { owner: true, credentialVersion: "version-check" };
  const sealed = await sealData(session, { password, ttl: 60 });
  assert.deepEqual(await unsealData(sealed, { password, ttl: 60 }), session);
  await assert.rejects(unsealData(`x${sealed.slice(1)}`, { password, ttl: 60 }));
  assert.deepEqual(await unsealData(sealed, { password: "different-test-key-".repeat(3), ttl: 60 }), {});
});

test("login attempts are limited and recover after the cooldown", () => {
  let now = 0;
  const limit = new OwnerLoginLimit(() => now);
  for (let i = 0; i < 10; i++) assert.equal(limit.take("attacker"), true);
  assert.equal(limit.take("attacker"), false);
  assert.equal(limit.take("owner"), true);
  limit.reset("owner");
  assert.equal(limit.take("attacker"), false);
  now += 15 * 60 * 1000;
  assert.equal(limit.take("attacker"), true);
  limit.reset("attacker");
  assert.equal(limit.take("attacker"), true);
});

test("project validation rejects unsafe images, invalid categories, and incomplete publishing", () => {
  const gift = giftIdeas[0];
  assert.equal(giftEditorSchema.safeParse({ gift, published: true, version: null }).success, true);
  for (const image of ["javascript:alert(1)", "/../secret.png", "http://example.com/photo.png"]) {
    assert.equal(giftEditorSchema.safeParse({ gift: { ...gift, image }, published: false, version: null }).success, false);
  }
  assert.equal(giftEditorSchema.safeParse({ gift: { ...gift, craftTypes: ["not-a-craft"] }, published: false, version: null }).success, false);
  assert.equal(giftEditorSchema.safeParse({ gift: { ...gift, steps: [] }, published: true, version: null }).success, false);
  assert.equal(giftEditorSchema.safeParse({ gift: { ...gift, comfort: {} }, published: true, version: null }).success, false);
});

test("editor creates drafts, publishes complete projects, and protects newer changes", async (t) => {
  const connection = await createDatabaseConnection("pglite", { localPath: "memory://" });
  try {
    await connection.migrate();
    await seedGiftLibrary(connection.db, [giftIdeas[0]]);
    const draft: GiftIdea = { ...giftIdeas[0], id: "editor-test-draft", title: "New draft", description: "",
      image: "", craftTypes: [], comfort: {}, recipients: [], occasions: [], vibes: [], materials: [], steps: [],
    };
    let current = await saveGiftRecord(connection.db, { gift: draft, published: false, version: null });
    await t.test("incomplete drafts can be saved and stay private", async () => {
      assert.equal((await readGiftLibrary(connection.db)).length, 1);
      assert.equal((await readGiftRecords(connection.db, true)).length, 2);
      assert.deepEqual(current.gift.steps, []);
    });
    await t.test("an incomplete draft cannot be published", async () => {
      await assert.rejects(saveGiftRecord(connection.db, { ...current, published: true }));
      assert.equal((await readGiftLibrary(connection.db)).length, 1);
    });
    await t.test("publishing preserves steps and new content", async () => {
      current = await saveGiftRecord(connection.db, { ...current, gift: { ...giftIdeas[0], id: draft.id }, published: true });
      const publicGift = (await readGiftLibrary(connection.db)).find((gift) => gift.id === draft.id)!;
      assert.deepEqual(publicGift.steps, giftIdeas[0].steps);
    });
    await t.test("the version token rejects a stale editor", async () => {
      const stale = current;
      current = await saveGiftRecord(connection.db, { ...current, gift: { ...current.gift, title: "Newer edit" } });
      assert.notEqual(current.version, stale.version);
      await assert.rejects(saveGiftRecord(connection.db, { ...stale, gift: { ...stale.gift, title: "Stale edit" } }), GiftEditConflict);
      assert.equal((await readGiftRecords(connection.db, true)).find((record) => record.gift.id === draft.id)?.gift.title, "Newer edit");
    });
    await t.test("child rows are replaced in order, not appended", async () => {
      current = await saveGiftRecord(connection.db, { ...current, gift: { ...current.gift, steps: ["First revised step", "Second revised step"] } });
      assert.deepEqual((await readGiftLibrary(connection.db)).find((gift) => gift.id === draft.id)?.steps, ["First revised step", "Second revised step"]);
    });
    await t.test("unpublishing removes the project from public results", async () => {
      current = await saveGiftRecord(connection.db, { ...current, published: false });
      assert.equal((await readGiftLibrary(connection.db)).some((gift) => gift.id === draft.id), false);
      assert.equal((await readGiftRecords(connection.db, true)).find((record) => record.gift.id === draft.id)?.published, false);
    });
    await t.test("creating over an existing ID fails instead of overwriting", async () => {
      await assert.rejects(saveGiftRecord(connection.db, { gift: current.gift, published: false, version: null }), GiftEditConflict);
    });
  } finally { await connection.close(); }
});
