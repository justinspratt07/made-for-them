import { spawn, spawnSync } from "node:child_process";
import { renderEnvironment, renderStartArguments } from "./render-environment.mjs";

try {
  const env = renderEnvironment(process.env);
  const args = renderStartArguments(env);
  const check = spawnSync(process.execPath, ["--import", "tsx", "scripts/deployment-check.ts"], { env, stdio: "inherit" });
  if (check.error || check.status !== 0) process.exit(check.status ?? 1);
  const server = spawn(process.execPath, args, { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
  server.on("error", () => { console.error("Render server could not start."); process.exitCode = 1; });
  server.on("exit", (code, signal) => {
    if (signal) process.exit(signal === "SIGINT" ? 130 : 143);
    process.exit(code ?? 1);
  });
} catch {
  console.error("Render startup failed. Check the runtime settings; private values were not logged.");
  process.exitCode = 1;
}
