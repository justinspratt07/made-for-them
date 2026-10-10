import { MadeForThemApp } from "@/components/made-for-them-app";
import { connection } from "next/server";
import { getGiftDataSource } from "@/db/config";
import { loadGiftLibrary } from "@/lib/gift-library";

export default async function Home() {
  if (getGiftDataSource() !== "starter") await connection();
  const giftIdeas = await loadGiftLibrary();
  return <MadeForThemApp giftIdeas={giftIdeas} />;
}
