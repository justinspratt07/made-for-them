import "server-only";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { getGiftDataSource } from "../db/config";
import { ownerCredentialVersion } from "./admin-password";

type OwnerSession = { owner?: boolean; credentialVersion?: string };

export function adminIsConfigured() {
  return getGiftDataSource() !== "starter" &&
    /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH ?? "") &&
    (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
}

export async function getOwnerSession() {
  if (!adminIsConfigured()) throw new Error("Owner sign-in is not configured.");
  const store = await cookies();
  const options = {
    password: process.env.ADMIN_SESSION_SECRET!,
    cookieName: "made-for-them-owner",
    ttl: 8 * 60 * 60,
    cookieOptions: {
      httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/",
    },
  };
  try { return await getIronSession<OwnerSession>(store, options); }
  catch {
    // Malformed cookies are treated as signed out; a valid sign-in can replace them.
    return getIronSession<OwnerSession>({
      get: () => undefined,
      set: store.set.bind(store),
    }, options);
  }
}

export async function isOwnerSignedIn() {
  if (!adminIsConfigured()) return false;
  const session = await getOwnerSession();
  return session.owner === true && session.credentialVersion ===
    ownerCredentialVersion(process.env.ADMIN_PASSWORD_HASH!);
}
