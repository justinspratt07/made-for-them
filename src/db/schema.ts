import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  avoidanceOptions, budgetOptions, comfortOptions, craftOptions,
  occasionOptions, recipientOptions, timeOptions, vibeOptions,
} from "../lib/gift-options";
import type { GiftIdea } from "../lib/gift-types";

function optionValues<T extends string>(options: { value: T }[]): [T, ...T[]] {
  if (options.length === 0) throw new Error("Database options cannot be empty.");
  return [options[0].value, ...options.slice(1).map((option) => option.value)];
}

export const craftEnum = pgEnum("craft_type", optionValues(craftOptions));
export const comfortEnum = pgEnum("comfort_level", optionValues(comfortOptions));
export const recipientEnum = pgEnum("recipient_type", optionValues(recipientOptions));
export const occasionEnum = pgEnum("occasion", optionValues(occasionOptions));
export const vibeEnum = pgEnum("gift_vibe", optionValues(vibeOptions));
export const budgetEnum = pgEnum("budget_range", optionValues(budgetOptions));
export const timeEnum = pgEnum("time_range", optionValues(timeOptions));
export const avoidanceEnum = pgEnum("avoidance", optionValues(avoidanceOptions));
export const messEnum = pgEnum("mess_level", ["low", "medium", "high"]);
export const spaceEnum = pgEnum("space_needed", ["tabletop", "counter", "small workspace"]);
export const dryingEnum = pgEnum("drying_time", ["none", "short", "overnight"]);
export const itemKindEnum = pgEnum("gift_item_kind", [
  "material", "tool", "step", "personalization", "wrapping", "supply", "retailer",
]);

export const giftIdeasTable = pgTable("gift_ideas", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recipients: recipientEnum("recipients").array().notNull(),
  occasions: occasionEnum("occasions").array().notNull(),
  vibes: vibeEnum("vibes").array().notNull(),
  budget: budgetEnum("budget").notNull(),
  time: timeEnum("time").notNull(),
  avoidances: avoidanceEnum("avoidances").array().notNull(),
  patternNotes: jsonb("pattern_notes").$type<GiftIdea["patternNotes"]>(),
  image: text("image").notNull(),
  bestFor: text("best_for").notNull(),
  messLevel: messEnum("mess_level").notNull(),
  spaceNeeded: spaceEnum("space_needed").notNull(),
  dryingTime: dryingEnum("drying_time").notNull(),
  shipsWell: boolean("ships_well").notNull(),
  kidFriendly: boolean("kid_friendly").notNull(),
  published: boolean("published").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("gift_ideas_published_order_idx").on(table.published, table.displayOrder, table.id),
  check("gift_ideas_display_order_check", sql`${table.displayOrder} >= 0`),
  check("gift_ideas_title_check", sql`length(trim(${table.title})) > 0`),
]).enableRLS();

export const giftCraftsTable = pgTable("gift_crafts", {
  giftId: text("gift_id").notNull().references(() => giftIdeasTable.id, { onDelete: "cascade" }),
  craft: craftEnum("craft").notNull(),
  comfort: comfortEnum("comfort"),
  position: integer("position").notNull(),
}, (table) => [
  primaryKey({ columns: [table.giftId, table.craft] }),
  uniqueIndex("gift_crafts_position_idx").on(table.giftId, table.position),
  check("gift_crafts_position_check", sql`${table.position} >= 0`),
]).enableRLS();

export const giftItemsTable = pgTable("gift_items", {
  giftId: text("gift_id").notNull().references(() => giftIdeasTable.id, { onDelete: "cascade" }),
  kind: itemKindEnum("kind").notNull(),
  position: integer("position").notNull(),
  content: text("content").notNull(),
}, (table) => [
  primaryKey({ columns: [table.giftId, table.kind, table.position] }),
  check("gift_items_position_check", sql`${table.position} >= 0`),
  check("gift_items_content_check", sql`length(trim(${table.content})) > 0`),
]).enableRLS();
