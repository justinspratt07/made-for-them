import { spawnSync } from "node:child_process";
import path from "node:path";

const env = { ...process.env, STATIC_EXPORT: "true", GIFT_DATA_SOURCE: "starter" };
const nextCli = path.join("node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextCli, "build"], { env, stdio: "inherit" });
if (result.error || result.status !== 0) process.exit(result.status ?? 1);
