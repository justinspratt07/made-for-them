import { adminIsConfigured, getOwnerSession } from "@/lib/admin-session";
import { ownerCredentialVersion, verifyOwnerPassword } from "@/lib/admin-password";
import { OwnerLoginLimit } from "@/lib/admin-login-rate";
import { adminErrorResponse, adminJson, readAdminJson, requireSameOrigin } from "@/lib/admin-http";

const state = globalThis as typeof globalThis & { ownerLoginLimit?: OwnerLoginLimit };
state.ownerLoginLimit ??= new OwnerLoginLimit();

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!adminIsConfigured()) return adminJson({ error: "Owner sign-in is not configured." }, 503);
    if (!state.ownerLoginLimit!.take()) return adminJson({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    const input = await readAdminJson(request);
    const password = input && typeof input === "object" && "password" in input ? input.password : null;
    if (typeof password !== "string" || !await verifyOwnerPassword(password, process.env.ADMIN_PASSWORD_HASH!)) {
      return adminJson({ error: "That password didn't match." }, 401);
    }
    const session = await getOwnerSession();
    session.owner = true;
    session.credentialVersion = ownerCredentialVersion(process.env.ADMIN_PASSWORD_HASH!);
    await session.save();
    state.ownerLoginLimit!.reset();
    return adminJson({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
