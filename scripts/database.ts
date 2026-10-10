import { loadEnvConfig } from "@next/env";
import { createDatabaseConnection, type DatabaseConnection } from "../src/db/connection";
import { getGiftDataSource } from "../src/db/config";
import { readGiftLibrary, seedGiftLibrary } from "../src/db/gift-repository";
import { giftIdeas } from "../src/lib/gift-ideas";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const command = process.argv[2];
  if (!["setup", "migrate", "seed", "check"].includes(command)) {
    throw new Error("Use setup, migrate, seed, or check.");
  }
  const source = getGiftDataSource();
  if (source === "starter") {
    throw new Error("Set GIFT_DATA_SOURCE=pglite or postgres in .env.local first.");
  }
  if (source === "postgres" && command !== "check" &&
      ["production", "preview"].includes(process.env.APP_DEPLOYMENT ?? "") && !process.env.MIGRATION_DATABASE_URL) {
    throw new Error("Hosted maintenance requires a separate MIGRATION_DATABASE_URL.");
  }
  let connection: DatabaseConnection | undefined;
  try {
    connection = await createDatabaseConnection(source, {
      url: command === "check" ? process.env.DATABASE_URL :
        process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
    });
    if (command === "setup" || command === "migrate") {
      await connection.migrate();
      console.log("Database migrations applied.");
    }
    if (command === "setup" || command === "seed") {
      const count = await seedGiftLibrary(connection.db, giftIdeas);
      console.log(`Imported ${count} new gifts; existing gifts were preserved.`);
    }
    if (command === "setup" || command === "check") {
      const gifts = await readGiftLibrary(connection.db);
      console.log(`Connected to ${source}: ${gifts.length} published gifts.`);
      if (!gifts.length) throw new Error("No published gifts found. Run db:seed.");
    }
  } finally {
    await connection?.close();
  }
}

main().catch(() => {
  console.error("Database command failed. Check the data source, connection, and migrations. Stop the dev server before accessing a local PGlite database.");
  process.exitCode = 1;
});
