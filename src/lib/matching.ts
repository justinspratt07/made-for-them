import {
  budgetOptions,
  comfortOptions,
  craftOptions,
  getLabel,
  occasionOptions,
  recipientOptions,
  timeOptions,
  vibeOptions,
} from "./gift-options";
import type { ComfortLevel, CraftType, GiftIdea, QuizState } from "./gift-types";

const comfortScore: Record<ComfortLevel, number> = {
  "first-time": 1,
  beginner: 2,
  comfortable: 3,
  advanced: 4,
};

function budgetMax(value?: string) {
  return budgetOptions.find((option) => option.value === value)?.max ?? 0;
}

function timeMax(value?: string) {
  return timeOptions.find((option) => option.value === value)?.minutes ?? 0;
}

function craftComfortFits(gift: GiftIdea, quiz: QuizState) {
  if (quiz.craftTypes.includes("open")) return true;

  const selectedCrafts = gift.craftTypes.filter((craft) => quiz.craftTypes.includes(craft));
  if (selectedCrafts.length === 0) return false;

  return selectedCrafts.some((craft) => {
    const userComfort = quiz.comfortByCraft[craft];
    const neededComfort = gift.comfort[craft];
    if (!userComfort || !neededComfort) return true;
    return comfortScore[userComfort] >= comfortScore[neededComfort];
  });
}

export type ScoredGift = GiftIdea & {
  score: number;
  reasons: string[];
  reasonDetails: string[];
  cautions: string[];
};

function labelList<T extends string>(options: { value: T; label: string }[], values: T[]) {
  return values.map((value) => getLabel(options, value)).filter(Boolean);
}

function readableList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function primaryCraft(gift: GiftIdea) {
  return gift.craftTypes[0] ?? "open";
}

function sharedCrafts(gift: GiftIdea, quiz: QuizState) {
  if (quiz.craftTypes.includes("open")) return gift.craftTypes.slice(0, 2);
  return gift.craftTypes.filter((craft) => quiz.craftTypes.includes(craft));
}

function matchedVibes(gift: GiftIdea, quiz: QuizState) {
  return quiz.vibes.filter((vibe) => gift.vibes.includes(vibe));
}

function avoidanceMisses(gift: GiftIdea, quiz: QuizState) {
  return quiz.avoidances.filter((avoidance) => {
    if (avoidance === "kid-friendly-only") return !gift.kidFriendly;
    if (avoidance === "ships-well") return !gift.shipsWell;
    return !gift.avoidances.includes(avoidance);
  });
}

function diversify(gifts: ScoredGift[], limit: number) {
  const selected: ScoredGift[] = [];
  const craftCounts = new Map<CraftType, number>();
  const imageCounts = new Map<string, number>();
  const budgetCounts = new Map<string, number>();

  for (const gift of gifts) {
    const craft = primaryCraft(gift);
    const craftCount = craftCounts.get(craft) ?? 0;
    const imageCount = imageCounts.get(gift.image) ?? 0;
    const budgetCount = budgetCounts.get(gift.budget) ?? 0;

    if (craftCount >= 2 || imageCount >= 2 || budgetCount >= 4) continue;

    selected.push(gift);
    craftCounts.set(craft, craftCount + 1);
    imageCounts.set(gift.image, imageCount + 1);
    budgetCounts.set(gift.budget, budgetCount + 1);

    if (selected.length === limit) return selected;
  }

  for (const gift of gifts) {
    if (!selected.some((selectedGift) => selectedGift.id === gift.id)) {
      selected.push(gift);
    }

    if (selected.length === limit) return selected;
  }

  return selected;
}

export function scoreGift(gift: GiftIdea, quiz: QuizState): ScoredGift {
  let score = 0;
  const reasons: string[] = [];
  const reasonDetails: string[] = [];
  const cautions: string[] = [];

  if (quiz.recipient && gift.recipients.includes(quiz.recipient)) {
    score += 18;
    reasons.push("recipient fit");
    reasonDetails.push(`Built for a ${getLabel(recipientOptions, quiz.recipient).toLowerCase()} gift.`);
  }

  if (quiz.occasion && gift.occasions.includes(quiz.occasion)) {
    score += 20;
    reasons.push("occasion fit");
    reasonDetails.push(`Works naturally for ${getLabel(occasionOptions, quiz.occasion).toLowerCase()}.`);
  }

  const matchingCrafts = sharedCrafts(gift, quiz);
  if (quiz.craftTypes.includes("open") || matchingCrafts.length > 0) {
    score += 18;
    reasons.push("craft match");
    const craftLabels = labelList(craftOptions, matchingCrafts);
    reasonDetails.push(
      quiz.craftTypes.includes("open")
        ? `A ${craftLabels[0]?.toLowerCase() || "hands-on"} project that fits an open craft preference.`
        : `Uses ${readableList(craftLabels).toLowerCase()}, which you said you would enjoy making.`,
    );
  } else {
    score -= 18;
    cautions.push("Uses a craft type outside the selected preferences.");
  }

  if (craftComfortFits(gift, quiz)) {
    score += 12;
    reasons.push("comfort fit");
    const craft = matchingCrafts[0] ?? primaryCraft(gift);
    const neededComfort = gift.comfort[craft];
    if (neededComfort) {
      reasonDetails.push(`Skill level is ${getLabel(comfortOptions, neededComfort).toLowerCase()} friendly.`);
    }
  } else {
    score -= 16;
    cautions.push("May be more advanced than the selected comfort level.");
  }

  if (quiz.budget === "use-what-i-have") {
    score += gift.budget === "under-10" ? 12 : 3;
    if (gift.budget === "under-10") {
      reasons.push("budget fit");
      reasonDetails.push("Keeps new supply needs very light.");
    }
  } else if (quiz.budget && budgetMax(gift.budget) <= budgetMax(quiz.budget)) {
    score += 10;
    reasons.push("budget fit");
    reasonDetails.push(
      `${getLabel(budgetOptions, gift.budget)} estimate fits your ${getLabel(budgetOptions, quiz.budget).toLowerCase()} budget.`,
    );
  }

  if (quiz.time && timeMax(gift.time) <= timeMax(quiz.time)) {
    score += 10;
    reasons.push("time fit");
    reasonDetails.push(
      `${getLabel(timeOptions, gift.time)} project fits your ${getLabel(timeOptions, quiz.time).toLowerCase()} timeline.`,
    );
  }

  const vibeMatches = matchedVibes(gift, quiz);
  score += vibeMatches.length * 7;
  if (vibeMatches.length > 0) {
    reasons.push("feeling fit");
    reasonDetails.push(`Feels ${readableList(labelList(vibeOptions, vibeMatches)).toLowerCase()}, matching the tone you chose.`);
  }

  const supplyText = [...gift.materials, ...gift.supplyCategories].join(" ").toLowerCase();
  const supplyMatches = quiz.supplies.filter((supply) =>
    supplyText.includes(supply.toLowerCase().replace(" / ", " ")),
  ).length;
  score += supplyMatches * 5;
  if (supplyMatches > 0) {
    reasons.push("uses what you have");
    reasonDetails.push("Can use supplies you may already have on hand.");
  }

  const misses = avoidanceMisses(gift, quiz);
  score -= misses.length * 11;
  if (quiz.avoidances.length > 0 && misses.length === 0) {
    reasonDetails.push("Respects the limits you selected.");
  } else if (misses.length > 0) {
    cautions.push("Has one or more tradeoffs against your avoid list.");
  }

  return { ...gift, score, reasons: Array.from(new Set(reasons)), reasonDetails, cautions };
}

export function getMatches(gifts: GiftIdea[], quiz: QuizState) {
  const scored = gifts
    .map((gift) => scoreGift(gift, quiz))
    .sort((a, b) => b.score - a.score);

  return {
    best: diversify(scored, 8),
    fast: diversify(scored.filter((gift) => ["under-30", "1-2-hours"].includes(gift.time)), 6),
    personal: diversify(
      scored.filter((gift) => gift.vibes.includes("sentimental") || gift.vibes.includes("personal-private")),
      6,
    ),
    budget: diversify(scored.filter((gift) => ["under-10", "10-25"].includes(gift.budget)), 6),
    impressive: diversify(scored.filter((gift) => gift.vibes.includes("impressive")), 6),
    lowMess: diversify(scored.filter((gift) => gift.messLevel === "low" && gift.dryingTime === "none"), 6),
    mailFriendly: diversify(scored.filter((gift) => gift.shipsWell), 6),
    cozyUseful: diversify(
      scored.filter((gift) => gift.vibes.includes("cozy") || gift.vibes.includes("useful")),
      6,
    ),
    funny: diversify(
      scored.filter((gift) => gift.vibes.includes("funny") || gift.occasions.includes("funny-gag")),
      6,
    ),
  };
}
