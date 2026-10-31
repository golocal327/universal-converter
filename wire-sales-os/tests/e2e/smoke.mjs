/**
 * End-to-end smoke test against a running deployment (local or preview).
 *
 *   BASE_URL=http://localhost:3000 E2E_EMAIL=demo@wire.local E2E_PASSWORD=… node tests/e2e/smoke.mjs
 *
 * Signs in, visits every page, exercises the main flows (create lead, log
 * outreach, create task, generate proposal, import CSV, move a deal, saved
 * filter, signup + onboarding) and fails on server errors or console errors.
 * Optional: CHROMIUM_PATH, SCREENSHOTS_DIR.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "demo@wire.local";
const PASSWORD = process.env.E2E_PASSWORD;
const SHOTS = process.env.SCREENSHOTS_DIR;
if (!PASSWORD) throw new Error("Set E2E_PASSWORD");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const problems = [];
let step = "start";
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) problems.push(`[${step}] console: ${m.text().slice(0, 300)}`); });
page.on("pageerror", (e) => problems.push(`[${step}] pageerror: ${e.message.slice(0, 300)}`));
page.on("response", (r) => { if (r.status() >= 500) problems.push(`[${step}] HTTP ${r.status()} ${r.url()}`); });

const passed = [];
async function check(name, fn) {
  step = name;
  try {
    await fn();
    passed.push(name);
    console.log(`✓ ${name}`);
  } catch (e) {
    problems.push(`[${name}] ${e.message.split("\n")[0]}`);
    console.log(`✗ ${name}: ${e.message.split("\n")[0]}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `fail-${name.replace(/\W+/g, "_")}.png`) }).catch(() => {});
  }
}
const shot = (name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }) : Promise.resolve());
const visit = async (url, text) => {
  const res = await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()} for ${url}`);
  if (text) await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10_000 });
  if (await page.getByText("Application error").count()) throw new Error(`Application error on ${url}`);
};
const toast = (re) => page.locator("[data-sonner-toast]").filter({ hasText: re }).first().waitFor({ timeout: 20_000 });

await check("redirects anonymous users to login", async () => {
  await page.goto(`${BASE}/leads`);
  await page.waitForURL(/\/login\?next=%2Fleads/);
  await shot("login");
});

await check("signs in", async () => {
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/leads/);
});

const pages = [
  ["/", "What needs your attention"], ["/dashboard", "Pipeline value"], ["/leads", "Biggest opportunity"], ["/leads?priority=hot&min_score=75", "Leads"],
  ["/prospects", "Prospects"], ["/companies", "Companies"], ["/contacts", "Contacts"], ["/pipeline", "Negotiation"], ["/campaigns", "Autoescuelas Cádiz"],
  ["/tasks", "Tasks"], ["/tasks?view=overdue", "Overdue"], ["/analytics", "Revenue by sector"], ["/copilot", "AI Copilot"], ["/templates", "Primer contacto"],
  ["/settings", "Workspace name"], ["/settings?tab=sectors", "Autoescuelas"], ["/settings?tab=pricing", "Premium website redesign"], ["/settings?tab=scoring", "Target cities"],
  ["/settings?tab=integrations", "Google Places"], ["/settings?tab=ai", "Generation log"], ["/settings?tab=automation", "Public Lead API"], ["/settings?tab=data", "Demo data"],
  ["/leads/new", "Primary contact"], ["/leads/import", "Drop a CSV file here"],
];
for (const [url, text] of pages) await check(`page ${url}`, async () => { await visit(url, text); await shot(`page${url.replace(/[/?=&]+/g, "_") || "_home"}`); });

let companyUrl = "";
await check("company profile tabs", async () => {
  await visit("/leads?sort=score", "Biggest opportunity");
  await page.locator("table tbody tr a").first().click();
  await page.getByText("Why this lead?").waitFor();
  companyUrl = page.url().split("?")[0];
  await shot("company-overview");
  for (const tab of ["audit", "outreach", "timeline", "tasks", "deals", "documents", "ai"]) {
    await visit(`${companyUrl.replace(BASE, "")}?tab=${tab}`);
  }
  await visit(`${companyUrl.replace(BASE, "")}?tab=outreach`, "Rewrite with AI");
  await shot("company-outreach");
});

await check("campaign detail", async () => {
  await visit("/campaigns", "Autoescuelas Cádiz");
  await page.getByRole("link", { name: "Autoescuelas Cádiz" }).click();
  await page.getByText("Campaign funnel").waitFor();
  await page.getByRole("button", { name: "Add matching leads" }).click();
  await toast(/matching lead/);
});

await check("create lead with duplicate detection", async () => {
  await visit("/leads/new", "Primary contact");
  const suffix = Date.now().toString().slice(-6);
  const name = `Clínica E2E ${suffix}`;
  await page.getByLabel("Company name *").fill(name);
  await page.getByLabel("City").fill("Sevilla");
  await page.getByLabel("Phone", { exact: true }).fill(`954 ${suffix}`);
  await page.getByLabel("Rating").fill("4,7");
  await page.getByLabel("Reviews").fill("420");
  await page.getByRole("button", { name: "Create lead" }).click();
  await page.waitForURL(/\/companies\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.getByText(name).first().waitFor();
  await page.getByText("No website").first().waitFor();
  // Same phone again → duplicate
  await visit("/leads/new", "Primary contact");
  await page.getByLabel("Company name *").fill(`${name} bis`);
  await page.getByLabel("Phone", { exact: true }).fill(`+34954${suffix}`);
  await page.getByRole("button", { name: "Create lead" }).click();
  await toast(/Duplicate/);
});

await check("log outreach advances pipeline and creates follow-up", async () => {
  await visit(`${companyUrl.replace(BASE, "")}?tab=outreach`, "Mark as sent");
  await page.getByRole("button", { name: "Mark as sent" }).first().click();
  await toast(/Logged as sent/);
  await visit(`${companyUrl.replace(BASE, "")}?tab=tasks`);
  await page.getByText(/Follow up with/).first().waitFor();
});

await check("create task", async () => {
  await visit("/tasks?new=1", "New task");
  await page.getByLabel("Title").fill("E2E call");
  await page.getByRole("button", { name: "Save task" }).click();
  await toast(/Task created/);
});

await check("generate proposal (rules engine)", async () => {
  await visit(companyUrl.replace(BASE, ""), "Why this lead?");
  await page.getByRole("button", { name: /Generate proposal/ }).click();
  await page.getByRole("menuitem", { name: /rules engine/ }).click();
  await page.waitForURL(/\/proposals\//, { timeout: 30_000 });
  await page.getByText("Inversión").waitFor();
  await shot("proposal");
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await toast(/Marked as sent/);
});

await check("move a deal from the company deals tab", async () => {
  await visit(`${companyUrl.replace(BASE, "")}?tab=deals`);
  await page.getByRole("combobox", { name: "Stage" }).first().click();
  await page.getByRole("option", { name: "Meeting" }).click();
  await toast(/Stage updated/);
});

await check("pipeline drag and drop (keyboard)", async () => {
  await visit("/pipeline", "Negotiation");
  const handle = page.getByRole("button", { name: /^Move / }).first();
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForTimeout(1500);
  await shot("pipeline");
});

await check("save a lead filter", async () => {
  await visit("/leads?min_score=76&max_website_score=49", "Leads");
  await page.getByRole("button", { name: "Saved" }).click();
  await page.getByRole("menuitem", { name: "Save current filters…" }).click();
  await page.getByPlaceholder("Filter name").fill("High value leads — E2E");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await toast(/Filter saved/);
});

await check("CSV import with dedupe", async () => {
  await visit("/leads/import", "Drop a CSV file here");
  const run = Date.now().toString().slice(-7);
  const row = `Taller E2E ${run},95${run},taller-${run}.example,Sevilla,Talleres,120`;
  const csv = `Nombre comercial,Teléfono,Web,Ciudad,Categoría,Reseñas\n${row}\n${row}\n,600000000,,Sevilla,,\n`;
  const file = path.join(process.env.TMPDIR ?? "/tmp", `e2e-${Date.now()}.csv`);
  writeFileSync(file, csv);
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByText("Maps to").waitFor();
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await page.getByText("Records found").waitFor();
  await page.getByRole("button", { name: /Import 1 new lead/ }).click();
  await page.getByText("Imported 1 lead(s)").waitFor({ timeout: 30_000 });
});

await check("command palette search", async () => {
  await visit("/", "What needs your attention");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search companies/).fill("autoescuela");
  await page.getByRole("option", { name: /Autoescuela/ }).first().waitFor();
  await shot("palette");
  await page.keyboard.press("Escape");
});

await check("dark mode", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  await visit("/", "What needs your attention");
  await shot("command-center-dark");
  await visit(`${companyUrl.replace(BASE, "")}`, "Why this lead?");
  await shot("company-dark");
  await page.emulateMedia({ colorScheme: "light" });
});

await check("mobile layout", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/", "What needs your attention");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Pipeline" }).click();
  await page.waitForURL(/\/pipeline/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await visit("/", "What needs your attention");
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await shot("mobile-home");
  if (homeOverflow) throw new Error("Horizontal overflow on mobile home");
  if (overflow) console.log("  (pipeline scrolls horizontally inside its board — expected)");
  await page.setViewportSize({ width: 1440, height: 900 });
});

await check("signup + onboarding creates an isolated workspace", async () => {
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  const email = `e2e-${Date.now()}@example.com`;
  await p2.goto(`${BASE}/signup`);
  await p2.getByLabel("Full name").fill("E2E Tester");
  await p2.getByLabel("Work email").fill(email);
  await p2.getByLabel("Password").fill("E2e-password-123");
  await p2.getByRole("button", { name: "Create account" }).click();
  await p2.waitForURL(/\/onboarding/, { timeout: 20_000 });
  await p2.getByLabel("Workspace name").fill("E2E Agency");
  await p2.getByLabel("Load demo data").click(); // uncheck
  await p2.getByRole("button", { name: "Create workspace" }).click();
  await p2.waitForURL(`${BASE}/`, { timeout: 30_000 });
  await p2.goto(`${BASE}/leads`);
  await p2.getByText("No leads yet").waitFor();
  await p2.goto(`${BASE}/settings?tab=sectors`);
  await p2.getByText("Autoescuelas").first().waitFor();
  // Tenant isolation: another workspace's company must not be readable.
  const res = await p2.goto(companyUrl);
  if (res?.status() !== 404) throw new Error(`Expected 404 for a foreign company, got ${res?.status()}`);
  await ctx2.close();
});

await check("public Lead API with API key", async () => {
  await visit("/settings?tab=automation", "Public Lead API");
  await page.getByPlaceholder("Key name (e.g. n8n production)").fill("E2E key");
  await page.getByRole("button", { name: "Create API key" }).click();
  const key = (await page.locator("code").filter({ hasText: /^wire_/ }).first().innerText()).trim();
  const call = (k, body) => fetch(`${BASE}/api/v1/leads`, { method: "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const bad = await call("wire_invalidinvalidinvalidinvalid", { leads: [{ company_name: "x" }] });
  if (bad.status !== 401) throw new Error(`Invalid key should be 401, got ${bad.status}`);
  const id = Date.now().toString().slice(-7);
  const lead = { company_name: `API Lead ${id}`, website: `api-${id}.example`, city: "Huelva", sector: "Clínicas", reviews: 150 };
  const first = await call(key, { leads: [lead, { website: "no-name.example" }] });
  const j1 = await first.json();
  if (first.status !== 201 || j1.created !== 1 || j1.invalid !== 1) throw new Error(`Unexpected API result ${first.status} ${JSON.stringify(j1)}`);
  const again = await (await call(key, { leads: [lead] })).json();
  if (again.duplicates !== 1) throw new Error(`Expected duplicate on second call, got ${JSON.stringify(again)}`);
});

await browser.close();
console.log(`\n${passed.length} checks passed, ${problems.length} problem(s)`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
