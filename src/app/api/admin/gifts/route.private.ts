import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getGiftDatabase } from "@/lib/gift-library";
import { GiftEditConflict, readGiftRecords, saveGiftRecord } from "@/db/gift-repository";
import { adminErrorResponse, adminJson, readAdminJson, requireOwner, requireSameOrigin } from "@/lib/admin-http";

export async function GET() {
  try {
    await requireOwner();
    return adminJson({ records: await readGiftRecords(await getGiftDatabase("editor"), true) });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    await requireOwner();
    const input = await readAdminJson(request);
    const record = await saveGiftRecord(await getGiftDatabase("editor"), input);
    revalidatePath("/");
    revalidatePath("/admin");
    return adminJson({ record });
  } catch (error) {
    if (error instanceof ZodError) return adminJson({
      error: "Please check the highlighted fields.",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    }, 422);
    if (error instanceof GiftEditConflict) return adminJson({ error: error.message }, 409);
    return adminErrorResponse(error);
  }
}
