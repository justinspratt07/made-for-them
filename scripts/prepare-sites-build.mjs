#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

for (const file of [path.join(out, "index.html"), worker]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "server"), { recursive: true });

cpSync(out, client, { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
if (existsSync(hosting)) {
  mkdirSync(path.join(dist, ".openai"), { recursive: true });
  copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
}

console.log("Prepared Sites build.");
