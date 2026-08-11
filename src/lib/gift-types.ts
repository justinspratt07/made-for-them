export type ComfortLevel = "first-time" | "beginner" | "comfortable" | "advanced";

export type CraftType =
  | "open"
  | "crochet"
  | "knitting"
  | "sewing"
  | "paper"
  | "painting"
  | "drawing"
  | "candles"
  | "soap-bath"
  | "jewelry"
  | "cricut"
  | "wood"
  | "clay"
  | "floral"
  | "upcycled"
  | "food";

export type RecipientType =
  | "partner"
  | "parent"
  | "friend"
  | "child"
  | "teacher"
  | "coworker"
  | "neighbor"
  | "host"
  | "hard-to-shop-for"
  | "other";

export type Occasion =
  | "birthday"
  | "thank-you"
  | "holiday"
  | "christmas"
  | "valentines"
  | "mothers-day"
  | "fathers-day"
  | "anniversary"
  | "wedding"
  | "bridal-shower"
  | "baby-shower"
  | "housewarming"
  | "teacher-appreciation"
  | "graduation"
  | "congratulations"
  | "get-well"
  | "sympathy-comfort"
  | "new-job"
  | "retirement"
  | "hostess"
  | "just-because"
  | "apology"
  | "encouragement"
  | "funny-gag"
  | "other";

export type GiftVibe =
  | "sentimental"
  | "useful"
  | "cozy"
  | "playful"
  | "elegant"
  | "impressive"
  | "funny"
  | "low-effort"
  | "personal-private"
  | "fun-to-open";

export type BudgetRange = "under-10" | "10-25" | "25-50" | "50-plus" | "use-what-i-have";
export type TimeRange = "under-30" | "1-2-hours" | "one-evening" | "weekend" | "week-plus";

export type Avoidance =
  | "no-sewing"
  | "no-mess"
  | "no-food"
  | "no-drying"
  | "kid-friendly-only"
  | "no-expensive-tools"
  | "no-glitter"
  | "ships-well"
  | "kind-humor"
  | "no-crude-humor";

export type GiftIdea = {
  id: string;
  title: string;
  description: string;
  craftTypes: CraftType[];
  recipients: RecipientType[];
  occasions: Occasion[];
  vibes: GiftVibe[];
  budget: BudgetRange;
  time: TimeRange;
  comfort: Partial<Record<CraftType, ComfortLevel>>;
  materials: string[];
  tools: string[];
  steps: string[];
  patternNotes?: {
    finishedSize?: string;
    gauge?: string;
    abbreviations?: string[];
    notes: string[];
  };
  personalization: string[];
  wrapping: string[];
  supplyCategories: string[];
  retailers: string[];
  avoidances: Avoidance[];
  image: string;
  bestFor: string;
  messLevel: "low" | "medium" | "high";
  spaceNeeded: "tabletop" | "counter" | "small workspace";
  dryingTime: "none" | "short" | "overnight";
  shipsWell: boolean;
  kidFriendly: boolean;
};

export type QuizState = {
  recipient?: RecipientType;
  occasion?: Occasion;
  craftTypes: CraftType[];
  comfortByCraft: Partial<Record<CraftType, ComfortLevel>>;
  time?: TimeRange;
  budget?: BudgetRange;
  vibes: GiftVibe[];
  supplies: string[];
  supplyNote: string;
  avoidances: Avoidance[];
  avoidNote: string;
};
