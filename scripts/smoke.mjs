/**
 * Smoke test toan flow: health -> tao job -> cho generate -> kiem tra draft.
 *
 * Cach chay (tu root repo, API phai dang chay):
 *   node scripts/smoke.mjs                          # provider mac dinh: anthropic
 *   node scripts/smoke.mjs gemini gemini-3.1-flash-lite   # chi dinh provider/model
 *
 * Luu y chi phi: provider chua co API key se fallback ve stub (mien phi).
 * Voi provider that, dung model "lite/haiku" de smoke cho re.
 */
const API = process.env.API_URL ?? "http://localhost:3001";
const TOKEN = process.env.API_TOKEN ?? "";
const [provider = "anthropic", model] = process.argv.slice(2);

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { "x-api-token": TOKEN } : {}),
};

function fail(step, detail) {
  console.error(`❌ FAIL [${step}]: ${detail}`);
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// 1) Health
const health = await call("GET", "/health");
if (health.status !== 200 || health.json?.status !== "ok") {
  fail("health", `status=${health.status} body=${JSON.stringify(health.json)}`);
}
if (health.json.database !== "connected") fail("health", `database=${health.json.database}`);
console.log("✅ health: ok, database connected");

// 2) Providers list
const providers = await call("GET", "/content/ai-providers");
if (providers.status !== 200) fail("providers", `status=${providers.status}`);
console.log(
  "✅ providers:",
  providers.json.providers
    .map((p) => `${p.key}(key:${p.isConfigured ? "✓" : "✗"} on:${p.isEnabled ? "✓" : "✗"})`)
    .join(" "),
);

// 3) Tao job
const create = await call("POST", "/content/jobs", {
  siteCode: "laruki",
  sourceType: "Topic",
  sourceRef: "smoke-test",
  topic: `Smoke test bài viết ${new Date().toISOString().slice(0, 16)}`,
  keywordSeed: ["smoke test"],
  aiProvider: provider,
  ...(model ? { aiModel: model } : {}),
});
if (create.status !== 201 && create.status !== 200) {
  fail("create-job", `status=${create.status} body=${JSON.stringify(create.json)}`);
}
const jobId = create.json.jobId;
console.log(`✅ job created: ${jobId} (${provider}${model ? "/" + model : ""})`);

// 4) Cho generate xong (toi da 3 phut)
const deadline = Date.now() + 180_000;
let status = create.json.status;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000));
  const job = await call("GET", `/content/jobs/${jobId}`);
  status = job.json?.status;
  if (status === "DraftReady" || status === "Failed") break;
  process.stdout.write(".");
}
console.log("");
if (status !== "DraftReady") fail("generate", `final status=${status} (expect DraftReady)`);
console.log("✅ generate: DraftReady");

// 5) Draft co noi dung
const draft = await call("GET", `/content/jobs/${jobId}/draft`);
if (draft.status !== 200) fail("draft", `status=${draft.status}`);
const md = draft.json.draftMarkdown ?? "";
if (md.length < 500) fail("draft", `markdown qua ngan (${md.length} chars)`);
if (!md.includes("# ")) fail("draft", "thieu H1");
console.log(`✅ draft: v${draft.json.version}, ${md.length} chars, title: ${draft.json.title}`);

console.log("\n🎉 SMOKE PASS - toan bo flow hoat dong");
