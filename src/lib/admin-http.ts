import "server-only";
import { isOwnerSignedIn } from "./admin-session";
import { configuredAdminOrigin } from "./deployment-config";

export class AdminHttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function requireSameOrigin(request: Request) {
  const url = new URL(request.url);
  // Next.js can normalize the internal URL to localhost while the browser uses 127.0.0.1.
  let configured: string | undefined;
  try { configured = configuredAdminOrigin(); }
  catch { throw new AdminHttpError("Owner access is not configured.", 503); }
  const expectedOrigin = configured ?? `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new AdminHttpError("This request is not allowed.", 403);
  }
}

export async function requireOwner() {
  if (!await isOwnerSignedIn()) throw new AdminHttpError("Please sign in again.", 401);
}

export async function readAdminJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new AdminHttpError("Expected a JSON request.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AdminHttpError("The request is empty.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 128 * 1024) {
        await reader.cancel();
        throw new AdminHttpError("This project is too large to save.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AdminHttpError("The request could not be read.", 400); }
}

export function adminJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminHttpError) return adminJson({ error: error.message }, error.status);
  return adminJson({ error: "The change could not be saved. Please try again." }, 500);
}
