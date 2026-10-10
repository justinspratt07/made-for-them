import { getOwnerSession } from "@/lib/admin-session";
import { adminErrorResponse, adminJson, requireOwner, requireSameOrigin } from "@/lib/admin-http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireOwner();
    (await getOwnerSession()).destroy();
    return adminJson({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
