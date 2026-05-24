import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.cwd();

function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

loadDotEnv();

const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "praxis-db.json");
const PORT = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function createEmptyDb() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspace: null,
    playbooks: [],
    runs: [],
    documents: [],
    auditLog: [],
  };
}

async function readDb() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_PATH, "utf8");
    return { ...createEmptyDb(), ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Could not read DB; creating a clean one", error);
    }
    const db = createEmptyDb();
    await writeDb(db);
    return db;
  }
}

async function writeDb(db) {
  await mkdir(DATA_DIR, { recursive: true });
  const nextDb = { ...db, updatedAt: new Date().toISOString() };
  await writeFile(DB_PATH, JSON.stringify(nextDb, null, 2), "utf8");
  return nextDb;
}

function appendAudit(db, event, detail = {}) {
  return {
    ...db,
    auditLog: [
      {
        id: randomUUID(),
        event,
        detail,
        createdAt: new Date().toISOString(),
      },
      ...(Array.isArray(db.auditLog) ? db.auditLog : []),
    ].slice(0, 250),
  };
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8_000_000) {
      throw Object.assign(new Error("Payload too large"), { statusCode: 413 });
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  sendJson(res, statusCode, {
    ok: false,
    error: statusCode === 500 ? "Internal server error" : error.message,
  });
  if (statusCode === 500) console.error(error);
}

function buildServerIntake(text = "") {
  const normalized = text.toLowerCase();
  const templateKey = detectTemplateKey(text);
  const isInsurance = templateKey === "insurance";
  const isLegal = templateKey === "legal";
  const isSupport = templateKey === "support";
  const industry = isInsurance ? "Insurance" : isLegal ? "Legal" : isSupport ? "SaaS" : "Banking";
  const workflowName = isInsurance
    ? "Claims Triage"
    : isLegal
      ? "Contract Review"
      : isSupport
        ? "Support Reply Drafting"
        : "AML Alert Briefing";

  return {
    templateKey,
    industry,
    workflowName,
    confidence: text.trim() ? 0.78 : 0.35,
    detectedSignals: {
      hasRiskLanguage: /risk|compliance|approval|policy|legal|regulated/i.test(text),
      hasSystemLanguage: /api|database|crm|warehouse|servicenow|salesforce|slack|jira/i.test(text),
      hasMetricLanguage: /\d+\s*(min|minute|hour|day|%|percent)|roi|cost|save/i.test(text),
    },
    suggestedNextStep:
      "Create or update the workspace, map connectors, identify bottlenecks, then run the pilot trace before evals.",
  };
}

function detectTemplateKey(text = "") {
  const normalized = text.toLowerCase();
  const scores = {
    banking: ["aml", "kyc", "bank", "transaction", "sanctions", "compliance", "sar"].filter((word) => normalized.includes(word)).length,
    insurance: ["claim", "insurance", "policy", "fraud", "adjuster", "damage"].filter((word) => normalized.includes(word)).length,
    legal: ["contract", "legal", "clause", "nda", "msa", "attorney", "counsel", "lawyer"].filter((word) => normalized.includes(word)).length,
    support: ["support", "ticket", "customer", "zendesk", "intercom", "bug", "sla"].filter((word) => normalized.includes(word)).length,
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "banking";
}

function extractMinutes(text = "") {
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m\b|минут[а-я]*)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const before = matches[0] || null;
  const after = matches.find((value, index) => index > 0 && (!before || value < before)) || matches[1] || null;
  return {
    beforeTime: before ? `${before}m` : null,
    afterTime: after ? `${after}m` : null,
  };
}

function extractHumanReview(text = "") {
  const percentMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => `${match[1]}%`);
  if (/attorney|lawyer|counsel|legal|human approval for every/i.test(text)) return "100%";
  if (/human|manual|review|approval|escalat/i.test(text) && percentMatches.length) return percentMatches.at(-1);
  if (/human|manual|review|approval|escalat/i.test(text)) return "20%";
  return null;
}

function extractClientName(text = "", templateKey = "banking") {
  const explicit = text.match(/\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\s+(Bank|Mutual|Insurance|Cloud|Health|Pharma|Financial|Group|Corp|Inc|LLC|SaaS)\b/);
  if (explicit) return `${explicit[1]} ${explicit[2]}`.trim();
  const defaults = {
    banking: "Northstar Bank",
    insurance: "Harbor Mutual",
    legal: "Aster Cloud",
    support: "OrbitDesk",
  };
  return defaults[templateKey] || "Design Partner";
}

function extractSystems(text = "") {
  const knownSystems = [
    "ServiceNow",
    "Salesforce",
    "HubSpot",
    "Slack",
    "Teams",
    "Gmail",
    "Outlook",
    "Google Drive",
    "SharePoint",
    "Confluence",
    "Notion",
    "Jira",
    "Linear",
    "Zendesk",
    "Intercom",
    "Snowflake",
    "BigQuery",
    "Postgres",
    "GitHub",
    "GitLab",
    "KYC database",
    "transaction warehouse",
    "sanctions API",
    "policy docs",
    "CLM",
    "Guidewire",
    "CRM",
    "telemetry",
    "billing",
  ];
  const lowered = text.toLowerCase();
  const matches = knownSystems.filter((system) => lowered.includes(system.toLowerCase()));
  return [...new Set(matches)].slice(0, 10);
}

function classifySystem(system = "") {
  const lowered = system.toLowerCase();
  if (/drive|sharepoint|confluence|notion|docs|clm/.test(lowered)) return "Document store";
  if (/snowflake|bigquery|postgres|warehouse|telemetry/.test(lowered)) return "Data warehouse";
  if (/salesforce|hubspot|crm|kyc|billing/.test(lowered)) return "Customer record";
  if (/servicenow|jira|linear|zendesk|intercom|guidewire/.test(lowered)) return "Workflow app";
  return "Enterprise system";
}

function classifyData(system = "") {
  const lowered = system.toLowerCase();
  if (/kyc|crm|customer|billing|account/.test(lowered)) return "PII";
  if (/transaction|contract|policy|claim|warehouse|clm/.test(lowered)) return "Confidential";
  if (/sanctions|audit|compliance/.test(lowered)) return "Regulated";
  return "Internal";
}

function buildConnectorPatch(systems = [], workflowName = "workflow") {
  return systems.map((system, index) => ({
    name: system,
    type: classifySystem(system),
    owner: classifySystem(system) === "Data warehouse" ? "Data platform" : classifySystem(system) === "Document store" ? "Knowledge owner" : "System owner",
    access: index < 3 ? "Read-only pending" : "Read-only sandbox",
    dataClass: classifyData(system),
    status: index < 2 ? "Needs approval" : "Sandbox ready",
    refresh: classifySystem(system) === "Data warehouse" ? "Hourly" : "Daily",
    records: `${classifyData(system)} records`,
    purpose: `Feeds ${workflowName} with context from ${system}.`,
  }));
}

function buildWorkspacePatchFromIntake(text = "") {
  const intake = buildServerIntake(text);
  const systems = extractSystems(text);
  const { beforeTime, afterTime } = extractMinutes(text);
  const humanReview = extractHumanReview(text);
  const clientName = extractClientName(text, intake.templateKey);
  const workflowName = intake.workflowName;
  const connectors = buildConnectorPatch(systems, workflowName);
  const firstAgentName = `${workflowName} Agent`;
  const target = beforeTime && afterTime ? ` from ${beforeTime} to ${afterTime}` : "";
  const riskNote = intake.detectedSignals.hasRiskLanguage ? " while preserving approval, auditability, and compliance controls" : " while preserving human review for uncertain cases";

  return {
    templateKey: intake.templateKey,
    analysis: {
      ...intake,
      extractedSystems: systems,
      extractedTimes: { beforeTime, afterTime },
      extractedHumanReview: humanReview,
      mode: process.env.LLM_API_KEY ? "llm-configured-fallback-extractor" : "deterministic-extractor",
    },
    projectPatch: {
      clientName,
      workflowName,
      ...(beforeTime ? { beforeTime } : {}),
      ...(afterTime ? { afterTime } : {}),
      ...(humanReview ? { humanReview } : {}),
      readiness: systems.length >= 4 ? 74 : 62,
      pilotStatus: systems.length >= 3 ? "Discovery complete" : "Needs discovery",
      businessProblem: text.trim()
        ? `Client intake says: ${text.slice(0, 280)}${text.length > 280 ? "..." : ""}`
        : `${clientName} needs to make ${workflowName} faster, safer, and easier to measure.`,
      firstAgent: `${firstAgentName}: collect context, call approved tools, draft a recommendation, route risky cases to human review, and write an audit trail.`,
      successMetric: `Reduce ${workflowName}${target}${riskNote}.`,
      ...(connectors.length ? { connectors } : {}),
    },
  };
}

function hasLlmConfig() {
  return Boolean(process.env.LLM_ENDPOINT && process.env.LLM_MODEL && process.env.LLM_API_KEY);
}

function safeJsonParse(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function buildWorkspacePatchFromIntakeWithProvider(text = "") {
  const fallback = buildWorkspacePatchFromIntake(text);
  if (!hasLlmConfig()) return fallback;

  const prompt = [
    "You are the PRAXIS intake engine for a Forward Deployed Engineering Operating System.",
    "Convert messy client notes into strict JSON.",
    "Return only JSON with keys: templateKey, analysis, projectPatch.",
    "analysis must include industry, workflowName, confidence, extractedSystems, extractedTimes, extractedHumanReview, mode.",
    "projectPatch may include clientName, workflowName, beforeTime, afterTime, humanReview, readiness, pilotStatus, businessProblem, firstAgent, successMetric, connectors.",
    "Do not invent credentials, private data, or production access.",
    "",
    `Client notes:\n${text.slice(0, 8000)}`,
  ].join("\n");

  try {
    const response = await fetch(process.env.LLM_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [
          { role: "system", content: "You generate strict JSON for enterprise AI deployment intake." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || payload.output_text || "";
    const parsed = safeJsonParse(content);
    if (!parsed || !parsed.projectPatch) {
      throw new Error("LLM response did not include projectPatch JSON");
    }

    return {
      templateKey: parsed.templateKey || fallback.templateKey,
      analysis: {
        ...fallback.analysis,
        ...(parsed.analysis || {}),
        mode: "llm-provider",
      },
      projectPatch: {
        ...fallback.projectPatch,
        ...parsed.projectPatch,
        connectors: Array.isArray(parsed.projectPatch.connectors)
          ? parsed.projectPatch.connectors
          : fallback.projectPatch.connectors,
      },
    };
  } catch (error) {
    return {
      ...fallback,
      analysis: {
        ...fallback.analysis,
        mode: "llm-error-fallback-extractor",
        llmError: error.message,
      },
    };
  }
}

function extractKeywords(text = "") {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "are",
    "was",
    "were",
    "has",
    "have",
    "client",
    "company",
    "team",
    "system",
    "process",
  ]);
  const counts = new Map();
  String(text)
    .toLowerCase()
    .match(/[a-z][a-z0-9_-]{3,}/g)
    ?.forEach((word) => {
      if (!stopwords.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function chunkDocument(content = "", maxLength = 900) {
  const normalized = String(content).replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks = [];
  for (let start = 0; start < normalized.length; start += maxLength) {
    const text = normalized.slice(start, start + maxLength).trim();
    chunks.push({
      id: `chunk-${String(chunks.length + 1).padStart(3, "0")}`,
      text,
      characters: text.length,
      keywords: extractKeywords(text).slice(0, 5),
    });
  }
  return chunks;
}

function createDocumentRecord({ name, content, sourceType = "pasted" }) {
  const safeContent = String(content || "").trim();
  if (!safeContent) {
    throw Object.assign(new Error("Document content is required"), { statusCode: 400 });
  }
  const safeName = String(name || "Untitled document").trim().slice(0, 160);
  const chunks = chunkDocument(safeContent);
  const systems = extractSystems(safeContent);
  const templateKey = detectTemplateKey(safeContent);
  const keywords = extractKeywords(safeContent);
  const summary = safeContent.replace(/\s+/g, " ").slice(0, 360);
  return {
    id: randomUUID(),
    name: safeName,
    sourceType,
    templateKey,
    summary: `${summary}${safeContent.length > 360 ? "..." : ""}`,
    systems,
    keywords,
    signals: {
      hasRiskLanguage: /risk|compliance|approval|policy|legal|regulated|audit/i.test(safeContent),
      hasApiLanguage: /api|endpoint|schema|payload|oauth|webhook|database/i.test(safeContent),
      hasMetricLanguage: /\d+\s*(min|minute|hour|day|%|percent)|roi|cost|save|sla/i.test(safeContent),
      hasPiiLanguage: /pii|customer|kyc|account|email|phone|address|ssn/i.test(safeContent),
    },
    sizeBytes: Buffer.byteLength(safeContent, "utf8"),
    wordCount: safeContent.split(/\s+/).filter(Boolean).length,
    chunkCount: chunks.length,
    chunks,
    createdAt: new Date().toISOString(),
  };
}

function tokenize(text = "") {
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .match(/[a-z][a-z0-9_-]{2,}/g) || [],
    ),
  ].filter((token) => !["the", "and", "for", "with", "from", "that", "this", "into", "case", "agent"].includes(token));
}

function retrieveDocumentChunks(documents = [], query = "", limit = 6) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  return documents
    .flatMap((document) =>
      (document.chunks || []).map((chunk) => {
        const haystack = `${document.name} ${document.summary} ${(document.systems || []).join(" ")} ${(document.keywords || []).join(" ")} ${chunk.text}`.toLowerCase();
        const matchedTerms = terms.filter((term) => haystack.includes(term));
        const exactPhraseBoost = haystack.includes(query.toLowerCase()) ? 4 : 0;
        const score = matchedTerms.length * 3 + exactPhraseBoost + (document.signals?.hasRiskLanguage ? 1 : 0) + (document.signals?.hasPiiLanguage ? 1 : 0);
        return {
          score,
          matchedTerms,
          citation: {
            documentId: document.id,
            documentName: document.name,
            chunkId: chunk.id,
            text: chunk.text,
            keywords: chunk.keywords || [],
            systems: document.systems || [],
            signals: document.signals || {},
            createdAt: document.createdAt,
          },
        };
      }),
    )
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function scoreServerTool(tool) {
  let score = 25;
  if (tool.name && tool.name.length > 3) score += 15;
  if (tool.code && tool.code.includes("(") && tool.code.includes(")")) score += 20;
  if (tool.copy && tool.copy.length > 35) score += 15;
  if (tool.owner && tool.owner !== "API owner") score += 10;
  if (tool.auth) score += 10;
  if (`${tool.name || ""} ${tool.copy || ""}`.toLowerCase().includes("audit")) score += 5;
  return Math.min(100, score);
}

function scoreServerConnector(connector) {
  let score = 20;
  if (connector.name) score += 12;
  if (connector.type) score += 10;
  if (connector.owner && connector.owner !== "System owner") score += 10;
  if (connector.access && connector.access !== "No access") score += 16;
  if (connector.dataClass) score += 10;
  if (connector.status && !["Blocked", "Needs approval"].includes(connector.status)) score += 16;
  if (connector.refresh) score += 8;
  if (connector.purpose) score += 8;
  return Math.min(100, score);
}

function getServerConnectorHealth(project = {}) {
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const scores = connectors.map(scoreServerConnector);
  const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length));
  const blocked = connectors.filter((connector) => connector.status === "Blocked" || connector.access === "No access").length;
  return {
    averageScore,
    blocked,
    total: connectors.length,
    ready: averageScore >= 70 && blocked === 0,
  };
}

function runServerEvalSuite(project = {}, documents = []) {
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const evalCases = Array.isArray(project.evalCases) ? project.evalCases : [];
  const readiness = Number(project.readiness) || 0;
  const toolAverage = Math.round(tools.reduce((sum, tool) => sum + scoreServerTool(tool), 0) / Math.max(1, tools.length));
  const hasAudit = tools.some((tool) => `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""}`.toLowerCase().match(/audit|trace/));

  const nextEvalCases = evalCases.map((test, index) => {
    const severity = test.severity || "Medium";
    const severityPenalty = { Low: 0, Medium: 6, High: 12, Critical: 18 }[severity] ?? 6;
    const retrievalEvidence = retrieveDocumentChunks(
      documents,
      `${test.name || ""} ${test.category || ""} ${test.input || ""} ${test.expected || ""}`,
      3,
    );
    const retrievalAdjustment = documents.length ? (retrievalEvidence.length ? 6 : -8) : 0;
    const score = Math.max(0, Math.min(100, Math.round((readiness + toolAverage) / 2 - severityPenalty + (hasAudit ? 8 : 0) + retrievalAdjustment)));
    const evidenceNote = documents.length
      ? retrievalEvidence.length
        ? ` Retrieval found ${retrievalEvidence.length} supporting chunk${retrievalEvidence.length === 1 ? "" : "s"}.`
        : " Retrieval found no supporting chunks."
      : "";
    if (severity === "Critical" && !hasAudit) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "fail",
        actual: `Backend gate failed: critical eval requires audit or trace coverage before pilot.${evidenceNote}`,
        retrievalEvidence: retrievalEvidence.map((item) => item.citation),
      };
    }
    if (score >= 74) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "pass",
        actual: `Backend gate passed with score ${score}. Evidence, tool readiness, and controls are sufficient for pilot.${evidenceNote}`,
        retrievalEvidence: retrievalEvidence.map((item) => item.citation),
      };
    }
    if (score >= 58) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "warn",
        actual: `Backend gate warning with score ${score}. Safe for sandbox, but needs stronger coverage before scale-up.${evidenceNote}`,
        retrievalEvidence: retrievalEvidence.map((item) => item.citation),
      };
    }
    return {
      ...test,
      id: test.id || `eval-${index + 1}`,
      result: "fail",
      actual: `Backend gate failed with score ${score}. Fix context, tools, or controls before live traffic.${evidenceNote}`,
      retrievalEvidence: retrievalEvidence.map((item) => item.citation),
    };
  });

  const resultCounts = nextEvalCases.reduce(
    (counts, test) => ({ ...counts, [test.result]: (counts[test.result] || 0) + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const criticalFails = nextEvalCases.filter((test) => test.severity === "Critical" && test.result === "fail").length;
  const gateScore = Math.round((resultCounts.pass * 100 + resultCounts.warn * 70) / Math.max(1, nextEvalCases.length));
  const retrievalCovered = nextEvalCases.filter((test) => Array.isArray(test.retrievalEvidence) && test.retrievalEvidence.length).length;
  return {
    evalCases: nextEvalCases,
    summary: {
      gateScore,
      passed: criticalFails === 0 && gateScore >= 80,
      criticalFails,
      resultCounts,
      toolAverage,
      hasAudit,
      retrievalCoverage: Math.round((retrievalCovered / Math.max(1, nextEvalCases.length)) * 100),
      documentCount: documents.length,
      evaluatedAt: new Date().toISOString(),
    },
  };
}

function generateToolsFromOpenApi(spec = {}) {
  const paths = spec.paths && typeof spec.paths === "object" ? spec.paths : {};
  return Object.entries(paths).flatMap(([path, methods]) =>
    Object.entries(methods || {})
      .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method.toLowerCase()))
      .map(([method, operation]) => {
        const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
        const parameters = [
          ...((operation.parameters || []).map((param) => param.name).filter(Boolean)),
          ...(operation.requestBody ? ["body"] : []),
        ];
        const signature = `${operationId}(${parameters.join(", ")})`;
        const risk = ["post", "put", "patch", "delete"].includes(method.toLowerCase()) ? "High" : "Medium";
        return {
          name: operation.summary || operationId,
          code: signature,
          copy: operation.description || operation.summary || `${method.toUpperCase()} ${path} from imported OpenAPI spec.`,
          owner: spec.info?.title || "API owner",
          auth: risk === "High" ? "Service account + approval" : "Read-only service",
          risk,
          importedFrom: "OpenAPI",
          method: method.toUpperCase(),
          path,
        };
      }),
  );
}

function toToolIdentifier(name = "tool") {
  const base = String(name)
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
  return base || "tool";
}

function generateMcpServerCode({ name = "PRAXIS Tool Server", tools = [] } = {}) {
  const safeTools = Array.isArray(tools) ? tools : [];
  const registrations = safeTools
    .map((tool) => {
      const toolName = toToolIdentifier(tool.name || tool.code);
      const description = String(tool.copy || "Generated from PRAXIS Tool Fabric.").replace(/`/g, "\\`");
      const displayName = String(tool.name || toolName).replace(/\*\//g, "* /");
      const contract = String(tool.code || `${toolName}(input)`).replace(/\*\//g, "* /");
      const auth = String(tool.auth || "unspecified").replace(/\*\//g, "* /");
      const risk = String(tool.risk || "Medium").replace(/\*\//g, "* /");
      return `server.tool(
  "${toolName}",
  \`${description}\`,
  {
    input: z.any().optional()
  },
  async ({ input }) => {
    // TODO: Wire ${displayName} to the real enterprise API.
    // Contract: ${contract}
    // Auth: ${auth}
    // Risk: ${risk}
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: false, message: "Tool stub not connected yet", input }, null, 2)
        }
      ]
    };
  }
);`;
    })
    .join("\n\n");

  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "${String(name).replace(/"/g, '\\"')}",
  version: "0.1.0"
});

${registrations || "// Add tools in PRAXIS Tool Fabric, then regenerate this file."}

const transport = new StdioServerTransport();
await server.connect(transport);
`;
}

function runAgentRuntime({ project = {}, documents = [], caseInput = "" } = {}) {
  const workflowName = project.workflowName || "Unknown workflow";
  const clientName = project.clientName || "Unknown client";
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const evalCases = Array.isArray(project.evalCases) ? project.evalCases : [];
  const approvalGate =
    project.governance?.approvals?.find((approval) => approval.status !== "Approved") ||
    project.governance?.approvals?.[0] ||
    { gate: "Human review", approver: "Workflow owner", status: "Pending", notes: "Default human handoff gate." };
  const bottleneck =
    (Array.isArray(project.processSteps) ? project.processSteps : []).find((step) =>
      (step.tags || []).some((tag) => String(tag).toLowerCase() === "bottleneck"),
    ) ||
    (Array.isArray(project.processSteps) ? project.processSteps[0] : null) ||
    { title: "Unmapped workflow step", system: "Unknown system", pain: "Process map is incomplete." };

  const startedAt = Date.now();
  const query = [caseInput, workflowName, project.businessProblem, project.successMetric].filter(Boolean).join(" ");
  const retrievalResults = retrieveDocumentChunks(documents, query, 5);
  const connectorHealth = getServerConnectorHealth(project);
  const toolScores = tools.map((tool) => ({ tool, score: scoreServerTool(tool) }));
  const callableTools = toolScores.filter((item) => item.score >= 65).slice(0, 5).map((item) => item.tool);
  const toolAverage = Math.round(toolScores.reduce((sum, item) => sum + item.score, 0) / Math.max(1, toolScores.length));
  const governance = runGovernanceChecks(project);
  const evalResult = runServerEvalSuite(project, documents);
  const retrievalScore = documents.length ? (retrievalResults.length ? 92 : 45) : 62;
  const confidence = Math.max(
    25,
    Math.min(
      97,
      Math.round(
        connectorHealth.averageScore * 0.22 +
          toolAverage * 0.2 +
          governance.score * 0.22 +
          evalResult.summary.gateScore * 0.18 +
          retrievalScore * 0.18,
      ),
    ),
  );
  const failedCritical = evalCases.some((test) => test.severity === "Critical" && test.result === "fail");
  const highRiskTools = callableTools.filter((tool) => tool.risk === "High");
  const requiresHumanReview = !governance.passed || !evalResult.summary.passed || failedCritical || confidence < 82 || highRiskTools.length > 0;
  const outcome = failedCritical
    ? "Blocked by critical eval"
    : !governance.passed
      ? "Blocked by governance"
      : !evalResult.summary.passed
        ? "Sandbox only"
        : requiresHumanReview
          ? "Human review required"
          : "Autonomous draft ready";
  const latencyMs = 420 + retrievalResults.length * 55 + callableTools.length * 140 + evalCases.length * 65;
  const estimatedCostUsd = Number((0.02 + retrievalResults.length * 0.006 + callableTools.length * 0.018 + evalCases.length * 0.004).toFixed(3));
  const runId = `PX-${workflowName.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 8)}`;

  const trace = [
    {
      layer: "Trigger",
      title: "Runtime received case",
      detail: caseInput || `New ${workflowName} case entered PRAXIS Agent Runtime.`,
      status: "Logged",
      latencyMs: 35,
    },
    {
      layer: "L1",
      title: "Retrieved context",
      detail: retrievalResults.length
        ? `${retrievalResults.length} document chunk${retrievalResults.length === 1 ? "" : "s"} matched the case.`
        : "No document chunks matched. Runtime falls back to structured workspace context.",
      status: retrievalResults.length ? "Evidence found" : "Sparse context",
      latencyMs: 85 + retrievalResults.length * 20,
    },
    {
      layer: "L2",
      title: "Prepared tool calls",
      detail: `${callableTools.length} tool${callableTools.length === 1 ? "" : "s"} are callable above readiness threshold. ${highRiskTools.length} are high-risk.`,
      status: callableTools.length ? "Callable" : "No tools",
      latencyMs: 90 + callableTools.length * 35,
    },
    {
      layer: "L3",
      title: "Generated recommendation",
      detail: `Runtime produced a ${requiresHumanReview ? "reviewable draft" : "controlled action draft"} with ${confidence}% confidence.`,
      status: `${confidence}% confidence`,
      latencyMs: 130,
    },
    {
      layer: "L4",
      title: "Checked eval gate",
      detail: `Eval gate score ${evalResult.summary.gateScore}; retrieval coverage ${evalResult.summary.retrievalCoverage}%.`,
      status: evalResult.summary.passed ? "Passed" : "Needs work",
      latencyMs: 65 + evalCases.length * 25,
    },
    {
      layer: "L5",
      title: "Checked governance",
      detail: `${governance.findings.length} governance finding${governance.findings.length === 1 ? "" : "s"}; score ${governance.score}.`,
      status: governance.passed ? "Passed" : "Blocked",
      latencyMs: 55,
    },
    {
      layer: "Handoff",
      title: requiresHumanReview ? "Routed to human" : "Ready for controlled automation",
      detail: requiresHumanReview
        ? `${approvalGate.gate} goes to ${approvalGate.approver}.`
        : "No blocking controls detected. Runtime can prepare controlled downstream action.",
      status: requiresHumanReview ? "Human review" : "Ready",
      latencyMs: 40,
    },
  ];

  return {
    id: runId,
    createdAt: new Date(startedAt).toISOString(),
    clientName,
    workflowName,
    caseInput,
    outcome,
    confidence,
    latencyMs,
    estimatedCostUsd,
    requiresHumanReview,
    bottleneck,
    readableConnectors: connectors.filter((connector) => connector.status !== "Blocked").slice(0, 5),
    callableTools,
    approvalGate,
    connectorHealth,
    toolAverage,
    governance,
    evalSummary: evalResult.summary,
    retrievalResults,
    decision: {
      recommendation: requiresHumanReview
        ? `Prepare ${workflowName} briefing and route it to ${approvalGate.approver} before action.`
        : `Prepare ${workflowName} briefing and proceed to controlled action draft.`,
      nextAction: requiresHumanReview ? "human_review_queue" : "controlled_action_ready",
      reason: outcome,
    },
    audit: {
      model: hasLlmConfig() ? process.env.LLM_MODEL : "deterministic-runtime-v1",
      events: project.governance?.auditEvents || [],
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date(startedAt + latencyMs).toISOString(),
    },
    trace,
  };
}

function runGovernanceChecks(project = {}) {
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const governance = project.governance || {};
  const approvals = Array.isArray(governance.approvals) ? governance.approvals : [];
  const policies = Array.isArray(governance.policies) ? governance.policies : [];
  const auditEvents = Array.isArray(governance.auditEvents) ? governance.auditEvents : [];
  const findings = [];

  connectors.forEach((connector) => {
    if (connector.status === "Blocked" || connector.access === "No access") {
      findings.push({
        severity: "High",
        area: "Connector access",
        title: `${connector.name} is not accessible`,
        detail: "Production or pilot runs should not depend on blocked data sources.",
      });
    }
    if (["PII", "Regulated"].includes(connector.dataClass) && !String(connector.access || "").toLowerCase().includes("pending") && !approvals.some((approval) => approval.status === "Approved")) {
      findings.push({
        severity: "Medium",
        area: "Sensitive data",
        title: `${connector.name} contains ${connector.dataClass} data`,
        detail: "Sensitive sources should have explicit approval and masking policy before agent retrieval.",
      });
    }
  });

  tools.forEach((tool) => {
    if (tool.risk === "High" && !String(tool.auth || "").toLowerCase().includes("approval")) {
      findings.push({
        severity: "High",
        area: "Tool control",
        title: `${tool.name} is high-risk without approval auth`,
        detail: "High-risk tools need service account + approval or human-only execution.",
      });
    }
  });

  if (!auditEvents.length || auditEvents.length < 5) {
    findings.push({
      severity: "High",
      area: "Auditability",
      title: "Audit trail is incomplete",
      detail: "Every run should capture trigger, context, tools, model output, reviewer, action, and timestamp.",
    });
  }

  const pendingApprovals = approvals.filter((approval) => approval.status !== "Approved");
  pendingApprovals.forEach((approval) => {
    findings.push({
      severity: approval.status === "Blocked" ? "High" : "Medium",
      area: "Approval gate",
      title: `${approval.gate} is ${approval.status}`,
      detail: approval.notes || "Approval must be resolved before controlled production.",
    });
  });

  const requiredPolicies = policies.filter((policy) => ["High", "Critical"].includes(policy.severity));
  const approvedOrRequired = requiredPolicies.filter((policy) => ["Approved", "Required"].includes(policy.status));
  const score = Math.max(0, Math.min(100, Math.round(
    100 -
      findings.filter((finding) => finding.severity === "High").length * 18 -
      findings.filter((finding) => finding.severity === "Medium").length * 8 +
      (requiredPolicies.length ? (approvedOrRequired.length / requiredPolicies.length) * 10 : 0),
  )));

  return {
    score,
    passed: score >= 80 && !findings.some((finding) => finding.severity === "High"),
    findings,
    checkedAt: new Date().toISOString(),
  };
}

async function handleApi(req, res, url) {
  const db = await readDb();

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      product: "PRAXIS",
      version: "0.2.0",
      database: DB_PATH,
      updatedAt: db.updatedAt,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workspace") {
    sendJson(res, 200, { ok: true, workspace: db.workspace });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/workspace") {
    const body = await readJsonBody(req);
    const nextDb = appendAudit(
      {
        ...db,
        workspace: {
          project: body.project || null,
          selectedOpportunity: body.selectedOpportunity || "aml",
          evalsRun: Boolean(body.evalsRun),
          savedAt: new Date().toISOString(),
        },
      },
      "workspace.saved",
      { clientName: body.project?.clientName, workflowName: body.project?.workflowName },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, workspace: saved.workspace, updatedAt: saved.updatedAt });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/playbooks") {
    sendJson(res, 200, { ok: true, playbooks: Array.isArray(db.playbooks) ? db.playbooks : [] });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/playbooks") {
    const body = await readJsonBody(req);
    const nextDb = appendAudit(
      {
        ...db,
        playbooks: Array.isArray(body.playbooks) ? body.playbooks : [],
      },
      "playbooks.saved",
      { count: Array.isArray(body.playbooks) ? body.playbooks.length : 0 },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, playbooks: saved.playbooks, updatedAt: saved.updatedAt });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    sendJson(res, 200, { ok: true, runs: Array.isArray(db.runs) ? db.runs : [] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/documents") {
    sendJson(res, 200, { ok: true, documents: Array.isArray(db.documents) ? db.documents : [] });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/documents") {
    const body = await readJsonBody(req);
    const document = createDocumentRecord({
      name: body.name,
      content: body.content,
      sourceType: body.sourceType || "pasted",
    });
    const nextDb = appendAudit(
      {
        ...db,
        documents: [document, ...(Array.isArray(db.documents) ? db.documents : [])].slice(0, 500),
      },
      "document.ingested",
      { documentId: document.id, name: document.name, chunkCount: document.chunkCount, systems: document.systems.length },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 201, { ok: true, document, totalDocuments: saved.documents.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/documents/search") {
    const body = await readJsonBody(req);
    const query = String(body.query || "").toLowerCase().trim();
    const documents = Array.isArray(db.documents) ? db.documents : [];
    const results = documents
      .map((document) => {
        const haystack = [document.name, document.summary, ...(document.keywords || []), ...(document.systems || [])].join(" ").toLowerCase();
        const chunkMatches = (document.chunks || []).filter((chunk) => chunk.text.toLowerCase().includes(query)).slice(0, 3);
        const score = query ? (haystack.includes(query) ? 2 : 0) + chunkMatches.length : 1;
        return { document, chunkMatches, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    sendJson(res, 200, { ok: true, query, results });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/retrieval/query") {
    const body = await readJsonBody(req);
    const query = String(body.query || "").trim();
    const limit = Math.max(1, Math.min(20, Number(body.limit) || 6));
    const documents = Array.isArray(db.documents) ? db.documents : [];
    const results = retrieveDocumentChunks(documents, query, limit);
    const nextDb = appendAudit(db, "retrieval.query", {
      query,
      resultCount: results.length,
      documentCount: documents.length,
    });
    await writeDb(nextDb);
    sendJson(res, 200, {
      ok: true,
      query,
      totalDocuments: documents.length,
      results,
    });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/documents/")) {
    const documentId = decodeURIComponent(url.pathname.replace("/api/documents/", ""));
    const currentDocuments = Array.isArray(db.documents) ? db.documents : [];
    const document = currentDocuments.find((item) => item.id === documentId);
    const nextDb = appendAudit(
      {
        ...db,
        documents: currentDocuments.filter((item) => item.id !== documentId),
      },
      "document.deleted",
      { documentId, name: document?.name },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, deleted: Boolean(document), totalDocuments: saved.documents.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/agent/run") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const run = runAgentRuntime({
      project,
      documents: Array.isArray(db.documents) ? db.documents : [],
      caseInput: body.caseInput || "",
    });
    const nextDb = appendAudit(
      {
        ...db,
        runs: [
          {
            id: run.id,
            createdAt: run.createdAt,
            clientName: run.clientName,
            workflowName: run.workflowName,
            outcome: run.outcome,
            confidence: run.confidence,
            trace: run.trace,
            payload: run,
          },
          ...(Array.isArray(db.runs) ? db.runs : []),
        ].slice(0, 500),
      },
      "agent.run",
      {
        runId: run.id,
        workflowName: run.workflowName,
        outcome: run.outcome,
        confidence: run.confidence,
        requiresHumanReview: run.requiresHumanReview,
      },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 201, { ok: true, run, totalRuns: saved.runs.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/runs") {
    const body = await readJsonBody(req);
    const run = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      clientName: body.clientName || body.project?.clientName || db.workspace?.project?.clientName || "Unknown client",
      workflowName: body.workflowName || body.project?.workflowName || db.workspace?.project?.workflowName || "Unknown workflow",
      outcome: body.outcome || "Recorded",
      confidence: Number(body.confidence) || null,
      trace: Array.isArray(body.trace) ? body.trace : [],
      payload: body,
    };
    const nextDb = appendAudit(
      {
        ...db,
        runs: [run, ...(Array.isArray(db.runs) ? db.runs : [])].slice(0, 500),
      },
      "run.recorded",
      { runId: run.id, workflowName: run.workflowName, outcome: run.outcome },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 201, { ok: true, run, totalRuns: saved.runs.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/intake") {
    const body = await readJsonBody(req);
    sendJson(res, 200, { ok: true, intake: buildServerIntake(body.text || "") });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/intake/workspace") {
    const body = await readJsonBody(req);
    const result = await buildWorkspacePatchFromIntakeWithProvider(body.text || "");
    const nextDb = appendAudit(db, "intake.workspace.generated", {
      templateKey: result.templateKey,
      workflowName: result.projectPatch.workflowName,
      systems: result.analysis.extractedSystems.length,
      mode: result.analysis.mode,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/evals/run") {
    const body = await readJsonBody(req);
    const result = runServerEvalSuite(body.project || db.workspace?.project || {}, Array.isArray(db.documents) ? db.documents : []);
    const nextDb = appendAudit(db, "evals.run", {
      workflowName: body.project?.workflowName || db.workspace?.project?.workflowName,
      gateScore: result.summary.gateScore,
      passed: result.summary.passed,
      retrievalCoverage: result.summary.retrievalCoverage,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/openapi/import") {
    const body = await readJsonBody(req);
    const spec = typeof body.spec === "string" ? JSON.parse(body.spec) : body.spec;
    const tools = generateToolsFromOpenApi(spec || {});
    const nextDb = appendAudit(db, "openapi.imported", {
      title: spec?.info?.title,
      tools: tools.length,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, title: spec?.info?.title || "OpenAPI import", tools });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/mcp/generate") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const tools = Array.isArray(body.tools) ? body.tools : Array.isArray(project.tools) ? project.tools : [];
    const code = generateMcpServerCode({
      name: `${project.workflowName || "PRAXIS"} MCP Server`,
      tools,
    });
    const nextDb = appendAudit(db, "mcp.generated", {
      workflowName: project.workflowName,
      tools: tools.length,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, code, toolCount: tools.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/governance/check") {
    const body = await readJsonBody(req);
    const result = runGovernanceChecks(body.project || db.workspace?.project || {});
    const nextDb = appendAudit(db, "governance.checked", {
      score: result.score,
      passed: result.passed,
      findings: result.findings.length,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }

  sendJson(res, 404, { ok: false, error: "API route not found" });
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(resolve(ROOT, `.${requestedPath}`));
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { ok: false, error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    sendError(res, error);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`PRAXIS local server running at http://localhost:${PORT}`);
});
