import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { createDatabaseConnection } from "../src/db/connection";
import { getGiftDataSource } from "../src/db/config";
import { readGiftLibrary, seedGiftLibrary } from "../src/db/gift-repository";
import { giftCraftsTable, giftIdeasTable, giftItemsTable } from "../src/db/schema";
import { giftIdeas } from "../src/lib/gift-ideas";
import { getMatches } from "../src/lib/matching";
import type { QuizState } from "../src/lib/gift-types";

test("gift library PostgreSQL integration", async (t) => {
  const connection = await createDatabaseConnection("pglite", { localPath: "memory://" });
  const db = connection.db;
  try {
    await t.test("migrations can be applied twice", async () => {
      await connection.migrate();
      await connection.migrate();
      assert.deepEqual(await readGiftLibrary(db), []);
    });

    await t.test("every gift and ordered pattern instruction survives import", async () => {
      assert.equal(await seedGiftLibrary(db, giftIdeas), giftIdeas.length);
      assert.deepEqual(await readGiftLibrary(db), giftIdeas);
    });

    await t.test("repeated imports preserve edited content", async () => {
      const first = giftIdeas[0];
      await db.update(giftIdeasTable).set({ title: "A curator's edited gift" })
        .where(eq(giftIdeasTable.id, first.id));
      assert.equal(await seedGiftLibrary(db, giftIdeas), 0);
      assert.equal((await readGiftLibrary(db))[0].title, "A curator's edited gift");
      await db.update(giftIdeasTable).set({ title: first.title })
        .where(eq(giftIdeasTable.id, first.id));
    });

    await t.test("draft gifts stay out of the public library", async () => {
      const first = giftIdeas[0];
      await db.update(giftIdeasTable).set({ published: false }).where(eq(giftIdeasTable.id, first.id));
      assert.equal((await readGiftLibrary(db)).some((gift) => gift.id === first.id), false);
      await db.update(giftIdeasTable).set({ published: true }).where(eq(giftIdeasTable.id, first.id));
    });

    await t.test("database gifts produce the same recommendations", async () => {
      const library = await readGiftLibrary(db);
      const base: QuizState = {
        recipient: "friend", occasion: "birthday", craftTypes: ["open"], comfortByCraft: {},
        time: "one-evening", budget: "10-25", vibes: ["sentimental"],
        supplies: [], supplyNote: "", avoidances: [], avoidNote: "",
      };
      for (const quiz of [base, {
        ...base, craftTypes: ["crochet"] as QuizState["craftTypes"],
        comfortByCraft: { crochet: "beginner" } as QuizState["comfortByCraft"],
        vibes: ["cozy"] as QuizState["vibes"],
      }, { ...base, avoidances: ["no-food"] as QuizState["avoidances"] }]) {
        assert.deepEqual(getMatches(library, quiz), getMatches(giftIdeas, quiz));
      }
    });

    await t.test("foreign keys and instruction positions reject invalid writes", async () => {
      await assert.rejects(db.insert(giftItemsTable).values({
        giftId: "missing-gift", kind: "step", position: 0, content: "Orphan instruction",
      }));
      await assert.rejects(db.insert(giftItemsTable).values({
        giftId: giftIdeas[0].id, kind: "step", position: -1, content: "Invalid position",
      }));
      await assert.rejects(db.insert(giftItemsTable).values({
        giftId: giftIdeas[0].id, kind: "step", position: 0, content: "Duplicate position",
      }));
    });

    await t.test("failed imports roll back the whole transaction", async () => {
      const valid = { ...giftIdeas[0], id: "rollback-valid" };
      const invalid = { ...giftIdeas[0], id: "rollback-invalid", steps: [] };
      await assert.rejects(seedGiftLibrary(db, [valid, invalid]));
      const rows = await db.select().from(giftIdeasTable).where(eq(giftIdeasTable.id, valid.id));
      assert.equal(rows.length, 0);
    });

    await t.test("deleting a gift removes its dependent details", async () => {
      const temporary = { ...giftIdeas[0], id: "cascade-check" };
      await seedGiftLibrary(db, [temporary]);
      await db.delete(giftIdeasTable).where(eq(giftIdeasTable.id, temporary.id));
      assert.equal((await db.select().from(giftItemsTable)
        .where(eq(giftItemsTable.giftId, temporary.id))).length, 0);
      assert.equal((await db.select().from(giftCraftsTable)
        .where(eq(giftCraftsTable.giftId, temporary.id))).length, 0);
    });

    await t.test("all library tables have row level security enabled", async () => {
      const result = await db.execute(sql`
        select relname, relrowsecurity from pg_class
        where relname in ('gift_ideas', 'gift_crafts', 'gift_items')
      `);
      const rows = result as unknown as { rows: { relrowsecurity: boolean }[] };
      assert.equal(rows.rows.length, 3);
      assert.equal(rows.rows.every((row) => row.relrowsecurity), true);
    });
  } finally {
    await connection.close();
  }
});

test("local database persists across process restarts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "made-for-them-db-"));
  const runNode = promisify(execFile);
  const env = { ...process.env, LOCAL_DATABASE_PATH: directory };
  try {
    const imports = `
      const { createDatabaseConnection } = require('./src/db/connection.ts');
      const { readGiftLibrary, seedGiftLibrary } = require('./src/db/gift-repository.ts');
      const { giftIdeas } = require('./src/lib/gift-ideas.ts');
    `;
    await runNode(process.execPath, ["--import", "tsx", "--eval", `${imports}
      (async () => {
        const connection = await createDatabaseConnection('pglite');
        try {
          await connection.migrate();
          await seedGiftLibrary(connection.db, [giftIdeas[0]]);
        } finally { await connection.close(); }
      })().catch((error) => { console.error(error); process.exitCode = 1; });
    `], { env });
    const { stdout } = await runNode(process.execPath, ["--import", "tsx", "--eval", `${imports}
      (async () => {
        const connection = await createDatabaseConnection('pglite');
        try { console.log(JSON.stringify(await readGiftLibrary(connection.db))); }
        finally { await connection.close(); }
      })().catch((error) => { console.error(error); process.exitCode = 1; });
    `], { env });
    assert.deepEqual(JSON.parse(stdout), [giftIdeas[0]]);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("data source configuration is explicit and static previews stay independent", async () => {
  assert.equal(getGiftDataSource({}), "starter");
  assert.equal(getGiftDataSource({ GIFT_DATA_SOURCE: "pglite" }), "pglite");
  assert.equal(getGiftDataSource({ GIFT_DATA_SOURCE: "postgres" }), "postgres");
  assert.equal(getGiftDataSource({ GIFT_DATA_SOURCE: "postgres", GITHUB_PAGES: "true" }), "starter");
  assert.equal(getGiftDataSource({ GIFT_DATA_SOURCE: "pglite", STATIC_EXPORT: "true" }), "starter");
  assert.throws(() => getGiftDataSource({ GIFT_DATA_SOURCE: "typo" }));
  await assert.rejects(createDatabaseConnection("postgres", { url: "" }), /DATABASE_URL/);
});
