import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderEnvironment, renderStartArguments } from "../scripts/render-environment.mjs";
import { ownerClientKey } from "../src/lib/admin-client";
import { assertOwnerDeployment } from "../src/lib/deployment-config";

const render = { RENDER: "true", RENDER_EXTERNAL_URL: "https://made-for-them-preview.onrender.com" };
const runtime = {
  ...renderEnvironment(render),
  DATABASE_URL: "postgresql://reader:test-only@database.example/app?sslmode=require",
  ADMIN_DATABASE_URL: "postgresql://editor:test-only@database.example/app?sslmode=require",
  ADMIN_SESSION_SECRET: "render-identity-test-only-secret-".repeat(2),
};

test("Render Blueprint provisions only a free manually deployed service with private credential placeholders", () => {
  const require = createRequire(import.meta.url);
  const blueprint = require("js-yaml").load(readFileSync("render.yaml", "utf8"));
  assert.deepEqual(Object.keys(blueprint), ["services"]);
  assert.equal(blueprint.services.length, 1);
  const service = blueprint.services[0];
  assert.equal(service.type, "web");
  assert.equal(service.runtime, "node");
  assert.equal(service.plan, "free");
  assert.equal(service.branch, "main");
  assert.equal(service.autoDeployTrigger, "off");
  assert.equal(service.buildCommand, "pnpm build:render");
  assert.equal(service.startCommand, "pnpm start:render");
  assert.equal(service.healthCheckPath, "/api/health");
  assert.equal(Object.hasOwn(service, "preDeployCommand"), false);
  const fields = service.envVars;
  for (const key of ["DATABASE_URL", "ADMIN_DATABASE_URL", "ADMIN_PASSWORD_HASH"]) {
    const field = fields.find((field: { key: string }) => field.key === key);
    assert.equal(field.sync, false);
    assert.equal(Object.hasOwn(field, "value"), false);
  }
  assert.equal(fields.find((field: { key: string }) => field.key === "ADMIN_SESSION_SECRET").generateValue, true);
  assert.equal(fields.some((field: { key: string }) => field.key === "MIGRATION_DATABASE_URL"), false);
});

test("Render config derives an exact origin, selects server storage, and keeps local input unchanged", () => {
  const input = { ...render };
  const env = renderEnvironment(input);
  assert.equal(env.ADMIN_ORIGIN, "https://made-for-them-preview.onrender.com");
  assert.equal(env.ADMIN_CLIENT_IP_HEADER, "cf-connecting-ip");
  assert.equal(env.GIFT_DATA_SOURCE, "postgres");
  assert.equal(env.APP_DEPLOYMENT, "preview");
  assert.equal(env.NODE_ENV, "production");
  assert.deepEqual(input, render);
  assert.equal(renderEnvironment({ ...render, ADMIN_ORIGIN: "https://madeforthem.example" }).ADMIN_ORIGIN, "https://madeforthem.example");
  assert.doesNotThrow(() => assertOwnerDeployment(runtime));
});

test("Render config rejects unsupported modes, unsafe headers, migration secrets, and forged default origins", () => {
  for (const change of [
    { RENDER: "false" }, { GIFT_DATA_SOURCE: "pglite" }, { GIFT_DATA_SOURCE: "starter" },
    { APP_DEPLOYMENT: "local" }, { STATIC_EXPORT: "true" }, { GITHUB_PAGES: "true" },
    { MIGRATION_DATABASE_URL: "test-only" }, { ADMIN_CLIENT_IP_HEADER: "x-real-ip" },
    { RENDER_EXTERNAL_URL: "http://made-for-them-preview.onrender.com" },
    { RENDER_EXTERNAL_URL: "https://made-for-them-preview.onrender.com.evil.example" },
    { RENDER_EXTERNAL_URL: "https://made-for-them-preview.onrender.com/other" },
    { RENDER_EXTERNAL_URL: "https://name:password@made-for-them-preview.onrender.com" },
  ]) assert.throws(() => renderEnvironment({ ...render, ...change }));
  assert.throws(() => assertOwnerDeployment({ ...runtime, ADMIN_CLIENT_IP_HEADER: "x-real-ip" }));
});

test("Render listener uses the platform port and rejects invalid or reserved ports", () => {
  assert.deepEqual(renderStartArguments({ PORT: "3100" }).slice(-4), ["--hostname", "0.0.0.0", "--port", "3100"]);
  assert.equal(renderStartArguments({}).at(-1), "10000");
  for (const port of ["0", "-1", "65536", "3100;extra", "18012", "18013", "19099", "abc"]) {
    assert.throws(() => renderStartArguments({ PORT: port }));
  }
});

test("Render owner identity reads only CF-Connecting-IP, ignoring spoofable forwarding headers", () => {
  const request = (cf: string, other: string) => new Request("https://made-for-them-preview.onrender.com", {
    headers: { "cf-connecting-ip": cf, "x-real-ip": other, "x-forwarded-for": other },
  });
  assert.equal(ownerClientKey(request("192.0.2.1", "192.0.2.2"), runtime),
    ownerClientKey(request("192.0.2.1", "192.0.2.3"), runtime));
  assert.notEqual(ownerClientKey(request("192.0.2.1", "192.0.2.2"), runtime),
    ownerClientKey(request("192.0.2.4", "192.0.2.2"), runtime));
  assert.throws(() => ownerClientKey(new Request(runtime.ADMIN_ORIGIN, { headers: { "x-real-ip": "192.0.2.1" } }), runtime));
});

test("Render startup fails before listening when platform or owner settings are missing", () => {
  const env = { ...process.env, ...render, PORT: "13100", DATABASE_URL: "", ADMIN_DATABASE_URL: "",
    ADMIN_PASSWORD_HASH: "", ADMIN_SESSION_SECRET: "", MIGRATION_DATABASE_URL: "" };
  const result = spawnSync(process.execPath, ["scripts/render-start.mjs"], { env, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Deployment verification failed/);
  assert.doesNotMatch(result.stdout, /Ready|Local:/);
});
