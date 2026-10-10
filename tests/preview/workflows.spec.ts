import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixture = JSON.parse(readFileSync(".preview-runtime.json", "utf8"));
const origin = fixture.env.ADMIN_ORIGIN;
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("quiz, sign-in, and signed-in editor have no automated accessibility violations", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make Something That Feels Like Them", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await page.goto("/admin");
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gift library editor" })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  for (const width of [390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/editor-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Owner sign-in" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("origin, JSON, owner authorization, drafts, publication, and stale edits retain their API contracts", async ({ request }) => {
  expect((await request.get("/api/admin/gifts")).status()).toBe(401);
  expect((await request.post("/api/admin/login", { data: { password: fixture.password }, headers: { Origin: "https://wrong.example" } })).status()).toBe(403);
  expect((await request.post("/api/admin/login", { data: Buffer.from("not-json"), headers: { Origin: origin, "Content-Type": "application/json" } })).status()).toBe(400);
  const login = await request.post("/api/admin/login", { data: { password: fixture.password }, headers: { Origin: origin } });
  expect(login.status()).toBe(200);
  expect(login.headers()["cache-control"]).toBe("no-store");
  const records = (await (await request.get("/api/admin/gifts")).json()).records;
  const gift = { ...records[0].gift, id: "preview-draft", title: "Isolated preview project" };
  const save = (data: unknown) => request.put("/api/admin/gifts", { data, headers: { Origin: origin } });
  let response = await save({ gift, published: false, version: null });
  expect(response.status()).toBe(200);
  let record = (await response.json()).record;
  expect(await (await request.get("/")).text()).not.toContain("Isolated preview project");
  response = await save({ ...record, gift: { ...gift, materials: [] }, published: true });
  expect(response.status()).toBe(422);
  response = await save({ ...record, published: true });
  expect(response.status()).toBe(200);
  const stale = record;
  record = (await response.json()).record;
  expect((await save({ ...stale, published: false })).status()).toBe(409);
  expect(await (await request.get("/")).text()).toContain("Isolated preview project");
  expect((await save({ ...record, published: false })).status()).toBe(200);
  expect((await request.post("/api/admin/logout", { headers: { Origin: origin } })).status()).toBe(200);
  expect((await request.get("/api/admin/gifts")).status()).toBe(401);
});

test("one hosted client's failures cannot prevent a different client signing in", async ({ playwright }) => {
  test.skip(fixture.env.GIFT_DATA_SOURCE !== "postgres", "Separate ingress identities require hosted PostgreSQL fixture.");
  const attacker = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin, "x-real-ip": "192.0.2.100" } });
  const owner = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin, "x-real-ip": "192.0.2.101" } });
  try {
    for (let i = 0; i < 10; i++) expect((await attacker.post("/api/admin/login", { data: { password: "wrong" } })).status()).toBe(401);
    expect((await attacker.post("/api/admin/login", { data: { password: fixture.password } })).status()).toBe(429);
    expect((await owner.post("/api/admin/login", { data: { password: fixture.password } })).status()).toBe(200);
    expect((await attacker.post("/api/admin/login", { data: { password: "wrong" } })).status()).toBe(429);
  } finally { await attacker.dispose(); await owner.dispose(); }
});
