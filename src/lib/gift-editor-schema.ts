import { z } from "zod";
import { avoidanceOptions, budgetOptions, comfortOptions, craftOptions,
  occasionOptions, recipientOptions, timeOptions, vibeOptions } from "./gift-options";

function choices<T extends string>(options: { value: T }[]): [T, ...T[]] {
  return [options[0].value, ...options.slice(1).map((option) => option.value)];
}
const text = z.string().trim().max(5000);
const list = z.array(text.min(1)).max(100);
const image = z.string().trim().max(2000).refine((value) => {
  if (!value) return true;
  if (/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/i.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use a local /assets/ photo path or an HTTPS image URL.");

export const giftEditorSchema = z.strictObject({
  gift: z.strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,90}$/),
    title: text.min(1, "A title is required.").max(160), description: text,
    craftTypes: z.array(z.enum(choices(craftOptions))).max(16),
    comfort: z.record(z.string(), z.enum(choices(comfortOptions))),
    recipients: z.array(z.enum(choices(recipientOptions))).max(10),
    occasions: z.array(z.enum(choices(occasionOptions))).max(30),
    vibes: z.array(z.enum(choices(vibeOptions))).max(10),
    budget: z.enum(choices(budgetOptions)), time: z.enum(choices(timeOptions)),
    materials: list, tools: list, steps: list, personalization: list, wrapping: list,
    supplyCategories: list, retailers: list,
    avoidances: z.array(z.enum(choices(avoidanceOptions))).max(10),
    image, bestFor: text.max(300),
    messLevel: z.enum(["low", "medium", "high"]),
    spaceNeeded: z.enum(["tabletop", "counter", "small workspace"]),
    dryingTime: z.enum(["none", "short", "overnight"]),
    shipsWell: z.boolean(), kidFriendly: z.boolean(),
    patternNotes: z.strictObject({
      finishedSize: text.optional(), gauge: text.optional(), abbreviations: list.optional(), notes: list,
    }).optional(),
  }),
  published: z.boolean(),
  version: z.string().max(100).nullable(),
}).superRefine(({ gift, published }, ctx) => {
  const issue = (field: string, message: string) => ctx.addIssue({
    code: "custom", path: ["gift", field], message,
  });
  for (const field of ["craftTypes", "recipients", "occasions", "vibes", "avoidances"] as const) {
    if (new Set(gift[field]).size !== gift[field].length) issue(field, "Selections must be unique.");
  }
  if (gift.craftTypes.includes("open")) issue("craftTypes", "Choose a specific craft for a project.");
  if (Object.keys(gift.comfort).some((craft) => !gift.craftTypes.includes(craft as typeof gift.craftTypes[number]))) {
    issue("comfort", "Skill requirements must match the selected crafts.");
  }
  if (!published) return;
  for (const field of ["description", "image", "bestFor", "craftTypes", "recipients", "occasions", "vibes", "materials", "steps"] as const) {
    if (!gift[field].length) issue(field, `${field === "craftTypes" ? "Craft types" : field[0].toUpperCase() + field.slice(1)} required to publish.`);
  }
  if (gift.craftTypes.some((craft) => !gift.comfort[craft])) issue("comfort", "Choose a skill level for every craft before publishing.");
});

export type GiftEditorInput = z.infer<typeof giftEditorSchema>;
