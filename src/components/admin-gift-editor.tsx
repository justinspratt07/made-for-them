"use client";

import { Check, ExternalLink, ImagePlus, LogOut, Plus, RefreshCw, Save, Search, Tag, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftRecord } from "@/db/gift-repository";
import type { CraftType, GiftIdea } from "@/lib/gift-types";
import { avoidanceOptions, budgetOptions, comfortOptions, craftOptions, occasionOptions,
  recipientOptions, timeOptions, vibeOptions } from "@/lib/gift-options";

const tabs = ["Project", "Instructions", "Matching", "Pattern notes"] as const;
type Tab = typeof tabs[number];
const listFields = ["materials", "tools", "steps", "personalization", "wrapping", "supplyCategories", "retailers"] as const;
type ListField = typeof listFields[number];
type Issue = { path: string; message: string };

function blankGift(): GiftIdea {
  return { id: crypto.randomUUID(), title: "", description: "", craftTypes: [], comfort: {},
    recipients: [], occasions: [], vibes: [], budget: "under-10", time: "under-30",
    materials: [], tools: [], steps: [], personalization: [], wrapping: [], supplyCategories: [],
    retailers: [], avoidances: [], image: "", bestFor: "", messLevel: "low", spaceNeeded: "tabletop",
    dryingTime: "none", shipsWell: false, kidFriendly: false,
  };
}

function canonicalGift(gift: GiftIdea) {
  const clean = { ...gift };
  for (const field of listFields) clean[field] = gift[field].map((line) => line.trim()).filter(Boolean);
  if (gift.patternNotes) clean.patternNotes = { ...gift.patternNotes,
    notes: gift.patternNotes.notes.map((line) => line.trim()).filter(Boolean),
    abbreviations: gift.patternNotes.abbreviations?.map((line) => line.trim()).filter(Boolean),
  };
  return clean;
}

export function AdminGiftEditor({ initialRecords }: { initialRecords: GiftRecord[] }) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [selected, setSelected] = useState<GiftRecord | null>(initialRecords[0] ?? null);
  const [gift, setGift] = useState<GiftIdea | null>(initialRecords[0]?.gift ?? null);
  const [tab, setTab] = useState<Tab>("Project");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const dirty = gift !== null && JSON.stringify(gift) !== JSON.stringify(selected?.gift);
  const visible = records.filter((record) => record.gift.title.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "all" || (filter === "published" ? record.published : !record.published)));
  const photos = [...new Set(records.map((record) => record.gift.image).filter(Boolean))];

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function canLeave() { return !dirty || window.confirm("Discard unsaved changes?"); }
  function choose(record: GiftRecord | null) {
    if (pending || !canLeave()) return;
    setSelected(record); setGift(record?.gift ?? blankGift()); setIssues([]); setMessage(""); setTab("Project");
  }
  function update<K extends keyof GiftIdea>(field: K, value: GiftIdea[K]) {
    setGift((current) => current ? { ...current, [field]: value } : current);
    setIssues((current) => current.filter((issue) => !issue.path.startsWith(`gift.${field}`)));
    setMessage("");
  }
  function note(field: "finishedSize" | "gauge" | "notes" | "abbreviations", value: string) {
    if (!gift) return;
    update("patternNotes", { ...gift.patternNotes, notes: gift.patternNotes?.notes ?? [],
      [field]: field === "notes" || field === "abbreviations" ? value.split("\n") : value,
    });
  }
  async function save(published: boolean) {
    if (!gift || pending) return;
    setPending(true); setIssues([]); setMessage("");
    try {
      const response = await fetch("/api/admin/gifts", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift: canonicalGift(gift), published, version: selected?.version ?? null }),
      });
      const result = await response.json();
      if (!response.ok) {
        setIssues(result.issues ?? []); setMessage(result.error);
        requestAnimationFrame(() => statusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
        return;
      }
      const record: GiftRecord = result.record;
      setRecords((current) => current.some((item) => item.gift.id === record.gift.id) ?
        current.map((item) => item.gift.id === record.gift.id ? record : item) : [...current, record]);
      setSelected(record); setGift(record.gift);
      setMessage(published ? "Published changes saved." : "Draft saved.");
    } catch { setMessage("The change could not be saved. Please try again."); }
    finally { setPending(false); }
  }
  async function reload() {
    if (!canLeave()) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/gifts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error); return; }
      const loaded: GiftRecord[] = result.records;
      const current = loaded.find((item) => item.gift.id === gift?.id) ?? loaded[0] ?? null;
      setRecords(loaded); setSelected(current); setGift(current?.gift ?? null); setIssues([]); setMessage("Library refreshed.");
    } catch { setMessage("The library could not be refreshed."); }
    finally { setPending(false); }
  }

  const invalid = (field: string) => issues.some((issue) => issue.path.startsWith(`gift.${field}`));
  const textField = (field: "title" | "description" | "bestFor" | "image", label: string, multiline = false) => gift ? (
    <div className="admin-field" key={field}>
      <label htmlFor={`editor-${field}`}>{label}</label>
      {multiline ? <textarea id={`editor-${field}`} className="admin-input" rows={3} value={gift[field]}
        aria-invalid={invalid(field)} onChange={(event) => update(field, event.target.value)} /> :
        <input id={`editor-${field}`} className="admin-input" value={gift[field]} required={field === "title"}
          maxLength={field === "title" ? 160 : 2000} aria-invalid={invalid(field)}
          onChange={(event) => update(field, event.target.value)} />}
    </div>
  ) : null;
  const listField = (field: ListField, label: string, rows = 5) => gift ? (
    <div className="admin-field" key={field}><label htmlFor={`editor-${field}`}>{label}</label>
      <textarea id={`editor-${field}`} className="admin-input" rows={rows} value={gift[field].join("\n")}
        aria-invalid={invalid(field)} onChange={(event) => update(field, event.target.value.split("\n"))} />
    </div>
  ) : null;

  return (
    <main className="admin-page min-h-screen">
      <header className="border-b border-[var(--border)] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div><a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Tag className="h-5 w-5 text-[var(--cranberry)]" />Made For Them</a>
            <h1 className="mt-1 text-sm font-medium text-[var(--muted)]">Gift library editor</h1></div>
          <div className="flex items-center gap-2">
            <button type="button" className="admin-secondary" disabled={pending} onClick={() => choose(null)}><Plus className="h-4 w-4" />New gift</button>
            <button type="button" className="admin-icon" title="Refresh library" aria-label="Refresh library" disabled={pending} onClick={reload}><RefreshCw className="h-4 w-4" /></button>
            <a href="/" target="_blank" rel="noreferrer" className="admin-icon" title="View site" aria-label="View site"><ExternalLink className="h-4 w-4" /></a>
            <button type="button" className="admin-icon" title="Sign out" aria-label="Sign out" disabled={pending} onClick={async () => {
              if (!canLeave()) return; setPending(true);
              try {
                const response = await fetch("/api/admin/logout", { method: "POST" });
                if (!response.ok) { setMessage("Sign-out failed. Please try again."); return; }
                setGift(null); router.refresh();
              } catch { setMessage("Sign-out failed. Please try again."); }
              finally { setPending(false); }
            }}><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-w-0 md:block">
          <div className="sticky top-6">
            <h2 className="text-sm font-semibold">Projects <span className="ml-1 font-normal text-[var(--muted)]">{records.length}</span></h2>
            <label className="relative mt-3 block"><span className="sr-only">Search projects</span><Search className="absolute left-3 top-3 h-4 w-4 text-[var(--muted)]" />
              <input className="admin-input pl-9" placeholder="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label className="mt-3 block"><span className="sr-only">Project status</span>
              <select className="admin-input" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All projects</option><option value="published">Published</option><option value="draft">Drafts</option>
              </select></label>
            <div className="mt-4 max-h-[68vh] overflow-y-auto border-t border-[var(--border)]">
              {visible.map((record) => <button key={record.gift.id} type="button" onClick={() => choose(record)} disabled={pending}
                aria-pressed={selected?.gift.id === record.gift.id}
                className={`block w-full border-b border-[var(--border)] px-3 py-3 text-left ${selected?.gift.id === record.gift.id ? "border-l-2 border-l-[var(--cranberry)] bg-white" : "hover:bg-white"}`}>
                <span className="block text-sm font-medium leading-5">{record.gift.title}</span>
                <span className={`mt-1 block text-xs ${record.published ? "text-emerald-700" : "text-[var(--muted)]"}`}>{record.published ? "Published" : "Draft"}</span>
              </button>)}
              {!visible.length ? <p className="py-6 text-sm text-[var(--muted)]">No projects found.</p> : null}
            </div>
          </div>
        </aside>
        <section className="min-w-0">
          <label className="admin-field mb-5 md:hidden" htmlFor="mobile-project"><span>Project</span>
            <select id="mobile-project" aria-label="Project" className="admin-input" value={selected?.gift.id ?? ""} disabled={pending}
              onChange={(event) => choose(records.find((record) => record.gift.id === event.target.value) ?? null)}>
              <option value="">New draft</option>{records.map((record) => <option key={record.gift.id} value={record.gift.id}>{record.gift.title} ({record.published ? "Published" : "Draft"})</option>)}
            </select></label>
          {gift ? (
            <form onSubmit={(event) => { event.preventDefault(); save(selected?.published ?? false); }}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="break-words text-xl font-semibold">{gift.title || "New gift"}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{selected?.published ? "Published" : "Draft"}{dirty ? " · Unsaved changes" : ""}</p></div>
                <button type="button" className="admin-secondary" disabled={pending || !dirty} onClick={() => {
                  if (!canLeave()) return; setGift(selected?.gift ?? blankGift()); setMessage(""); setIssues([]);
                }}>Discard changes</button>
              </div>
              <div className="mb-6 grid grid-cols-2 border-b border-[var(--border)] sm:flex" role="tablist" aria-label="Project sections">
                {tabs.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name}
                  aria-controls="editor-panel" id={`tab-${name.replaceAll(" ", "-")}`} onClick={() => setTab(name)}
                  tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => {
                    const index = tabs.indexOf(tab);
                    const next = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] :
                      event.key === "ArrowLeft" ? tabs[(index + tabs.length - 1) % tabs.length] :
                      event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : null;
                    if (next) { event.preventDefault(); setTab(next); document.getElementById(`tab-${next.replaceAll(" ", "-")}`)?.focus(); }
                  }}
                  className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${tab === name ? "border-[var(--cranberry)] text-[var(--cranberry)]" : "border-transparent text-[var(--muted)]"}`}>{name}</button>)}
              </div>
              <div ref={statusRef}>
                {message ? <p role={issues.length ? "alert" : "status"} className={`mb-4 text-sm ${issues.length ? "text-[var(--cranberry)]" : "text-[var(--ink)]"}`}>{message}</p> : null}
                {issues.length ? <ul className="mb-6 list-inside list-disc text-sm text-[var(--cranberry)]">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : null}
              </div>
              <fieldset disabled={pending} id="editor-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`} className="grid min-w-0 gap-5 border-0 p-0">
                {tab === "Project" ? <>
                  {textField("title", "Title")}{textField("description", "Description", true)}{textField("bestFor", "Best for")}
                  <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="grid content-start gap-5">
                      <label className="admin-field" htmlFor="existing-photo"><span>Library photo</span>
                        <select id="existing-photo" className="admin-input" value={photos.includes(gift.image) ? gift.image : ""} onChange={(event) => update("image", event.target.value)}>
                          <option value="">Choose a photo</option>{photos.map((photo) => <option key={photo} value={photo}>{photo.split("/").at(-1)?.replace(/^project-/, "").replace(/\.[^.]+$/, "").replaceAll("-", " ")}</option>)}
                        </select></label>
                      {textField("image", "Photo URL or asset path")}
                    </div>
                    <PhotoPreview src={gift.image} title={gift.title} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <OptionSelect label="Budget" value={gift.budget} options={budgetOptions} onChange={(value) => update("budget", value)} />
                    <OptionSelect label="Time" value={gift.time} options={timeOptions} onChange={(value) => update("time", value)} />
                    <OptionSelect label="Mess level" value={gift.messLevel} options={["low", "medium", "high"].map((value) => ({ value: value as GiftIdea["messLevel"], label: value }))} onChange={(value) => update("messLevel", value)} />
                    <OptionSelect label="Workspace" value={gift.spaceNeeded} options={["tabletop", "counter", "small workspace"].map((value) => ({ value: value as GiftIdea["spaceNeeded"], label: value }))} onChange={(value) => update("spaceNeeded", value)} />
                    <OptionSelect label="Drying time" value={gift.dryingTime} options={["none", "short", "overnight"].map((value) => ({ value: value as GiftIdea["dryingTime"], label: value }))} onChange={(value) => update("dryingTime", value)} />
                  </div>
                  <div className="flex flex-wrap gap-6"><label className="admin-check"><input type="checkbox" checked={gift.shipsWell} onChange={(event) => update("shipsWell", event.target.checked)} />Ships well</label>
                    <label className="admin-check"><input type="checkbox" checked={gift.kidFriendly} onChange={(event) => update("kidFriendly", event.target.checked)} />Kid-friendly</label></div>
                </> : null}
                {tab === "Instructions" ? <>
                  <div className="grid gap-5 sm:grid-cols-2">{listField("materials", "Materials")}{listField("tools", "Tools")}</div>
                  {listField("steps", "Steps", 10)}
                  <div className="grid gap-5 sm:grid-cols-2">{listField("personalization", "Personal touches")}{listField("wrapping", "Wrapping")}
                    {listField("supplyCategories", "Shopping categories")}{listField("retailers", "Retailers")}</div>
                </> : null}
                {tab === "Matching" ? <>
                  <Checks label="Craft types" options={craftOptions.filter((option) => option.value !== "open")} selected={gift.craftTypes}
                    onChange={(values) => { update("craftTypes", values); update("comfort", Object.fromEntries(Object.entries(gift.comfort).filter(([craft]) => values.includes(craft as CraftType)))); }} />
                  {gift.craftTypes.length ? <div className="grid gap-4 sm:grid-cols-2">{gift.craftTypes.map((craft) => <OptionSelect key={craft} label={`${craftOptions.find((option) => option.value === craft)?.label} skill level`}
                    value={gift.comfort[craft] ?? ""} options={[{ value: "", label: "Choose a skill level" }, ...comfortOptions]}
                    onChange={(value) => { const comfort = { ...gift.comfort }; if (value) comfort[craft] = value as typeof comfort[CraftType]; else delete comfort[craft]; update("comfort", comfort); }} />)}</div> : null}
                  <Checks label="Recipients" options={recipientOptions} selected={gift.recipients} onChange={(values) => update("recipients", values)} />
                  <Checks label="Occasions" options={occasionOptions} selected={gift.occasions} onChange={(values) => update("occasions", values)} />
                  <Checks label="Gift feelings" options={vibeOptions} selected={gift.vibes} onChange={(values) => update("vibes", values)} />
                  <Checks label="Compatible preferences" options={avoidanceOptions} selected={gift.avoidances} onChange={(values) => update("avoidances", values)} />
                </> : null}
                {tab === "Pattern notes" ? <>
                  <label className="admin-check"><input type="checkbox" checked={Boolean(gift.patternNotes)} onChange={(event) => update("patternNotes", event.target.checked ? { notes: [] } : undefined)} />Include pattern notes</label>
                  {gift.patternNotes ? <>
                    <label className="admin-field">Finished size<input className="admin-input" value={gift.patternNotes.finishedSize ?? ""} onChange={(event) => note("finishedSize", event.target.value)} /></label>
                    <label className="admin-field">Gauge<textarea aria-label="Gauge" className="admin-input" rows={3} value={gift.patternNotes.gauge ?? ""} onChange={(event) => note("gauge", event.target.value)} /></label>
                    <label className="admin-field">Abbreviations<textarea aria-label="Abbreviations" className="admin-input" rows={5} value={gift.patternNotes.abbreviations?.join("\n") ?? ""} onChange={(event) => note("abbreviations", event.target.value)} /></label>
                    <label className="admin-field">Pattern notes<textarea aria-label="Pattern notes" className="admin-input" rows={6} value={gift.patternNotes.notes.join("\n")} onChange={(event) => note("notes", event.target.value)} /></label>
                  </> : null}
                </> : null}
              </fieldset>
              <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-white/95 py-4 backdrop-blur">
                <button type="submit" className="admin-primary" disabled={pending}><Save className="h-4 w-4" />{pending ? "Saving..." : selected?.published ? "Save changes" : "Save draft"}</button>
                {selected?.published ? <button type="button" className="admin-secondary" disabled={pending} onClick={() => save(false)}>Unpublish</button> :
                  <button type="button" className="admin-secondary" disabled={pending} onClick={() => save(true)}><Upload className="h-4 w-4" />Publish</button>}
                {!dirty && selected ? <span className="flex items-center gap-1 text-xs text-[var(--muted)]"><Check className="h-3 w-3" />Saved</span> : null}
              </div>
            </form>
          ) : <div className="py-16"><h2 className="text-xl font-semibold">Your gift library is empty.</h2><button type="button" className="admin-primary mt-4" onClick={() => choose(null)}><Plus className="h-4 w-4" />New gift</button></div>}
        </section>
      </div>
    </main>
  );
}

function Checks<T extends string>({ label, options, selected, onChange }: {
  label: string; options: { value: T; label: string }[]; selected: T[]; onChange: (values: T[]) => void;
}) {
  return <fieldset className="min-w-0 border-0 border-t border-t-[var(--border)] pt-4">
    <legend className="mb-3 text-sm font-semibold">{label}</legend>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{options.map((option) => <label key={option.value} className="admin-check">
      <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value])} />{option.label}
    </label>)}</div>
  </fieldset>;
}

function OptionSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return <label className="admin-field"><span>{label}</span><select aria-label={label} className="admin-input" value={value} onChange={(event) => onChange(event.target.value as T)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}

function PhotoPreview({ src, title }: { src: string; title: string }) {
  const [failedSrc, setFailedSrc] = useState("");
  const allowed = /^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/i.test(src) || /^https:\/\//.test(src);
  return <div className="relative aspect-[4/3] w-full overflow-hidden border border-[var(--border)] bg-white">
    {src && allowed && failedSrc !== src ? <Image src={src} alt={title || "Project photo"} fill unoptimized sizes="240px" className="object-cover" onError={() => setFailedSrc(src)} /> :
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--muted)]"><ImagePlus className="h-6 w-6" />{failedSrc === src && src ? "Photo unavailable" : "Project photo"}</div>}
  </div>;
}
