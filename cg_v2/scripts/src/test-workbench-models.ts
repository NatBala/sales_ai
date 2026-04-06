import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type RepoModelCapability = "chat" | "embeddings" | "transcription" | "image" | "realtime" | "audio" | "unknown";
type HttpHeaders = Record<string, string>;

interface RepoModelUsage {
  model: string;
  capability: RepoModelCapability;
  references: string[];
}

interface WorkbenchDeployment {
  deploymentName: string;
  modelName: string;
  modelVersion: string;
  location: string | null;
  skuName: string | null;
  capabilities: Record<string, string>;
}

interface ProbeResult {
  ok: boolean;
  status: number;
  detail: string;
}

function findWorkspaceRoot(startDir: string): string {
  let currentDir = resolve(startDir);

  while (true) {
    if (existsSync(join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolve(startDir);
    }

    currentDir = parentDir;
  }
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const defaultDiscoveryUrl = "https://api.workbench.kpmg/genai/azure/deployments/inference";
const defaultOpenAIBaseUrl = "https://apim-hub-wb-amer-use-pd.azure-api.net";
const defaultApiVersion = "2024-12-01-preview";
const modelPattern = /model\s*:\s*["']([^"']+)["']/g;

loadDotEnv(resolve(workspaceRoot, ".env"));

function loadDotEnv(filePath: string): void {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function walkTypeScriptFiles(dirPath: string): string[] {
  const skipDirs = new Set([".git", ".local", "node_modules", "dist", "attached_assets"]);
  const files: string[] = [];

  for (const entry of readdirSync(dirPath)) {
    if (skipDirs.has(entry) || entry.startsWith(".")) continue;

    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkTypeScriptFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function inferCapability(model: string): RepoModelCapability {
  const normalized = model.toLowerCase();

  if (normalized.includes("embedding")) return "embeddings";
  if (normalized === "gpt-realtime") return "realtime";
  if (normalized === "gpt-image-1") return "image";
  if (normalized === "gpt-audio") return "audio";
  if (normalized === "whisper-1" || normalized.endsWith("-transcribe")) return "transcription";
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4")) {
    return "chat";
  }

  return "unknown";
}

function collectRepoModels(): RepoModelUsage[] {
  const modelMap = new Map<string, RepoModelUsage>();

  for (const filePath of walkTypeScriptFiles(workspaceRoot)) {
    const content = readFileSync(filePath, "utf8");
    for (const match of content.matchAll(modelPattern)) {
      const model = match[1]?.trim();
      if (!model) continue;

      const key = `${model}::${inferCapability(model)}`;
      const existing = modelMap.get(key);
      const lineNumber = content.slice(0, match.index ?? 0).split(/\r?\n/).length;
      const reference = `${relative(workspaceRoot, filePath)}:${lineNumber}`;

      if (existing) {
        if (!existing.references.includes(reference)) {
          existing.references.push(reference);
        }
        continue;
      }

      modelMap.set(key, {
        model,
        capability: inferCapability(model),
        references: [reference],
      });
    }
  }

  return [...modelMap.values()].sort((left, right) => left.model.localeCompare(right.model));
}

function normalizeRegion(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => (
      typeof entryValue === "string" ? [[key, entryValue]] : []
    )),
  );
}

function collectDeploymentsFromPayload(payload: unknown): WorkbenchDeployment[] {
  const deployments = new Map<string, WorkbenchDeployment>();

  function visit(node: unknown, inheritedLocation: string | null = null): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inheritedLocation);
      return;
    }

    const record = node as Record<string, unknown>;
    const properties = (record.properties && typeof record.properties === "object")
      ? record.properties as Record<string, unknown>
      : null;
    const model = (properties?.model && typeof properties.model === "object")
      ? properties.model as Record<string, unknown>
      : null;
    const location = typeof record.location === "string" ? record.location : inheritedLocation;

    if (typeof record.name === "string" && model && typeof model.name === "string") {
      const deployment: WorkbenchDeployment = {
        deploymentName: record.name,
        modelName: model.name,
        modelVersion: typeof model.version === "string" ? model.version : "",
        location,
        skuName: (
          record.sku &&
          typeof record.sku === "object" &&
          typeof (record.sku as Record<string, unknown>).name === "string"
        )
          ? (record.sku as Record<string, unknown>).name as string
          : null,
        capabilities: toStringRecord(properties?.capabilities),
      };

      deployments.set(`${deployment.deploymentName}::${deployment.modelName}`, deployment);
    }

    if (Array.isArray(properties?.deployments)) {
      visit(properties.deployments, location);
    }

    if (Array.isArray(record.value)) {
      visit(record.value, inheritedLocation);
    }
  }

  visit(payload);
  return [...deployments.values()];
}

function supportsCapability(deployment: WorkbenchDeployment, capability: RepoModelCapability): boolean {
  switch (capability) {
    case "chat":
      return deployment.capabilities.chatCompletion === "true" || deployment.capabilities.responses === "true";
    case "embeddings":
      return deployment.capabilities.embeddings === "true";
    default:
      return false;
  }
}

function pickDeployment(
  deployments: WorkbenchDeployment[],
  model: RepoModelUsage,
  preferredRegion: string | null,
): WorkbenchDeployment | null {
  const matching = deployments.filter((deployment) =>
    deployment.modelName.toLowerCase() === model.model.toLowerCase() &&
    supportsCapability(deployment, model.capability),
  );

  if (matching.length === 0) return null;

  const ranked = [...matching].sort((left, right) => {
    const leftRegionScore = normalizeRegion(left.location) === preferredRegion ? 0 : 1;
    const rightRegionScore = normalizeRegion(right.location) === preferredRegion ? 0 : 1;
    if (leftRegionScore !== rightRegionScore) return leftRegionScore - rightRegionScore;

    const leftSkuScore = left.skuName?.includes("GlobalStandard") ? 0 : 1;
    const rightSkuScore = right.skuName?.includes("GlobalStandard") ? 0 : 1;
    if (leftSkuScore !== rightSkuScore) return leftSkuScore - rightSkuScore;

    return left.deploymentName.localeCompare(right.deploymentName);
  });

  return ranked[0] ?? null;
}

function buildHeaders(subscriptionKey: string, chargeCode?: string, regionOverride?: string): HttpHeaders {
  const headers: HttpHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    accept: "application/json",
    "Ocp-Apim-Subscription-Key": subscriptionKey,
  };

  if (chargeCode) headers["x-kpmg-charge-code"] = chargeCode;
  if (regionOverride) headers["x-kpmg-region-override"] = regionOverride;

  return headers;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function probeChatDeployment(
  baseUrl: string,
  apiVersion: string,
  deploymentName: string,
  headers: HttpHeaders,
): Promise<ProbeResult> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/genai/azure/openai/deployments/${encodeURIComponent(deploymentName)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a terse assistant." },
          { role: "user", content: "Reply with the single word ok." },
        ],
        temperature: 0,
        max_tokens: 16,
      }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, detail: text.slice(0, 240).replace(/\s+/g, " ") };
  }

  const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  const content = parsed.choices?.[0]?.message?.content?.trim() || "empty response";
  return { ok: true, status: response.status, detail: content };
}

async function probeEmbeddingDeployment(
  baseUrl: string,
  apiVersion: string,
  deploymentName: string,
  headers: HttpHeaders,
): Promise<ProbeResult> {
  const response = await fetch(
    `${trimTrailingSlash(baseUrl)}/genai/azure/openai/deployments/${encodeURIComponent(deploymentName)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: "Workbench connectivity test",
      }),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, detail: text.slice(0, 240).replace(/\s+/g, " ") };
  }

  const parsed = JSON.parse(text) as { data?: Array<{ embedding?: number[] }> };
  const dimensions = parsed.data?.[0]?.embedding?.length ?? 0;
  return { ok: true, status: response.status, detail: `embedding dimensions: ${dimensions}` };
}

async function main(): Promise<void> {
  const repoModels = collectRepoModels();
  const subscriptionKey = process.env.WORKBENCH_SUBSCRIPTION_KEY?.trim();

  if (!subscriptionKey) {
    console.error("Missing WORKBENCH_SUBSCRIPTION_KEY. Existing OpenAI settings were not changed.");
    console.error("Set WORKBENCH_SUBSCRIPTION_KEY and rerun this script to test Workbench.");
    process.exit(1);
  }

  const discoveryUrl = process.env.WORKBENCH_DISCOVERY_URL?.trim() || defaultDiscoveryUrl;
  const openAIBaseUrl = process.env.WORKBENCH_OPENAI_BASE_URL?.trim() || defaultOpenAIBaseUrl;
  const apiVersion = process.env.WORKBENCH_API_VERSION?.trim() || defaultApiVersion;
  const chargeCode = process.env.WORKBENCH_CHARGE_CODE?.trim();
  const regionOverride = process.env.WORKBENCH_REGION_OVERRIDE?.trim();
  const preferredRegion = normalizeRegion(regionOverride);
  const headers = buildHeaders(subscriptionKey, chargeCode, regionOverride);

  console.log(`Workspace root: ${workspaceRoot}`);
  console.log(`Workbench discovery: ${discoveryUrl}`);
  console.log(`Workbench OpenAI base: ${openAIBaseUrl}`);
  console.log("");
  console.log("Models discovered in repo:");
  for (const usage of repoModels) {
    console.log(`- ${usage.model} [${usage.capability}]`);
    for (const reference of usage.references) {
      console.log(`  ${reference}`);
    }
  }

  console.log("");
  console.log("Fetching Workbench deployments...");

  const discoveryCandidates = [
    discoveryUrl,
    `${trimTrailingSlash(openAIBaseUrl)}/genai/azure/deployments/inference`,
  ].filter((value, index, values) => values.indexOf(value) === index);

  let discoveryPayload: unknown = null;
  let discoverySource = "";
  const discoveryErrors: string[] = [];

  for (const candidate of discoveryCandidates) {
    try {
      const discoveryResponse = await fetch(candidate, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          accept: "application/json",
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          ...(chargeCode ? { "x-kpmg-charge-code": chargeCode } : {}),
          ...(regionOverride ? { "x-kpmg-region-override": regionOverride } : {}),
        },
      });

      const discoveryText = await discoveryResponse.text();
      if (!discoveryResponse.ok) {
        discoveryErrors.push(`${candidate} -> ${discoveryResponse.status}: ${discoveryText.slice(0, 220).replace(/\s+/g, " ")}`);
        continue;
      }

      discoveryPayload = JSON.parse(discoveryText) as unknown;
      discoverySource = candidate;
      break;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      discoveryErrors.push(`${candidate} -> fetch failed: ${message}`);
    }
  }

  if (!discoveryPayload) {
    console.error("Discovery failed on every configured endpoint:");
    for (const error of discoveryErrors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const deployments = collectDeploymentsFromPayload(discoveryPayload);
  console.log(`Discovery source: ${discoverySource}`);
  console.log(`Workbench deployments discovered: ${deployments.length}`);
  console.log("");

  let exactMatches = 0;
  let successfulProbes = 0;
  let unsupportedModels = 0;
  let failedProbes = 0;

  for (const usage of repoModels) {
    const matchingDeployments = deployments.filter((deployment) =>
      deployment.modelName.toLowerCase() === usage.model.toLowerCase(),
    );
    const selected = pickDeployment(deployments, usage, preferredRegion);

    console.log(`${usage.model} [${usage.capability}]`);

    if (matchingDeployments.length === 0) {
      unsupportedModels += 1;
      console.log("  Workbench match: none");
      console.log("  Probe: skipped");
      console.log("");
      continue;
    }

    exactMatches += 1;
    console.log(`  Workbench matches: ${matchingDeployments.map((item) => item.deploymentName).join(", ")}`);

    if (!selected) {
      unsupportedModels += 1;
      console.log("  Capability support: no compatible deployment for this model type");
      console.log("  Probe: skipped");
      console.log("");
      continue;
    }

    console.log(`  Selected deployment: ${selected.deploymentName}${selected.location ? ` (${selected.location})` : ""}`);

    let probe: ProbeResult | null = null;
    if (usage.capability === "chat") {
      probe = await probeChatDeployment(openAIBaseUrl, apiVersion, selected.deploymentName, headers);
    } else if (usage.capability === "embeddings") {
      probe = await probeEmbeddingDeployment(openAIBaseUrl, apiVersion, selected.deploymentName, headers);
    }

    if (!probe) {
      console.log("  Probe: skipped (no simple Workbench endpoint configured for this capability)");
      console.log("");
      continue;
    }

    if (probe.ok) {
      successfulProbes += 1;
      console.log(`  Probe: PASS (${probe.status}) - ${probe.detail}`);
    } else {
      failedProbes += 1;
      console.log(`  Probe: FAIL (${probe.status}) - ${probe.detail}`);
    }

    console.log("");
  }

  console.log("Summary");
  console.log(`- Repo models found: ${repoModels.length}`);
  console.log(`- Models with exact Workbench matches: ${exactMatches}`);
  console.log(`- Successful live probes: ${successfulProbes}`);
  console.log(`- Failed live probes: ${failedProbes}`);
  console.log(`- Missing or unsupported models: ${unsupportedModels}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Workbench test failed: ${message}`);
  process.exit(1);
});
