import type {
  Avoidance,
  BudgetRange,
  ComfortLevel,
  CraftType,
  GiftVibe,
  Occasion,
  RecipientType,
  TimeRange,
} from "./gift-types";

export const recipientOptions: { value: RecipientType; label: string }[] = [
  { value: "partner", label: "Partner" },
  { value: "parent", label: "Parent" },
  { value: "friend", label: "Friend" },
  { value: "child", label: "Child" },
  { value: "teacher", label: "Teacher" },
  { value: "coworker", label: "Coworker" },
  { value: "neighbor", label: "Neighbor" },
  { value: "host", label: "Host" },
  { value: "hard-to-shop-for", label: "Someone hard to shop for" },
  { value: "other", label: "Other" },
];

export const occasionOptions: { value: Occasion; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "thank-you", label: "Thank you" },
  { value: "holiday", label: "Holiday" },
  { value: "housewarming", label: "Housewarming" },
  { value: "congratulations", label: "Congratulations" },
  { value: "get-well", label: "Get well soon" },
  { value: "funny-gag", label: "Funny / gag gift" },
  { value: "just-because", label: "Just because" },
  { value: "christmas", label: "Christmas" },
  { value: "valentines", label: "Valentine's Day" },
  { value: "mothers-day", label: "Mother's Day" },
  { value: "fathers-day", label: "Father's Day" },
  { value: "anniversary", label: "Anniversary" },
  { value: "wedding", label: "Wedding" },
  { value: "bridal-shower", label: "Bridal shower" },
  { value: "baby-shower", label: "Baby shower" },
  { value: "teacher-appreciation", label: "Teacher appreciation" },
  { value: "graduation", label: "Graduation" },
  { value: "sympathy-comfort", label: "Sympathy / comfort" },
  { value: "new-job", label: "New job" },
  { value: "retirement", label: "Retirement" },
  { value: "hostess", label: "Host / hostess gift" },
  { value: "apology", label: "Apology" },
  { value: "encouragement", label: "Encouragement" },
  { value: "other", label: "Other" },
];

export const craftOptions: { value: CraftType; label: string }[] = [
  { value: "open", label: "I'm open to anything" },
  { value: "crochet", label: "Crochet" },
  { value: "knitting", label: "Knitting" },
  { value: "sewing", label: "Sewing" },
  { value: "paper", label: "Paper crafts" },
  { value: "painting", label: "Painting" },
  { value: "drawing", label: "Drawing" },
  { value: "candles", label: "Candles" },
  { value: "soap-bath", label: "Soap / bath gifts" },
  { value: "jewelry", label: "Jewelry" },
  { value: "cricut", label: "Cricut / vinyl" },
  { value: "wood", label: "Wood crafts" },
  { value: "clay", label: "Clay" },
  { value: "floral", label: "Floral" },
  { value: "upcycled", label: "Upcycled" },
  { value: "food", label: "Food gifts" },
];

export const comfortOptions: { value: ComfortLevel; label: string; description: string }[] = [
  { value: "first-time", label: "First time", description: "I need very simple steps" },
  { value: "beginner", label: "Beginner", description: "I know the basics" },
  { value: "comfortable", label: "Comfortable", description: "I can follow a project" },
  { value: "advanced", label: "Advanced", description: "I'm up for detail work" },
];

export const timeOptions: { value: TimeRange; label: string; minutes: number }[] = [
  { value: "under-30", label: "Under 30 minutes", minutes: 30 },
  { value: "1-2-hours", label: "1-2 hours", minutes: 120 },
  { value: "one-evening", label: "One evening", minutes: 240 },
  { value: "weekend", label: "This weekend", minutes: 720 },
  { value: "week-plus", label: "A week or more", minutes: 2000 },
];

export const budgetOptions: { value: BudgetRange; label: string; max: number }[] = [
  { value: "under-10", label: "$0-$10", max: 10 },
  { value: "10-25", label: "$10-$25", max: 25 },
  { value: "25-50", label: "$25-$50", max: 50 },
  { value: "50-plus", label: "$50+", max: 100 },
  { value: "use-what-i-have", label: "I'd rather use what I have", max: 0 },
];

export const vibeOptions: { value: GiftVibe; label: string }[] = [
  { value: "sentimental", label: "Sentimental" },
  { value: "useful", label: "Useful" },
  { value: "cozy", label: "Cozy" },
  { value: "playful", label: "Playful" },
  { value: "elegant", label: "Elegant" },
  { value: "impressive", label: "Impressive" },
  { value: "funny", label: "Funny" },
  { value: "low-effort", label: "Low-effort but thoughtful" },
  { value: "personal-private", label: "Personal/private" },
  { value: "fun-to-open", label: "Fun to open" },
];

export const supplyOptions = [
  "Yarn",
  "Paper",
  "Paint",
  "Jars",
  "Fabric",
  "Candles / wax",
  "Beads",
  "Vinyl",
  "Wood",
  "Clay",
  "Pantry items",
  "Not sure",
];

export const avoidanceOptions: { value: Avoidance; label: string }[] = [
  { value: "no-sewing", label: "No sewing" },
  { value: "no-mess", label: "No messy projects" },
  { value: "no-food", label: "No food gifts" },
  { value: "no-drying", label: "No drying time" },
  { value: "kid-friendly-only", label: "Kid-friendly only" },
  { value: "no-expensive-tools", label: "No expensive tools" },
  { value: "no-glitter", label: "No glitter" },
  { value: "ships-well", label: "Needs to ship well" },
  { value: "kind-humor", label: "Keep humor kind" },
  { value: "no-crude-humor", label: "No crude humor" },
];

export function getLabel<T extends string>(options: { value: T; label: string }[], value?: T) {
  return options.find((option) => option.value === value)?.label ?? "";
}
