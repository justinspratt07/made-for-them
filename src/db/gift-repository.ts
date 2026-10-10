import { asc, eq, getTableColumns, inArray, max, sql } from "drizzle-orm";
import type { GiftIdea } from "../lib/gift-types";
import type { GiftDatabase } from "./connection";
import { giftCraftsTable, giftIdeasTable, giftItemsTable } from "./schema";
import { giftEditorSchema } from "../lib/gift-editor-schema";

export type GiftRecord = { gift: GiftIdea; published: boolean; version: string };
const versionToken = sql<string>`to_char(${giftIdeasTable.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export class GiftEditConflict extends Error {}

const itemFields = {
  material: "materials", tool: "tools", step: "steps",
  personalization: "personalization", wrapping: "wrapping",
  supply: "supplyCategories", retailer: "retailers",
} as const;

export async function readGiftLibrary(db: GiftDatabase): Promise<GiftIdea[]> {
  return (await readGiftRecords(db)).map((record) => record.gift);
}

export async function readGiftRecords(db: GiftDatabase, includeDrafts = false): Promise<GiftRecord[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ ...getTableColumns(giftIdeasTable), version: versionToken }).from(giftIdeasTable)
      .where(includeDrafts ? undefined : eq(giftIdeasTable.published, true))
      .orderBy(asc(giftIdeasTable.displayOrder), asc(giftIdeasTable.id));
    if (rows.length === 0) return [];
    const ids = rows.map((gift) => gift.id);
    const [crafts, items] = await Promise.all([
      tx.select().from(giftCraftsTable).where(inArray(giftCraftsTable.giftId, ids))
        .orderBy(asc(giftCraftsTable.position)),
      tx.select().from(giftItemsTable).where(inArray(giftItemsTable.giftId, ids))
        .orderBy(asc(giftItemsTable.position)),
    ]);
    const gifts = new Map<string, GiftIdea>();
    for (const row of rows) {
      const { published, displayOrder, createdAt, updatedAt, patternNotes, version, ...details } = row;
      void published; void displayOrder; void createdAt; void updatedAt; void version;
      gifts.set(row.id, {
        ...details,
        ...(patternNotes ? { patternNotes } : {}),
        craftTypes: [], comfort: {}, materials: [], tools: [], steps: [],
        personalization: [], wrapping: [], supplyCategories: [], retailers: [],
      });
    }
    for (const row of crafts) {
      const gift = gifts.get(row.giftId)!;
      gift.craftTypes.push(row.craft);
      if (row.comfort) gift.comfort[row.craft] = row.comfort;
    }
    for (const row of items) gifts.get(row.giftId)![itemFields[row.kind]].push(row.content);
    for (const row of rows) {
      const gift = gifts.get(row.id)!;
      if (row.published && (!gift.craftTypes.length || !gift.steps.length || !gift.materials.length)) {
        throw new Error("A published gift is missing its craft, materials, or instructions.");
      }
    }
    return rows.map((row) => ({ gift: gifts.get(row.id)!, published: row.published, version: row.version }));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function saveGiftRecord(db: GiftDatabase, input: unknown): Promise<GiftRecord> {
  const { gift, published, version } = giftEditorSchema.parse(input);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: giftIdeasTable.id, version: versionToken })
      .from(giftIdeasTable).where(eq(giftIdeasTable.id, gift.id)).for("update");
    if (existing ? existing.version !== version : version !== null) {
      throw new GiftEditConflict("This project changed in another tab. Reload the library before saving.");
    }
    const { craftTypes, comfort, materials, tools, steps, personalization, wrapping,
      supplyCategories, retailers, patternNotes, ...details } = gift;
    const data = { ...details, patternNotes: patternNotes ?? null, published };
    if (existing) {
      await tx.update(giftIdeasTable).set({ ...data,
        updatedAt: sql`greatest(clock_timestamp(), ${giftIdeasTable.updatedAt} + interval '1 microsecond')`,
      }).where(eq(giftIdeasTable.id, gift.id));
      await tx.delete(giftCraftsTable).where(eq(giftCraftsTable.giftId, gift.id));
      await tx.delete(giftItemsTable).where(eq(giftItemsTable.giftId, gift.id));
    } else {
      const [order] = await tx.select({ last: max(giftIdeasTable.displayOrder) }).from(giftIdeasTable);
      const inserted = await tx.insert(giftIdeasTable).values({ ...data,
        displayOrder: (order.last ?? -1) + 1,
      }).onConflictDoNothing({ target: giftIdeasTable.id }).returning({ id: giftIdeasTable.id });
      if (!inserted.length) throw new GiftEditConflict("This project already exists. Reload the library.");
    }
    if (craftTypes.length) await tx.insert(giftCraftsTable).values(craftTypes.map((craft, position) => ({
      giftId: gift.id, craft, comfort: comfort[craft] ?? null, position,
    })));
    const lists = { materials, tools, steps, personalization, wrapping, supplyCategories, retailers };
    const items = Object.entries(itemFields).flatMap(([kind, field]) => lists[field].map((content, position) => ({
      giftId: gift.id, kind: kind as keyof typeof itemFields, position, content,
    })));
    if (items.length) await tx.insert(giftItemsTable).values(items);
    const [saved] = await tx.select({ version: versionToken }).from(giftIdeasTable)
      .where(eq(giftIdeasTable.id, gift.id));
    return { gift, published, version: saved.version };
  });
}

// Import only missing gifts, so rerunning setup cannot overwrite curated edits.
export async function seedGiftLibrary(db: GiftDatabase, gifts: GiftIdea[]): Promise<number> {
  if (new Set(gifts.map((gift) => gift.id)).size !== gifts.length) {
    throw new Error("Seed library contains duplicate gift IDs.");
  }
  return db.transaction(async (tx) => {
    let insertedCount = 0;
    for (const [displayOrder, gift] of gifts.entries()) {
      const rows = await tx.insert(giftIdeasTable).values({
        id: gift.id, title: gift.title, description: gift.description,
        recipients: gift.recipients, occasions: gift.occasions, vibes: gift.vibes,
        budget: gift.budget, time: gift.time, avoidances: gift.avoidances,
        patternNotes: gift.patternNotes ?? null, image: gift.image, bestFor: gift.bestFor,
        messLevel: gift.messLevel, spaceNeeded: gift.spaceNeeded, dryingTime: gift.dryingTime,
        shipsWell: gift.shipsWell, kidFriendly: gift.kidFriendly, published: true, displayOrder,
      }).onConflictDoNothing({ target: giftIdeasTable.id }).returning({ id: giftIdeasTable.id });
      if (rows.length === 0) continue;
      if (!gift.craftTypes.length || !gift.steps.length || !gift.materials.length) {
        throw new Error("Seed gifts must include crafts, materials, and instructions.");
      }
      await tx.insert(giftCraftsTable).values(gift.craftTypes.map((craft, position) => ({
        giftId: gift.id, craft, comfort: gift.comfort[craft] ?? null, position,
      })));
      const items = Object.entries(itemFields).flatMap(([kind, field]) =>
        gift[field].map((content, position) => ({
          giftId: gift.id, kind: kind as keyof typeof itemFields, position, content,
        })),
      );
      await tx.insert(giftItemsTable).values(items);
      insertedCount++;
    }
    return insertedCount;
  });
}
