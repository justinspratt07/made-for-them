"use client";

import { Eye, EyeOff, LockKeyhole, LogIn, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function AdminSignIn({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="admin-page flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 font-serif text-2xl font-semibold">
          <Tag className="h-6 w-6 text-[var(--cranberry)]" />Made For Them
        </Link>
        <div className="mt-8 border border-[var(--border)] bg-white p-6">
          <LockKeyhole className="h-5 w-5 text-[var(--muted)]" />
          <h1 className="mt-3 text-xl font-semibold">Owner sign-in</h1>
          {configured ? (
            <form className="mt-6 grid gap-4" onSubmit={async (event) => {
              event.preventDefault(); setPending(true); setMessage("");
              try {
                const response = await fetch("/api/admin/login", { method: "POST",
                  headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
                });
                const result = await response.json();
                if (!response.ok) { setMessage(result.error); return; }
                setPassword(""); router.refresh();
              } catch { setMessage("Sign-in could not be completed. Please try again."); }
              finally { setPending(false); }
            }}>
              <label className="grid gap-2 text-sm font-medium" htmlFor="owner-password">Password</label>
              <div className="relative">
                <input id="owner-password" className="admin-input pr-12" type={visible ? "text" : "password"}
                  required autoComplete="current-password" maxLength={256} value={password}
                  onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center"
                  aria-label={visible ? "Hide password" : "Show password"}
                  title={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {message ? <p role="alert" className="text-sm text-[var(--cranberry)]">{message}</p> : null}
              <button className="admin-primary" type="submit" disabled={pending}>
                <LogIn className="h-4 w-4" />{pending ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : <p className="mt-4 text-sm text-[var(--muted)]">Owner access hasn&apos;t been configured.</p>}
        </div>
      </section>
    </main>
  );
}
