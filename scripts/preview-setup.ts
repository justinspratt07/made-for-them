import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { createDatabaseConnection } from "../src/db/connection";
import { seedGiftLibrary } from "../src/db/gift-repository";
import { giftIdeas } from "../src/lib/gift-ideas";
import { hashOwnerPassword } from "../src/lib/admin-password";

async function main() {
  // This command never loads .env.local or uses the real project connection.
  const migrationUrl = process.env.PREVIEW_MIGRATION_DATABASE_URL;
  const source = migrationUrl ? "postgres" : "pglite";
  const render = process.argv.includes("--render");
  if (render && source !== "postgres") throw new Error("Render fixtures require the isolated PostgreSQL CI setup.");
  const localPath = `.data-preview/library-${randomBytes(8).toString("hex")}`;
  let endpoint: URL | undefined;
  if (migrationUrl) {
    endpoint = new URL(migrationUrl);
    if (process.env.CI !== "true" || endpoint.hostname !== "127.0.0.1" || endpoint.pathname !== "/made_for_them_ci") {
      throw new Error("PostgreSQL fixtures require the dedicated loopback CI database.");
    }
  }
  const connection = await createDatabaseConnection(source, { url: migrationUrl, localPath });
  const readerPassword = randomBytes(24).toString("hex");
  const editorPassword = randomBytes(24).toString("hex");
  const password = randomBytes(24).toString("hex");
  try {
    await connection.migrate();
    await seedGiftLibrary(connection.db, giftIdeas);
    if (source === "postgres") {
      // Only fixed role names and generated hexadecimal passwords enter DDL.
      await connection.db.execute(sql.raw(`CREATE ROLE mft_preview_reader LOGIN PASSWORD '${readerPassword}'`));
      await connection.db.execute(sql.raw(`CREATE ROLE mft_preview_editor LOGIN PASSWORD '${editorPassword}'`));
      await connection.db.execute(sql`GRANT mft_public TO mft_preview_reader`);
      await connection.db.execute(sql`GRANT mft_editor TO mft_preview_editor`);
    }
    function runtimeUrl(user: string, secret: string) {
      const url = new URL(endpoint!);
      url.username = user; url.password = secret;
      return url.href;
    }
    const env = {
      APP_DEPLOYMENT: source === "postgres" ? "preview" : "local",
      GIFT_DATA_SOURCE: source, LOCAL_DATABASE_PATH: localPath,
      DATABASE_URL: endpoint ? runtimeUrl("mft_preview_reader", readerPassword) : "",
      ADMIN_DATABASE_URL: endpoint ? runtimeUrl("mft_preview_editor", editorPassword) : "",
      MIGRATION_DATABASE_URL: "", PREVIEW_MIGRATION_DATABASE_URL: "",
      ADMIN_PASSWORD_HASH: await hashOwnerPassword(password),
      ADMIN_SESSION_SECRET: randomBytes(48).toString("hex"),
      ADMIN_ORIGIN: "http://127.0.0.1:3100", ADMIN_CLIENT_IP_HEADER: "x-real-ip",
      STATIC_EXPORT: "false", GITHUB_PAGES: "false", NEXT_PUBLIC_BASE_PATH: "",
      ISOLATED_PREVIEW: "true",
      ...(render ? { RENDER: "true", RENDER_EXTERNAL_URL: "https://render-fixture.onrender.com",
        ADMIN_CLIENT_IP_HEADER: "cf-connecting-ip", PORT: "3100" } : {}),
    };
    await writeFile(".preview-runtime.json", JSON.stringify({ env, password }), { mode: 0o600 });
    console.log(`Prepared isolated ${source} preview with ${giftIdeas.length} gifts; no live database was used.`);
  } finally { await connection.close(); }
}
main().catch(() => { console.error("Preview setup failed. Check the isolated fixture settings."); process.exitCode = 1; });
