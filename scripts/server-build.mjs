import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

let env = { ...process.env };
if (process.argv.includes("--preview")) {
  const fixture = JSON.parse(await readFile(".preview-runtime.json", "utf8"));
  if (fixture.env.GIFT_DATA_SOURCE !== "postgres") throw new Error("Hosted preview builds require the CI PostgreSQL fixture.");
  env = { ...env, ...fixture.env };
}
env.STATIC_EXPORT = "false"; env.GITHUB_PAGES = "false";
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
if (result.error || result.status !== 0) process.exit(result.status ?? 1);
