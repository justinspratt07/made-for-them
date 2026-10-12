import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { renderEnvironment } from "./render-environment.mjs";

try {
  let input = { ...process.env };
  if (process.argv.includes("--preview")) {
    const fixture = JSON.parse(await readFile(".preview-runtime.json", "utf8"));
    if (input.CI !== "true" || fixture.env.GIFT_DATA_SOURCE !== "postgres" || fixture.env.RENDER !== "true") {
      throw new Error("Render fixture builds require the isolated PostgreSQL CI setup.");
    }
    input = { ...input, ...fixture.env };
  }
  const env = renderEnvironment(input);
  const manager = process.env.npm_execpath;
  if (!manager || !/^pnpm(?:\.(?:c?js|mjs|exe))?$/.test(basename(manager))) {
    throw new Error("Run the Render build through pnpm.");
  }
  const javascriptManager = /\.(?:c?js|mjs)$/.test(manager);
  const tasks = [
    { command: javascriptManager ? process.execPath : manager,
      args: [...(javascriptManager ? [manager] : []), "install", "--frozen-lockfile", "--prod=false"] },
    { command: process.execPath, args: ["scripts/server-build.mjs"] },
  ];
  for (const { command, args } of tasks) {
    const result = spawnSync(command, args, { env, stdio: "inherit" });
    if (result.error || result.status !== 0) process.exit(result.status ?? 1);
  }
} catch {
  console.error("Render build failed. Check the runtime settings; private values were not logged.");
  process.exitCode = 1;
}
