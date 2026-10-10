"use client";

import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Heart,
  Menu,
  PackageCheck,
  Printer,
  Scissors,
  Search,
  Share2,
  Sparkles,
  Tag,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useId, useMemo, useState } from "react";
import {
  avoidanceOptions,
  budgetOptions,
  comfortOptions,
  craftOptions,
  getLabel,
  occasionOptions,
  recipientOptions,
  supplyOptions,
  timeOptions,
  vibeOptions,
} from "@/lib/gift-options";
import type {
  Avoidance,
  BudgetRange,
  ComfortLevel,
  CraftType,
  GiftIdea,
  GiftVibe,
  Occasion,
  QuizState,
  RecipientType,
  TimeRange,
} from "@/lib/gift-types";
import { getMatches, type ScoredGift } from "@/lib/matching";

const initialQuiz: QuizState = {
  craftTypes: [],
  comfortByCraft: {},
  vibes: [],
  supplies: [],
  supplyNote: "",
  avoidances: [],
  avoidNote: "",
};

const requiredSteps = [
  "recipient",
  "occasion",
  "crafts",
  "comfort",
  "time",
  "budget",
  "vibes",
] as const;

type WizardStep = (typeof requiredSteps)[number] | "supplies" | "avoid";

const wizardSteps: WizardStep[] = [...requiredSteps, "supplies", "avoid"];

const craftIcons: Partial<Record<CraftType, LucideIcon>> = {
  open: Sparkles,
  crochet: Scissors,
  knitting: Scissors,
  sewing: Scissors,
  paper: Tag,
  painting: Wand2,
  drawing: Wand2,
  candles: Sparkles,
  "soap-bath": Sparkles,
  jewelry: Heart,
  cricut: Scissors,
  wood: PackageCheck,
  clay: PackageCheck,
  floral: Heart,
  upcycled: PackageCheck,
  food: Gift,
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function assetPath(path: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return path.startsWith("/") ? `${basePath}${path}` : path;
}

function toggleArray<T>(items: T[], item: T) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

function selectedCraftsForComfort(quiz: QuizState) {
  return quiz.craftTypes.filter((craft) => craft !== "open");
}

function isRequiredComplete(quiz: QuizState) {
  return Boolean(
    quiz.recipient &&
      quiz.occasion &&
      quiz.craftTypes.length > 0 &&
      quiz.time &&
      quiz.budget &&
      quiz.vibes.length > 0 &&
      (quiz.craftTypes.includes("open") ||
        selectedCraftsForComfort(quiz).every((craft) => quiz.comfortByCraft[craft])),
  );
}

function ideaMeta(gift: GiftIdea) {
  return [
    getLabel(craftOptions, gift.craftTypes[0]),
    getLabel(budgetOptions, gift.budget),
    getLabel(timeOptions, gift.time),
    getLabel(comfortOptions, Object.values(gift.comfort)[0]),
  ].filter(Boolean);
}

function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    "recipient fit": "Right recipient",
    "occasion fit": "Fits the occasion",
    "craft match": "Matches your craft",
    "comfort fit": "Comfortable skill level",
    "budget fit": "Within budget",
    "time fit": "Fits your timeline",
    "feeling fit": "Matches the feeling",
    "uses what you have": "Uses supplies you may have",
  };

  return labels[reason] ?? reason;
}

function matchNotes(gift: ScoredGift, count = 2) {
  return gift.reasonDetails.length > 0
    ? gift.reasonDetails.slice(0, count)
    : [`Strong overall fit for ${gift.bestFor.toLowerCase()}.`];
}

function giftLogistics(gift: GiftIdea) {
  return [
    `Mess: ${gift.messLevel}`,
    `Space: ${gift.spaceNeeded}`,
    `Drying: ${gift.dryingTime}`,
    gift.shipsWell ? "Ships well" : "Best hand-delivered",
  ];
}

function comfortLabel(gift: GiftIdea) {
  return getLabel(comfortOptions, Object.values(gift.comfort)[0]);
}

function suggestedRetailSearch(retailer: string, item: string) {
  const query = encodeURIComponent(item);
  const retailerName = encodeURIComponent(retailer);

  if (retailer === "Amazon") return `https://www.amazon.com/s?k=${query}`;
  if (retailer === "Michaels") return `https://www.michaels.com/search?q=${query}`;
  if (retailer === "Hobby Lobby") return `https://www.hobbylobby.com/search/?text=${query}`;
  if (retailer === "Blick") return `https://www.dickblick.com/search/?q=${query}`;
  if (retailer === "Cricut") return `https://cricut.com/search?q=${query}`;
  if (retailer === "Target") return `https://www.target.com/s?searchTerm=${query}`;
  if (retailer === "Walmart") return `https://www.walmart.com/search?q=${query}`;
  if (retailer === "Dollar Tree") return `https://www.dollartree.com/searchresults?Ntt=${query}`;
  if (retailer === "Home Depot") return `https://www.homedepot.com/s/${query}`;
  if (retailer === "Lowe's") return `https://www.lowes.com/search?searchTerm=${query}`;
  if (retailer === "Etsy") return `https://www.etsy.com/search?q=${query}`;

  return `https://www.google.com/search?q=${retailerName}+${query}`;
}

function formatList(title: string, items: string[]) {
  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
}

function formatShoppingList(gift: GiftIdea) {
  const storeSearches = gift.supplyCategories.slice(0, 5).flatMap((item) => [
    `${item}:`,
    ...gift.retailers.slice(0, 3).map((retailer) => `- ${retailer}: ${suggestedRetailSearch(retailer, item)}`),
  ]);

  return [
    `Made For Them shopping list`,
    gift.title,
    "",
    formatList("Materials", gift.materials),
    "",
    formatList("Tools", gift.tools),
    "",
    "Store search links:",
    ...storeSearches,
  ].join("\n");
}

function formatGiftPlanSummary(gift: GiftIdea, url: string) {
  return [
    `${gift.title}`,
    gift.description,
    "",
    `Best for: ${gift.bestFor}`,
    `Time: ${getLabel(timeOptions, gift.time)}`,
    `Budget: ${getLabel(budgetOptions, gift.budget)}`,
    `Skill: ${comfortLabel(gift)}`,
    "",
    formatList("Materials", gift.materials),
    "",
    formatList("Tools", gift.tools),
    "",
    formatList("Steps", gift.steps.map((step, index) => `${index + 1}. ${step}`)),
    "",
    formatList("Personal touches", gift.personalization),
    "",
    formatList("Wrapping", gift.wrapping),
    "",
    `Made For Them: ${url}`,
  ].join("\n");
}

async function writeToClipboard(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable in this browser.");
  }

  await navigator.clipboard.writeText(text);
}

export function MadeForThemApp({ giftIdeas }: { giftIdeas: GiftIdea[] }) {
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz);
  const [showResults, setShowResults] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const matches = useMemo(() => getMatches(giftIdeas, quiz), [giftIdeas, quiz]);
  const selectedGift = useMemo(() => {
    const displayedMatches = [
      ...matches.best,
      ...matches.fast,
      ...matches.personal,
      ...matches.budget,
      ...matches.impressive,
      ...matches.lowMess,
      ...matches.mailFriendly,
      ...matches.cozyUseful,
      ...matches.funny,
    ];

    return displayedMatches.find((gift) => gift.id === selectedGiftId) ?? matches.best[0];
  }, [matches, selectedGiftId]);

  const completion = Math.round(
    ([
      quiz.recipient,
      quiz.occasion,
      quiz.craftTypes.length > 0,
      quiz.time,
      quiz.budget,
      quiz.vibes.length > 0,
      quiz.craftTypes.includes("open") ||
        selectedCraftsForComfort(quiz).every((craft) => quiz.comfortByCraft[craft]),
    ].filter(Boolean).length /
      7) *
      100,
  );

  const updateQuiz = (patch: Partial<QuizState>) => {
    setQuiz((current) => ({ ...current, ...patch }));
  };

  const setCraftTypes = (craft: CraftType) => {
    setQuiz((current) => {
      const nextCrafts =
        craft === "open"
          ? current.craftTypes.includes("open")
            ? []
            : ["open" as CraftType]
          : toggleArray(current.craftTypes.filter((item) => item !== "open"), craft);

      const comfortByCraft = { ...current.comfortByCraft };
      Object.keys(comfortByCraft).forEach((key) => {
        if (!nextCrafts.includes(key as CraftType)) {
          delete comfortByCraft[key as CraftType];
        }
      });

      return { ...current, craftTypes: nextCrafts, comfortByCraft };
    });
  };

  const submitQuiz = () => {
    if (!isRequiredComplete(quiz)) return;
    setShowResults(true);
    setSelectedGiftId(null);
    requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => toggleArray(current, id));
  };

  const copyShoppingList = async (gift: GiftIdea) => {
    try {
      await writeToClipboard(formatShoppingList(gift));
      setActionMessage("Shopping list copied with materials, tools, and store links.");
    } catch {
      setActionMessage("Copy was blocked by this browser. Try Print Plan instead.");
    }
  };

  const shareGift = async (gift: GiftIdea) => {
    const shareText = formatGiftPlanSummary(gift, window.location.href);

    try {
      if (navigator.share) {
        await navigator.share({ title: gift.title, text: shareText, url: window.location.href });
        setActionMessage("Share sheet opened for this gift plan.");
        return;
      }

      await writeToClipboard(shareText);
      setActionMessage("Gift plan copied so you can paste it into a message.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setActionMessage("Share canceled.");
        return;
      }

      setActionMessage("Share was blocked by this browser. Try Copy Shopping List or Print Plan.");
    }
  };

  if (giftIdeas.length === 0) return (
    <main className="min-h-screen"><Header savedCount={savedIds.length} />
      <section className="mx-auto max-w-2xl px-6 py-16"><h1 className="font-serif text-2xl font-semibold">New gift ideas are on their way.</h1>
        <p className="mt-4 text-[var(--muted)]">Please check back soon.</p></section>
    </main>
  );

  return (
    <main className="min-h-screen overflow-hidden">
      <Header savedCount={savedIds.length} />
      <section className="relative mx-auto grid w-full max-w-[1440px] gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.03fr)_minmax(360px,0.8fr)] lg:px-10 lg:pb-24 lg:pt-12">
        <div className="absolute left-[-100px] top-[46%] hidden h-1 w-[280px] rotate-[-12deg] bg-[var(--cranberry)] opacity-85 lg:block" />
        <div className="min-w-0">
          <div className="mb-6 max-w-3xl">
            <h1 className="font-serif text-[clamp(2.4rem,4.6vw,4.25rem)] font-semibold leading-[0.98] text-[var(--ink)]">
              Make Something That Feels Like Them
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Answer a few questions and get handmade gift ideas matched to their personality,
              your budget, your craft choices, and the time you actually have.
            </p>
          </div>

          <DesktopQuiz
            quiz={quiz}
            completion={completion}
            onUpdate={updateQuiz}
            onCraftToggle={setCraftTypes}
            onSubmit={submitQuiz}
          />
          <MobileQuiz
            quiz={quiz}
            step={mobileStep}
            completion={completion}
            onStepChange={setMobileStep}
            onUpdate={updateQuiz}
            onCraftToggle={setCraftTypes}
            onSubmit={submitQuiz}
          />
        </div>

        <aside className="min-w-0 lg:pt-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sage)]">
                Curated preview
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">A few ideas already waiting</h2>
            </div>
          </div>
          <div className="space-y-4">
            {matches.best.slice(0, 3).map((gift, index) => (
              <GiftPreviewCard
                key={gift.id}
                gift={gift}
                rank={index + 1}
                saved={savedIds.includes(gift.id)}
                onSave={() => toggleSaved(gift.id)}
                onSelect={() => {
                  setShowResults(true);
                  setSelectedGiftId(gift.id);
                }}
              />
            ))}
          </div>
        </aside>
      </section>

      {showResults ? (
        <section id="results" className="border-y border-[var(--border)] bg-[rgba(255,253,248,0.72)] px-4 py-12 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-serif text-4xl font-semibold sm:text-5xl">
                  A Few Thoughtful Ideas For Them
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
                  Based on your time, budget, craft choices, and the kind of gift you want this
                  to feel like.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-lg lg:justify-end">
                <span className="mini-tag">{matches.best.length} best matches</span>
                <span className="mini-tag">{matches.fast.length} quick ideas</span>
                <span className="mini-tag">{matches.mailFriendly.length} easy to mail</span>
                <span className="mini-tag">{matches.budget.length} budget-friendly</span>
                <span className="mini-tag">{savedIds.length} saved</span>
              </div>
            </div>

            <div className="mt-8 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_12px_34px_rgba(70,49,35,0.07)]">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sage)]">
                    Top recommendation
                  </p>
                  <h3 className="mt-2 font-serif text-3xl font-semibold">{matches.best[0]?.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                    {matches.best[0] ? matchNotes(matches.best[0], 3).join(" ") : "Answer the quiz to see a tailored recommendation."}
                  </p>
                </div>
                <button
                  type="button"
                  className="action-button md:min-w-44"
                  onClick={() => {
                    setSelectedGiftId(matches.best[0]?.id ?? null);
                    document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={!matches.best[0]}
                >
                  <Sparkles className="h-4 w-4" />
                  View Best Plan
                </button>
              </div>
            </div>

            <div className="mt-10 space-y-12">
              <ResultGroup
                title="Best Matches"
                description="The strongest overall fits from your answers."
                gifts={matches.best}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Fast But Thoughtful"
                description="Good when you need something warm without turning it into a whole weekend."
                gifts={matches.fast}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Most Personal"
                description="Keepsake-style ideas with room for memories, inside jokes, and sentiment."
                gifts={matches.personal}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Budget-Friendly"
                description="Thoughtful options that keep supplies simple and costs low."
                gifts={matches.budget}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Low-Mess Picks"
                description="Tabletop-friendly ideas with no drying time."
                gifts={matches.lowMess}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Easy To Mail"
                description="Better choices when the gift needs to travel."
                gifts={matches.mailFriendly}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Cozy And Useful"
                description="Practical gifts that still feel soft, personal, and cared-for."
                gifts={matches.cozyUseful}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="Funny Or Gag-Worthy"
                description="Playful ideas that keep the humor kind and giftable."
                gifts={matches.funny}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
              <ResultGroup
                title="A Little More Impressive"
                description="Projects with a bigger reveal when there is more time or confidence."
                gifts={matches.impressive}
                savedIds={savedIds}
                selectedGiftId={selectedGift?.id}
                onSave={toggleSaved}
                onSelect={setSelectedGiftId}
              />
            </div>
          </div>
        </section>
      ) : null}

      {showResults && selectedGift ? (
        <GiftDetail
          gift={selectedGift}
          onPrint={() => window.print()}
          onCopy={() => copyShoppingList(selectedGift)}
          onShare={() => shareGift(selectedGift)}
          actionMessage={actionMessage}
        />
      ) : null}
    </main>
  );
}

function Header({ savedCount }: { savedCount: number }) {
  return (
    <header className="no-print border-b border-[var(--border)] bg-[rgba(248,243,234,0.88)] px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
        <a href="#" className="flex min-w-0 items-center gap-3">
          <GiftTagMark />
          <span className="font-serif text-3xl font-semibold leading-none sm:text-4xl">Made For Them</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--ink)] md:flex">
          <a className="nav-link" href="#generator">
            Gift Generator
          </a>
          <a className="nav-link" href="#results">
            Idea Library
          </a>
          <a className="nav-link" href="#plan">
            Gift Plan
          </a>
        </nav>
        <button className="hidden items-center gap-2 text-sm font-semibold md:flex" type="button">
          <Bookmark className="h-4 w-4" />
          Saved Ideas {savedCount > 0 ? `(${savedCount})` : ""}
        </button>
        <button className="grid h-11 w-11 place-items-center border border-[var(--border)] bg-[var(--surface)] md:hidden" type="button" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function GiftTagMark() {
  return (
    <span className="grid h-11 w-11 place-items-center">
      <svg viewBox="0 0 64 64" className="h-10 w-10 rotate-[-8deg]" aria-hidden="true">
        <path fill="var(--cranberry)" d="M12 9h25.2L56 27.8v26.5A5.7 5.7 0 0 1 50.3 60H12a5.7 5.7 0 0 1-5.7-5.7V14.7A5.7 5.7 0 0 1 12 9Z" />
        <circle cx="19.8" cy="17.9" r="4.6" fill="var(--surface)" />
        <path fill="var(--surface)" d="M33.2 45.7 21.7 35.1c-5.7-5.3 1.8-14.1 8-7.8l3.5 3.6 3.5-3.6c6.2-6.3 13.7 2.5 8 7.8L33.2 45.7Z" />
      </svg>
    </span>
  );
}

function DesktopQuiz({
  quiz,
  completion,
  onUpdate,
  onCraftToggle,
  onSubmit,
}: {
  quiz: QuizState;
  completion: number;
  onUpdate: (patch: Partial<QuizState>) => void;
  onCraftToggle: (craft: CraftType) => void;
  onSubmit: () => void;
}) {
  return (
    <section id="generator" className="hidden border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] md:block">
      <QuizProgress completion={completion} />
      <div className="grid gap-5">
        <SingleSelect
          questionNumber="01"
          label="Who are you making this for?"
          value={quiz.recipient}
          options={recipientOptions}
          onChange={(recipient) => onUpdate({ recipient: recipient as RecipientType })}
        />
        <SingleSelect
          questionNumber="02"
          label="What are we celebrating, comforting, or making better?"
          value={quiz.occasion}
          options={occasionOptions}
          onChange={(occasion) => onUpdate({ occasion: occasion as Occasion })}
        />
      </div>
      <ChipGroup
        questionNumber="03"
        label="What would you actually enjoy making?"
        options={craftOptions}
        selected={quiz.craftTypes}
        onToggle={(value) => onCraftToggle(value as CraftType)}
        iconMap={craftIcons}
      />
      <ComfortExpander quiz={quiz} onUpdate={onUpdate} />
      <div className="grid gap-5">
        <SingleSelect
          questionNumber="05"
          label="How much time do you actually have?"
          value={quiz.time}
          options={timeOptions}
          onChange={(time) => onUpdate({ time: time as TimeRange })}
        />
        <SingleSelect
          questionNumber="06"
          label="What feels like a comfortable budget?"
          value={quiz.budget}
          options={budgetOptions}
          onChange={(budget) => onUpdate({ budget: budget as BudgetRange })}
        />
      </div>
      <ChipGroup
        questionNumber="07"
        label="What should the gift feel like?"
        options={vibeOptions}
        selected={quiz.vibes}
        onToggle={(value) => onUpdate({ vibes: toggleArray(quiz.vibes, value as GiftVibe) })}
      />
      <OptionalFields quiz={quiz} onUpdate={onUpdate} />
      <button
        type="button"
        className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 bg-[var(--cranberry)] px-6 py-4 text-lg font-semibold text-white transition hover:bg-[var(--cranberry-dark)] disabled:opacity-45"
        disabled={!isRequiredComplete(quiz)}
        onClick={onSubmit}
      >
        <Search className="h-5 w-5" />
        Find Their Gift
      </button>
    </section>
  );
}

function MobileQuiz({
  quiz,
  step,
  completion,
  onStepChange,
  onUpdate,
  onCraftToggle,
  onSubmit,
}: {
  quiz: QuizState;
  step: number;
  completion: number;
  onStepChange: (step: number) => void;
  onUpdate: (patch: Partial<QuizState>) => void;
  onCraftToggle: (craft: CraftType) => void;
  onSubmit: () => void;
}) {
  const current = wizardSteps[step];
  const isLast = step === wizardSteps.length - 1;

  return (
    <section id="generator" className="border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] md:hidden">
      <QuizProgress completion={completion} stepLabel={`Step ${step + 1} of ${wizardSteps.length}`} />
      <div className="min-h-[420px]">
        {current === "recipient" ? (
          <SingleSelect questionNumber="01" label="Who are you making this for?" value={quiz.recipient} options={recipientOptions} onChange={(recipient) => onUpdate({ recipient: recipient as RecipientType })} />
        ) : null}
        {current === "occasion" ? (
          <SingleSelect questionNumber="02" label="What are we celebrating, comforting, or making better?" value={quiz.occasion} options={occasionOptions} onChange={(occasion) => onUpdate({ occasion: occasion as Occasion })} />
        ) : null}
        {current === "crafts" ? (
          <ChipGroup questionNumber="03" label="What would you actually enjoy making?" options={craftOptions} selected={quiz.craftTypes} onToggle={(value) => onCraftToggle(value as CraftType)} iconMap={craftIcons} />
        ) : null}
        {current === "comfort" ? <ComfortExpander quiz={quiz} onUpdate={onUpdate} /> : null}
        {current === "time" ? (
          <SingleSelect questionNumber="05" label="How much time do you actually have?" value={quiz.time} options={timeOptions} onChange={(time) => onUpdate({ time: time as TimeRange })} />
        ) : null}
        {current === "budget" ? (
          <SingleSelect questionNumber="06" label="What feels like a comfortable budget?" value={quiz.budget} options={budgetOptions} onChange={(budget) => onUpdate({ budget: budget as BudgetRange })} />
        ) : null}
        {current === "vibes" ? (
          <ChipGroup questionNumber="07" label="What should the gift feel like?" options={vibeOptions} selected={quiz.vibes} onToggle={(value) => onUpdate({ vibes: toggleArray(quiz.vibes, value as GiftVibe) })} />
        ) : null}
        {current === "supplies" ? <OptionalSupplyField quiz={quiz} onUpdate={onUpdate} /> : null}
        {current === "avoid" ? <OptionalAvoidField quiz={quiz} onUpdate={onUpdate} /> : null}
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] p-4">
        <button
          type="button"
          className="grid h-12 w-12 place-items-center border border-[var(--border)] bg-white disabled:opacity-35"
          disabled={step === 0}
          onClick={() => onStepChange(Math.max(0, step - 1))}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-[var(--cranberry)] px-4 font-semibold text-white disabled:opacity-45"
          disabled={isLast && !isRequiredComplete(quiz)}
          onClick={() => {
            if (isLast) onSubmit();
            else onStepChange(Math.min(wizardSteps.length - 1, step + 1));
          }}
        >
          {isLast ? "Find Their Gift" : "Next"}
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function QuizProgress({ completion, stepLabel }: { completion: number; stepLabel?: string }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sage)]">
        <span>{stepLabel ?? "Gift brief"}</span>
        <span>{completion}% ready</span>
      </div>
      <div className="h-1.5 bg-[#eadfce]">
        <div className="h-full bg-[var(--cranberry)] transition-all" style={{ width: `${completion}%` }} />
      </div>
    </div>
  );
}

function SingleSelect<T extends string>({
  questionNumber,
  label,
  value,
  options,
  onChange,
}: {
  questionNumber?: string;
  label: string;
  value?: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const labelId = useId();

  return (
    <div className="question-block min-w-0" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="question-legend">
        {questionNumber ? <span className="question-number">{questionNumber}</span> : null}
        <span>{label}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={classNames("choice-button", value === option.value && "choice-button-selected")}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {value === option.value ? <Check className="h-4 w-4" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  questionNumber,
  label,
  options,
  selected,
  onToggle,
  iconMap,
  children,
}: {
  questionNumber?: string;
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  iconMap?: Partial<Record<T, LucideIcon>>;
  children?: React.ReactNode;
}) {
  const labelId = useId();

  return (
    <div className="question-block min-w-0" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="question-legend">
        {questionNumber ? <span className="question-number">{questionNumber}</span> : null}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const Icon = iconMap?.[option.value] as LucideIcon | undefined;
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={classNames("tag-chip", isSelected && "tag-chip-selected")}
              onClick={() => onToggle(option.value)}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function ComfortExpander({
  quiz,
  onUpdate,
}: {
  quiz: QuizState;
  onUpdate: (patch: Partial<QuizState>) => void;
}) {
  const crafts = selectedCraftsForComfort(quiz);

  if (quiz.craftTypes.includes("open")) {
    return (
      <div className="question-block">
        <div className="question-legend">
          <span className="question-number">04</span>
          <span>How comfortable are you with each of those?</span>
        </div>
        <p className="border border-dashed border-[var(--border)] bg-white/50 p-4 text-sm leading-6 text-[var(--muted)]">
          We will keep the ideas beginner-friendly since you are open to anything.
        </p>
      </div>
    );
  }

  if (crafts.length === 0) return null;

  return (
    <div className="question-block">
      <h3 className="question-legend">
        <span className="question-number">04</span>
        <span>How comfortable are you with each of those?</span>
      </h3>
      <div className="grid gap-3">
        {crafts.map((craft) => (
          <div key={craft} className="border border-[var(--border)] bg-white/55 p-3">
            <div className="mb-3 text-sm font-semibold">{getLabel(craftOptions, craft)}</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {comfortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={classNames(
                    "choice-button items-start",
                    quiz.comfortByCraft[craft] === option.value && "choice-button-selected",
                  )}
                  onClick={() =>
                    onUpdate({
                      comfortByCraft: { ...quiz.comfortByCraft, [craft]: option.value as ComfortLevel },
                    })
                  }
                >
                  <span>
                    <span className="block">{option.label}</span>
                    <span className="block text-xs font-normal text-[var(--muted)]">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionalFields({ quiz, onUpdate }: { quiz: QuizState; onUpdate: (patch: Partial<QuizState>) => void }) {
  return (
    <div className="grid gap-5">
      <OptionalSupplyField quiz={quiz} onUpdate={onUpdate} />
      <OptionalAvoidField quiz={quiz} onUpdate={onUpdate} />
    </div>
  );
}

function OptionalSupplyField({ quiz, onUpdate }: { quiz: QuizState; onUpdate: (patch: Partial<QuizState>) => void }) {
  return (
    <ChipGroup
      questionNumber="08"
      label="Do you already have anything we should use?"
      options={supplyOptions.map((label) => ({ value: label, label }))}
      selected={quiz.supplies}
      onToggle={(value) => onUpdate({ supplies: toggleArray(quiz.supplies, value) })}
    >
      <textarea
        className="field-textarea"
        rows={3}
        value={quiz.supplyNote}
        onChange={(event) => onUpdate({ supplyNote: event.target.value })}
        placeholder="Optional: ribbon, jars, cotton yarn, old frames..."
      />
    </ChipGroup>
  );
}

function OptionalAvoidField({ quiz, onUpdate }: { quiz: QuizState; onUpdate: (patch: Partial<QuizState>) => void }) {
  return (
    <ChipGroup
      questionNumber="09"
      label="Anything you'd rather avoid?"
      options={avoidanceOptions}
      selected={quiz.avoidances}
      onToggle={(value) => onUpdate({ avoidances: toggleArray(quiz.avoidances, value as Avoidance) })}
    >
      <textarea
        className="field-textarea"
        rows={3}
        value={quiz.avoidNote}
        onChange={(event) => onUpdate({ avoidNote: event.target.value })}
        placeholder="Optional: no glitter, needs to fit in a suitcase..."
      />
    </ChipGroup>
  );
}

function GiftPreviewCard({
  gift,
  rank,
  saved,
  onSave,
  onSelect,
}: {
  gift: ScoredGift;
  rank: number;
  saved: boolean;
  onSave: () => void;
  onSelect: () => void;
}) {
  return (
    <article className="group grid overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_34px_rgba(70,49,35,0.09)] sm:grid-cols-[42%_1fr]">
      <button type="button" onClick={onSelect} className="relative min-h-44 overflow-hidden text-left">
        <Image
          src={assetPath(gift.image)}
          alt=""
          fill
          loading={rank === 1 ? "eager" : "lazy"}
          sizes="(min-width: 1024px) 18vw, (min-width: 640px) 42vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--cranberry)]">
          Best match {rank}
        </span>
      </button>
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <button type="button" onClick={onSelect} className="text-left font-serif text-2xl font-semibold leading-tight">
            {gift.title}
          </button>
          <button type="button" onClick={onSave} aria-label={saved ? "Unsave idea" : "Save idea"} className="mt-1 text-[var(--cranberry)]">
            <Bookmark className={classNames("h-5 w-5", saved && "fill-current")} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ideaMeta(gift).slice(0, 4).map((meta) => (
            <span key={meta} className="mini-tag">
              {meta}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function ResultGroup({
  title,
  description,
  gifts,
  savedIds,
  selectedGiftId,
  onSave,
  onSelect,
}: {
  title: string;
  description: string;
  gifts: ScoredGift[];
  savedIds: string[];
  selectedGiftId?: string;
  onSave: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  if (gifts.length === 0) return null;

  return (
    <section>
      <div className="mb-4 grid gap-2 md:grid-cols-[auto_minmax(4rem,1fr)] md:items-center">
        <h3 className="font-serif text-3xl font-semibold">{title}</h3>
        <span className="hidden h-px bg-[var(--border)] md:block" />
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] md:col-span-2">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {gifts.map((gift, index) => (
          <article
            key={`${title}-${gift.id}`}
            className={classNames(
              "flex min-h-full flex-col overflow-hidden border bg-[var(--surface)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]",
              selectedGiftId === gift.id ? "border-[var(--cranberry)]" : "border-[var(--border)]",
            )}
          >
            <button type="button" className="relative block aspect-[4/3] overflow-hidden text-left" onClick={() => onSelect(gift.id)}>
              <Image
                src={assetPath(gift.image)}
                alt=""
                fill
                loading={index === 0 ? "eager" : "lazy"}
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 48vw, 100vw"
                className="object-cover"
              />
              <span className="absolute bottom-3 left-3 bg-[rgba(255,253,248,0.92)] px-2 py-1 text-xs font-semibold text-[var(--ink)]">
                Score {gift.score}
              </span>
            </button>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <button type="button" className="text-left font-serif text-2xl font-semibold leading-tight" onClick={() => onSelect(gift.id)}>
                  {gift.title}
                </button>
                <button type="button" onClick={() => onSave(gift.id)} aria-label={savedIds.includes(gift.id) ? "Unsave idea" : "Save idea"} className="text-[var(--cranberry)]">
                  <Bookmark className={classNames("h-5 w-5", savedIds.includes(gift.id) && "fill-current")} />
                </button>
              </div>
              <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{gift.description}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {ideaMeta(gift).map((meta) => (
                  <span key={meta} className="mini-tag">
                    {meta}
                  </span>
                ))}
              </div>
              <div className="mb-4 border-t border-[var(--border)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sage)]">Why it fits</p>
                <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                  {matchNotes(gift, 2).map((note) => (
                    <li key={note} className="flex gap-2">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--sage)]" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(gift.reasons.length > 0 ? gift.reasons : ["strong overall fit"]).slice(0, 4).map((reason) => (
                    <span key={reason} className="mini-tag">
                      {reasonLabel(reason)}
                    </span>
                  ))}
                </div>
                {gift.cautions.length > 0 ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--cranberry)]">
                    Tradeoff: {gift.cautions[0]}
                  </p>
                ) : null}
              </div>
              <div className="mb-4 grid gap-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
                <p>
                  <span className="font-semibold text-[var(--ink)]">Best for:</span>{" "}
                  {gift.bestFor}
                </p>
                <p>
                  <span className="font-semibold text-[var(--ink)]">Start with:</span>{" "}
                  {gift.materials.slice(0, 3).join(", ")}
                </p>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {giftLogistics(gift).map((item) => (
                  <span key={item} className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-auto grid gap-2 sm:grid-cols-[1fr_auto]">
                <button type="button" className="action-button min-h-11 px-3 text-sm" onClick={() => onSelect(gift.id)}>
                  Make This One
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="grid min-h-11 place-items-center border border-[var(--border)] px-3 text-[var(--cranberry)] transition hover:border-[var(--cranberry)]"
                  onClick={() => onSave(gift.id)}
                  aria-label={savedIds.includes(gift.id) ? "Unsave idea" : "Save idea"}
                >
                  <Bookmark className={classNames("h-5 w-5", savedIds.includes(gift.id) && "fill-current")} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GiftDetail({
  gift,
  onPrint,
  onCopy,
  onShare,
  actionMessage,
}: {
  gift: ScoredGift;
  onPrint: () => void;
  onCopy: () => void;
  onShare: () => void;
  actionMessage: string | null;
}) {
  return (
    <section id="plan" className="px-4 py-14 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="printable-plan border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src={assetPath(gift.image)} alt="" fill sizes="(min-width: 1024px) 42vw, 100vw" className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sage)]">Gift plan</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">{gift.title}</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--muted)]">{gift.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {ideaMeta(gift).map((meta) => (
                  <span key={meta} className="mini-tag">
                    {meta}
                  </span>
                ))}
              </div>
              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[var(--ink)]">Best for</p>
                  <p className="mt-1 leading-6 text-[var(--muted)]">{gift.bestFor}</p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">Project reality</p>
                  <p className="mt-1 leading-6 text-[var(--muted)]">
                    {gift.messLevel} mess, {gift.spaceNeeded}, {gift.dryingTime} drying
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">Skill level</p>
                  <p className="mt-1 leading-6 text-[var(--muted)]">{comfortLabel(gift)}</p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">Delivery</p>
                  <p className="mt-1 leading-6 text-[var(--muted)]">
                    {gift.shipsWell ? "Easy to mail or hand-deliver" : "Best given in person"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <PlanSection title="Why this fits">
            <ul className="grid gap-3">
              {matchNotes(gift, 5).map((note) => (
                <li key={note} className="flex gap-3 text-[var(--muted)]">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sage)]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {(gift.reasons.length > 0 ? gift.reasons : ["strong overall fit"]).map((reason) => (
                <span key={reason} className="mini-tag">
                  {reasonLabel(reason)}
                </span>
              ))}
            </div>
            {gift.cautions.length > 0 ? (
              <div className="mt-4 border border-[rgba(159,47,63,0.24)] bg-[rgba(159,47,63,0.06)] p-3 text-sm leading-6 text-[var(--muted)]">
                <span className="font-semibold text-[var(--cranberry)]">Worth noting:</span>{" "}
                {gift.cautions.join(" ")}
              </div>
            ) : null}
          </PlanSection>
          <PlanSection title="Materials">
            <Checklist items={gift.materials} />
          </PlanSection>
          <PlanSection title="Tools">
            <Checklist items={gift.tools} />
          </PlanSection>
          {gift.patternNotes ? (
            <PlanSection title="Pattern notes">
              <div className="grid gap-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {gift.patternNotes.finishedSize ? (
                    <div className="border border-[var(--border)] bg-[#fff9ed] p-3">
                      <p className="font-semibold text-[var(--ink)]">Finished size</p>
                      <p className="mt-1 leading-6 text-[var(--muted)]">{gift.patternNotes.finishedSize}</p>
                    </div>
                  ) : null}
                  {gift.patternNotes.gauge ? (
                    <div className="border border-[var(--border)] bg-[#fff9ed] p-3">
                      <p className="font-semibold text-[var(--ink)]">Gauge</p>
                      <p className="mt-1 leading-6 text-[var(--muted)]">{gift.patternNotes.gauge}</p>
                    </div>
                  ) : null}
                </div>
                {gift.patternNotes.abbreviations ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sage)]">Abbreviations</p>
                    <div className="flex flex-wrap gap-2">
                      {gift.patternNotes.abbreviations.map((item) => (
                        <span key={item} className="mini-tag">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Checklist items={gift.patternNotes.notes} />
              </div>
            </PlanSection>
          ) : null}
          <PlanSection title="Steps">
            <ol className="grid gap-3">
              {gift.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center bg-[var(--cranberry)] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[var(--muted)]">{step}</span>
                </li>
              ))}
            </ol>
          </PlanSection>
          <PlanSection title="Personal touches">
            <Checklist items={gift.personalization} />
          </PlanSection>
          <PlanSection title="Wrap it like you meant it">
            <Checklist items={gift.wrapping} />
          </PlanSection>
        </article>

        <aside className="printable-shopping-list lg:sticky lg:top-6 lg:self-start">
          <div className="border border-[var(--border)] bg-[rgba(255,253,248,0.92)] p-5 shadow-[var(--shadow)]">
            <h3 className="font-serif text-3xl font-semibold">Shopping List</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Early MVP links use store searches. Later, these become tracked affiliate links.
            </p>
            <div className="mt-5 grid gap-3">
              {gift.supplyCategories.slice(0, 5).map((item) => (
                <div key={item} className="border border-[var(--border)] bg-white/55 p-3">
                  <div className="font-semibold">{item}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {gift.retailers.slice(0, 3).map((retailer) => (
                      <a
                        key={`${item}-${retailer}`}
                        href={suggestedRetailSearch(retailer, item)}
                        target="_blank"
                        rel="noreferrer"
                        className="mini-tag hover:border-[var(--cranberry)] hover:text-[var(--cranberry)]"
                      >
                        {retailer}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="no-print mt-5 grid gap-3">
              <button type="button" onClick={onPrint} className="action-button">
                <Printer className="h-4 w-4" />
                Print Plan
              </button>
              <button type="button" onClick={onCopy} className="action-button">
                <Copy className="h-4 w-4" />
                Copy Shopping List
              </button>
              <button type="button" onClick={onShare} className="action-button">
                <Share2 className="h-4 w-4" />
                Share
              </button>
              {actionMessage ? (
                <p className="border border-[rgba(101,122,91,0.3)] bg-[rgba(101,122,91,0.08)] px-3 py-2 text-sm leading-6 text-[var(--muted)]" role="status" aria-live="polite">
                  {actionMessage}
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function PlanSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h3 className="mb-4 font-serif text-3xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[var(--muted)]">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sage)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
