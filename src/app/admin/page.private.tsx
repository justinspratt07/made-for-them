import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminSignIn } from "@/components/admin-sign-in";
import { AdminGiftEditor } from "@/components/admin-gift-editor";
import { adminIsConfigured, isOwnerSignedIn } from "@/lib/admin-session";
import { getGiftDatabase } from "@/lib/gift-library";
import { readGiftRecords } from "@/db/gift-repository";

export const metadata: Metadata = {
  title: "Gift Library Editor | Made For Them",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await connection();
  if (!await isOwnerSignedIn()) return <AdminSignIn configured={adminIsConfigured()} />;
  const records = await readGiftRecords(await getGiftDatabase("editor"), true);
  return <AdminGiftEditor initialRecords={records} />;
}
