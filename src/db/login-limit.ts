import { sql } from "drizzle-orm";
import { queryRows, type GiftDatabase } from "./connection";

export async function takeDatabaseLoginAttempt(db: GiftDatabase, key: string) {
  const result = await db.execute(sql`select app_private.take_login_attempt(${key}) as allowed`);
  return queryRows<{ allowed: boolean }>(result)[0]?.allowed === true;
}

export async function resetDatabaseLoginAttempts(db: GiftDatabase, key: string) {
  await db.execute(sql`select app_private.reset_login_attempts(${key})`);
}
