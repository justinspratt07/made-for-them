import { adminIsConfigured, getOwnerSession } from "@/lib/admin-session";
import { ownerCredentialVersion, verifyOwnerPassword } from "@/lib/admin-password";
import { ClientIdentityUnavailable, ownerClientKey } from "@/lib/admin-client";
import { resetOwnerLoginAttempts, takeOwnerLoginAttempt } from "@/lib/owner-login-limit";
import { adminErrorResponse, adminJson, readAdminJson, requireSameOrigin } from "@/lib/admin-http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!adminIsConfigured()) return adminJson({ error: "Owner sign-in is not configured." }, 503);
    const key = ownerClientKey(request);
    let allowed: boolean;
    try { allowed = await takeOwnerLoginAttempt(key); }
    catch { return adminJson({ error: "Owner sign-in is temporarily unavailable." }, 503); }
    if (!allowed) return adminJson({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    const input = await readAdminJson(request);
    const password = input && typeof input === "object" && "password" in input ? input.password : null;
    if (typeof password !== "string" || !await verifyOwnerPassword(password, process.env.ADMIN_PASSWORD_HASH!)) {
      return adminJson({ error: "That password didn't match." }, 401);
    }
    await resetOwnerLoginAttempts(key);
    const session = await getOwnerSession();
    session.owner = true;
    session.credentialVersion = ownerCredentialVersion(process.env.ADMIN_PASSWORD_HASH!);
    await session.save();
    return adminJson({ ok: true });
  } catch (error) {
    if (error instanceof ClientIdentityUnavailable) return adminJson({ error: "Owner sign-in is temporarily unavailable." }, 503);
    return adminErrorResponse(error);
  }
}
