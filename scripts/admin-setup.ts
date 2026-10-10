import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { hashOwnerPassword } from "../src/lib/admin-password";

async function main() {
  const filename = ".env.local";
  const current = await readFile(filename, "utf8");
  if (/^ADMIN_PASSWORD_HASH=.+$/m.test(current) && !process.argv.includes("--rotate")) {
    console.log("Owner sign-in already exists. Use --rotate only to replace it and invalidate existing sessions.");
    return;
  }
  const password = randomBytes(24).toString("base64url");
  const hash = await hashOwnerPassword(password);
  const secret = randomBytes(48).toString("base64url");
  const existing = current.split(/\r?\n/).filter((line) =>
    !/^ADMIN_(PASSWORD_HASH|SESSION_SECRET)=/.test(line),
  );
  await writeFile(filename, [...existing, `ADMIN_PASSWORD_HASH="${hash}"`,
    `ADMIN_SESSION_SECRET="${secret}"`, ""].join("\n"), { mode: 0o600 });
  await writeFile(".admin-login.local.txt", [
    "Made For Them owner sign-in", "http://127.0.0.1:3000/admin",
    `Password: ${password}`, "", "Private: do not commit or share this file.", "",
  ].join("\n"), { mode: 0o600 });
  console.log("Owner sign-in created. The private password is in .admin-login.local.txt. Restart the app to use the new settings.");
}
main().catch(() => { console.error("Owner setup failed. Check the local settings file."); process.exitCode = 1; });
