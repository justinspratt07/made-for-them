export type GiftDataSource = "starter" | "pglite" | "postgres";

export function getGiftDataSource(env: Record<string, string | undefined> = process.env): GiftDataSource {
  if (env.STATIC_EXPORT === "true" || env.GITHUB_PAGES === "true") return "starter";
  const source = env.GIFT_DATA_SOURCE ?? "starter";
  if (source !== "starter" && source !== "pglite" && source !== "postgres") {
    throw new Error("GIFT_DATA_SOURCE must be starter, pglite, or postgres.");
  }
  return source;
}
