"use client";

import { RefreshCw } from "lucide-react";

export default function GiftLibraryError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <p className="font-serif text-2xl text-[var(--ink)]">Made For Them</p>
      <h1 className="mt-8 text-xl font-semibold text-[var(--ink)]">
        We couldn&apos;t load the gift ideas.
      </h1>
      <p className="mt-3 text-[var(--muted)]">Please try again in a moment.</p>
      <button type="button" onClick={retry}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--cranberry)] px-4 py-3 text-white">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </main>
  );
}
