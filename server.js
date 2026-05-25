import { createServer } from "node:http";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
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
const BACKUP_DIR = join(DATA_DIR, "backups");
const DB_SCHEMA_VERSION = 2;
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
    schemaVersion: DB_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspace: null,
    playbooks: [],
    runs: [],
    evalRuns: [],
    contextGraphs: [],
    connectorTests: [],
    handoffs: [],
    documents: [],
    auditLog: [],
    migrations: [],
  };
}

function migrateDb(db = {}) {
  const empty = createEmptyDb();
  const migrated = {
    ...empty,
    ...db,
    schemaVersion: Number(db.schemaVersion) || 1,
    playbooks: Array.isArray(db.playbooks) ? db.playbooks : [],
    runs: Array.isArray(db.runs) ? db.runs : [],
    evalRuns: Array.isArray(db.evalRuns) ? db.evalRuns : [],
    contextGraphs: Array.isArray(db.contextGraphs) ? db.contextGraphs : [],
    connectorTests: Array.isArray(db.connectorTests) ? db.connectorTests : [],
    handoffs: Array.isArray(db.handoffs) ? db.handoffs : [],
    documents: Array.isArray(db.documents) ? db.documents : [],
    auditLog: Array.isArray(db.auditLog) ? db.auditLog : [],
    migrations: Array.isArray(db.migrations) ? db.migrations : [],
  };

  if (migrated.schemaVersion < 2) {
    migrated.migrations = [
      {
        id: "002-operational-db-metadata",
        from: migrated.schemaVersion,
        to: 2,
        createdAt: new Date().toISOString(),
        note: "Added migration metadata, database status, and backup support.",
      },
      ...migrated.migrations,
    ];
    migrated.schemaVersion = 2;
  }

  return migrated;
}

async function readDb() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const migrated = migrateDb(parsed);
    if (migrated.schemaVersion !== parsed.schemaVersion || !Array.isArray(parsed.migrations)) {
      return writeDb(migrated);
    }
    return migrated;
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
  const nextDb = { ...migrateDb(db), updatedAt: new Date().toISOString() };
  await writeFile(DB_PATH, JSON.stringify(nextDb, null, 2), "utf8");
  return nextDb;
}

async function getDbFileStats() {
  try {
    const dbStat = await stat(DB_PATH);
    return {
      exists: true,
      sizeBytes: dbStat.size,
      modifiedAt: dbStat.mtime.toISOString(),
    };
  } catch (error) {
    return {
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}

async function listDbBackups() {
  await mkdir(BACKUP_DIR, { recursive: true });
  const files = await readdir(BACKUP_DIR, { withFileTypes: true });
  const backups = await Promise.all(
    files
      .filter((file) => file.isFile() && file.name.endsWith(".json"))
      .map(async (file) => {
        const filePath = join(BACKUP_DIR, file.name);
        const fileStat = await stat(filePath);
        return {
          name: file.name,
          sizeBytes: fileStat.size,
          createdAt: fileStat.birthtime.toISOString(),
          modifiedAt: fileStat.mtime.toISOString(),
        };
      }),
  );
  return backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function createDbBackup(reason = "manual") {
  await mkdir(BACKUP_DIR, { recursive: true });
  await readDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeReason = String(reason || "manual").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "manual";
  const fileName = `${stamp}-${safeReason}.json`;
  const backupPath = join(BACKUP_DIR, fileName);
  await copyFile(DB_PATH, backupPath);
  const backupStat = await stat(backupPath);
  return {
    name: fileName,
    path: backupPath,
    sizeBytes: backupStat.size,
    createdAt: backupStat.birthtime.toISOString(),
  };
}

async function buildDatabaseStatus(db) {
  const file = await getDbFileStats();
  const backups = await listDbBackups();
  const collections = {
    playbooks: Array.isArray(db.playbooks) ? db.playbooks.length : 0,
    runs: Array.isArray(db.runs) ? db.runs.length : 0,
    evalRuns: Array.isArray(db.evalRuns) ? db.evalRuns.length : 0,
    contextGraphs: Array.isArray(db.contextGraphs) ? db.contextGraphs.length : 0,
    connectorTests: Array.isArray(db.connectorTests) ? db.connectorTests.length : 0,
    handoffs: Array.isArray(db.handoffs) ? db.handoffs.length : 0,
    documents: Array.isArray(db.documents) ? db.documents.length : 0,
    auditEvents: Array.isArray(db.auditLog) ? db.auditLog.length : 0,
  };
  const checks = [
    { name: "schema_version", passed: Number(db.schemaVersion) === DB_SCHEMA_VERSION },
    { name: "db_file_exists", passed: file.exists },
    { name: "workspace_shape", passed: db.workspace === null || typeof db.workspace === "object" },
    { name: "postgres_schema_present", passed: existsSync(join(ROOT, "schema.sql")) },
    { name: "backup_directory_ready", passed: true },
  ];
  return {
    ok: checks.every((check) => check.passed),
    schemaVersion: db.schemaVersion,
    latestSchemaVersion: DB_SCHEMA_VERSION,
    databasePath: DB_PATH,
    file,
    collections,
    migrations: Array.isArray(db.migrations) ? db.migrations.slice(0, 8) : [],
    backups: backups.slice(0, 10),
    backupCount: backups.length,
    checks,
  };
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

function validateWorkspacePatch(result = {}) {
  const errors = [];
  if (!["banking", "insurance", "legal", "support"].includes(result.templateKey)) errors.push("templateKey must be one of banking, insurance, legal, support");
  if (!result.analysis || typeof result.analysis !== "object") errors.push("analysis object is required");
  if (!result.projectPatch || typeof result.projectPatch !== "object") errors.push("projectPatch object is required");
  if (result.projectPatch && typeof result.projectPatch.workflowName !== "string") errors.push("projectPatch.workflowName must be a string");
  if (result.projectPatch && result.projectPatch.readiness !== undefined && !Number.isFinite(Number(result.projectPatch.readiness))) errors.push("projectPatch.readiness must be numeric");
  if (result.projectPatch?.connectors !== undefined && !Array.isArray(result.projectPatch.connectors)) errors.push("projectPatch.connectors must be an array");
  if (result.analysis?.extractedSystems !== undefined && !Array.isArray(result.analysis.extractedSystems)) errors.push("analysis.extractedSystems must be an array");
  if (result.analysis?.confidence !== undefined && !Number.isFinite(Number(result.analysis.confidence))) errors.push("analysis.confidence must be numeric");
  return { valid: errors.length === 0, errors };
}

function repairWorkspacePatch(candidate = {}, fallback = buildWorkspacePatchFromIntake("")) {
  const templateKey = ["banking", "insurance", "legal", "support"].includes(candidate.templateKey) ? candidate.templateKey : fallback.templateKey;
  const analysis = {
    ...fallback.analysis,
    ...(candidate.analysis && typeof candidate.analysis === "object" ? candidate.analysis : {}),
  };
  analysis.confidence = Number.isFinite(Number(analysis.confidence)) ? Math.max(0, Math.min(1, Number(analysis.confidence))) : fallback.analysis.confidence;
  analysis.extractedSystems = Array.isArray(analysis.extractedSystems) ? analysis.extractedSystems.filter(Boolean).slice(0, 12) : fallback.analysis.extractedSystems;
  analysis.extractedTimes = analysis.extractedTimes && typeof analysis.extractedTimes === "object" ? analysis.extractedTimes : fallback.analysis.extractedTimes;

  const rawPatch = candidate.projectPatch && typeof candidate.projectPatch === "object" ? candidate.projectPatch : {};
  const projectPatch = {
    ...fallback.projectPatch,
    ...rawPatch,
  };
  projectPatch.workflowName = String(projectPatch.workflowName || fallback.projectPatch.workflowName);
  projectPatch.clientName = String(projectPatch.clientName || fallback.projectPatch.clientName);
  projectPatch.readiness = Math.max(0, Math.min(100, Number(projectPatch.readiness) || fallback.projectPatch.readiness || 60));
  projectPatch.connectors = Array.isArray(rawPatch.connectors)
    ? rawPatch.connectors.map((connector, index) => ({
        name: connector.name || `System ${index + 1}`,
        type: connector.type || classifySystem(connector.name || ""),
        owner: connector.owner || "System owner",
        access: connector.access || "Read-only pending",
        dataClass: connector.dataClass || classifyData(connector.name || ""),
        status: connector.status || "Needs approval",
        refresh: connector.refresh || "Daily",
        records: connector.records || `${connector.dataClass || "Internal"} records`,
        purpose: connector.purpose || `Feeds ${projectPatch.workflowName} with context.`,
      }))
    : fallback.projectPatch.connectors;

  return { templateKey, analysis, projectPatch };
}

async function callLlmIntake(prompt) {
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
  return payload.choices?.[0]?.message?.content || payload.output_text || "";
}

async function buildWorkspacePatchFromIntakeWithProvider(text = "") {
  const fallback = buildWorkspacePatchFromIntake(text);
  const fallbackValidation = validateWorkspacePatch(fallback);
  if (!hasLlmConfig()) {
    return {
      ...fallback,
      analysis: {
        ...fallback.analysis,
        schemaValid: fallbackValidation.valid,
        schemaErrors: fallbackValidation.errors,
        repairApplied: false,
      },
    };
  }

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
    const content = await callLlmIntake(prompt);
    const parsed = safeJsonParse(content);
    if (!parsed || !parsed.projectPatch) {
      throw new Error("LLM response did not include projectPatch JSON");
    }
    let repaired = repairWorkspacePatch(parsed, fallback);
    let validation = validateWorkspacePatch(repaired);
    let repairApplied = validation.errors.length > 0;

    if (!validation.valid) {
      const repairPrompt = [
        "Repair this PRAXIS intake JSON so it matches the required schema.",
        "Return only JSON with keys: templateKey, analysis, projectPatch.",
        `Schema errors: ${validation.errors.join("; ")}`,
        `Fallback shape: ${JSON.stringify(fallback).slice(0, 4000)}`,
        `Candidate JSON: ${JSON.stringify(repaired).slice(0, 4000)}`,
      ].join("\n");
      const repairedContent = await callLlmIntake(repairPrompt);
      const repairedParsed = safeJsonParse(repairedContent);
      if (repairedParsed) {
        repaired = repairWorkspacePatch(repairedParsed, fallback);
        validation = validateWorkspacePatch(repaired);
        repairApplied = true;
      }
    }

    if (!validation.valid) {
      return {
        ...fallback,
        analysis: {
          ...fallback.analysis,
          mode: "llm-schema-fallback-extractor",
          llmError: validation.errors.join("; "),
          schemaValid: false,
          schemaErrors: validation.errors,
          repairApplied,
        },
      };
    }

    return {
      templateKey: repaired.templateKey,
      analysis: {
        ...repaired.analysis,
        mode: "llm-provider",
        schemaValid: true,
        schemaErrors: [],
        repairApplied,
      },
      projectPatch: repaired.projectPatch,
    };
  } catch (error) {
    return {
      ...fallback,
      analysis: {
        ...fallback.analysis,
        mode: "llm-error-fallback-extractor",
        llmError: error.message,
        schemaValid: fallbackValidation.valid,
        schemaErrors: fallbackValidation.errors,
        repairApplied: false,
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

function getToolFailureModes(tool = {}, score = scoreServerTool(tool)) {
  const text = `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""} ${tool.auth || ""} ${tool.risk || ""}`.toLowerCase();
  const failures = [];
  const hasContract = Boolean(tool.code && tool.code.includes("(") && tool.code.includes(")"));
  const isHighRisk = tool.risk === "High" || /create|update|delete|file|submit|approve|route|escalate|payment|production/.test(text);
  const hasApproval = /approval|human/.test(String(tool.auth || "").toLowerCase()) || /approval|review|human/.test(text);
  const hasErrorLanguage = /error|fail|failure|timeout|retry|default|fallback|audit/.test(text);

  if (!tool.name || String(tool.name).length < 4) {
    failures.push({ code: "missing_name", severity: "High", detail: "Tool needs a clear human-readable name." });
  }
  if (!hasContract) {
    failures.push({ code: "missing_callable_contract", severity: "Critical", detail: "Callable signature must include explicit parentheses and inputs." });
  }
  if (!tool.owner || tool.owner === "API owner") {
    failures.push({ code: "owner_unknown", severity: "Medium", detail: "Every tool needs an accountable API owner before pilot." });
  }
  if (!tool.auth) {
    failures.push({ code: "auth_missing", severity: "High", detail: "Auth model is required before any agent can call the tool." });
  }
  if (isHighRisk && !hasApproval) {
    failures.push({ code: "approval_required", severity: "Critical", detail: "High-risk or write-like tools need human approval or approval-scoped service account." });
  }
  if (!hasErrorLanguage) {
    failures.push({ code: "failure_modes_missing", severity: "Medium", detail: "Description should document errors, safe defaults, retries, or audit behavior." });
  }
  if (score < 65) {
    failures.push({ code: "readiness_below_runtime_gate", severity: "High", detail: `Readiness score ${score}% is below the runtime callable threshold.` });
  }

  return failures;
}

function parseToolInputs(code = "") {
  const match = String(code).match(/\(([^)]*)\)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildToolSandboxReport(project = {}) {
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const results = tools.map((tool, index) => {
    const score = scoreServerTool(tool);
    const failures = getToolFailureModes(tool, score);
    const critical = failures.filter((failure) => failure.severity === "Critical").length;
    const high = failures.filter((failure) => failure.severity === "High").length;
    const status = critical || high ? "fail" : failures.length ? "warn" : "pass";
    const inputs = parseToolInputs(tool.code);
    const latencyMs = 25 + index * 7 + Math.max(0, 100 - score);
    return {
      id: tool.id || toToolIdentifier(tool.name || tool.code || `tool-${index + 1}`),
      name: tool.name || `Tool ${index + 1}`,
      callable: tool.code || "",
      owner: tool.owner || "API owner",
      auth: tool.auth || "Unknown",
      risk: tool.risk || "Medium",
      readiness: score,
      status,
      latencyMs,
      inputs,
      failureModes: failures,
      sampleRequest: {
        input: Object.fromEntries(inputs.map((input) => [input, `<${input}>`])),
        dryRun: true,
        sandboxOnly: true,
      },
      sampleResponse: {
        ok: status !== "fail",
        sandboxOnly: true,
        message:
          status === "pass"
            ? "Tool contract is ready for sandbox agent use."
            : status === "warn"
              ? "Tool can be tested in sandbox after warnings are accepted."
              : "Tool is blocked from agent runtime until failures are fixed.",
      },
    };
  });
  const counts = results.reduce((acc, result) => ({ ...acc, [result.status]: (acc[result.status] || 0) + 1 }), {
    pass: 0,
    warn: 0,
    fail: 0,
  });
  return {
    generatedAt: new Date().toISOString(),
    toolCount: tools.length,
    readyForAgentRuntime: results.length > 0 && counts.fail === 0,
    counts,
    results,
    failureCatalog: [...new Set(results.flatMap((result) => result.failureModes.map((failure) => failure.code)))],
  };
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

function connectorMatchesDocument(connector = {}, document = {}) {
  const tokens = uniqueServer([
    connector.name,
    connector.type,
    ...(String(connector.name || "").split(/\s+/).filter((token) => token.length > 2)),
  ]).map((token) => token.toLowerCase());
  const documentText = [
    document.name,
    document.summary,
    ...(document.systems || []),
    ...(document.keywords || []),
    ...(document.chunks || []).slice(0, 5).map((chunk) => chunk.text),
  ]
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => documentText.includes(token));
}

function buildConnectorTestReport(project = {}, documents = []) {
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const sourceChecks = connectors.map((connector) => {
    const connectorDocuments = documents.filter((document) => connectorMatchesDocument(connector, document)).slice(0, 5);
    const score = scoreServerConnector(connector);
    const sensitive = ["PII", "Confidential", "Regulated", "Financial"].includes(connector.dataClass);
    const ownerReady = connector.owner && connector.owner !== "System owner";
    const accessReady = connector.access && !["No access"].includes(connector.access);
    const writeScoped = String(connector.access || "").toLowerCase().includes("approval") || String(connector.access || "").toLowerCase().includes("delegated");
    const sandboxReady = ["Sandbox ready", "Production ready"].includes(connector.status);
    const productionReady = connector.status === "Production ready";
    const hasPurpose = Boolean(connector.purpose && connector.records);
    const tests = [
      {
        code: "owner",
        label: "Owner mapped",
        status: ownerReady ? "pass" : "warn",
        detail: ownerReady ? `${connector.owner} owns the source.` : "Assign a real system owner before production.",
      },
      {
        code: "access",
        label: "Access mode",
        status: accessReady ? "pass" : "fail",
        detail: accessReady ? connector.access : "No access means agents cannot retrieve or act on this source.",
      },
      {
        code: "data_controls",
        label: "Sensitive data controls",
        status: sensitive && !writeScoped ? "warn" : "pass",
        detail: sensitive
          ? `${connector.dataClass} data requires masking, audit, and approval-aware runtime.`
          : "Internal data class is low-friction for pilot use.",
      },
      {
        code: "refresh",
        label: "Refresh cadence",
        status: connector.refresh === "Manual export" ? "warn" : "pass",
        detail: `${connector.refresh || "Unknown"} refresh cadence.`,
      },
      {
        code: "purpose",
        label: "Records and purpose",
        status: hasPurpose ? "pass" : "warn",
        detail: hasPurpose ? `${connector.records}; ${connector.purpose}` : "Describe which records the agent will read and why.",
      },
      {
        code: "evidence",
        label: "Knowledge evidence",
        status: connectorDocuments.length ? "pass" : "warn",
        detail: connectorDocuments.length
          ? `${connectorDocuments.length} Knowledge Base document(s) mention this source.`
          : "Upload API docs, SOPs, policy notes, or sample exports for this source.",
      },
      {
        code: "production_gate",
        label: "Pilot gate",
        status: productionReady ? "pass" : sandboxReady ? "warn" : "fail",
        detail: productionReady
          ? "Ready for controlled production pilot."
          : sandboxReady
            ? "Safe for sandbox pilot; production approval still needed."
            : "Blocked until status changes or access is granted.",
      },
    ];
    const status = tests.some((test) => test.status === "fail") ? "fail" : tests.some((test) => test.status === "warn") ? "warn" : "pass";
    const adapterMode = connectorDocuments.length
      ? "local-document-connector"
      : productionReady
        ? "configured-source"
        : "manual-readiness-model";
    return {
      name: connector.name || "Unnamed connector",
      type: connector.type || "Enterprise system",
      dataClass: connector.dataClass || "Internal",
      score,
      status,
      adapterMode,
      dryRunOnly: true,
      tests,
      evidence: connectorDocuments.map((document) => ({
        id: document.id,
        name: document.name,
        chunkCount: document.chunkCount,
        systems: document.systems || [],
      })),
      nextActions: tests
        .filter((test) => test.status !== "pass")
        .map((test) => `${test.label}: ${test.detail}`)
        .slice(0, 4),
    };
  });
  const counts = sourceChecks.reduce((acc, check) => ({ ...acc, [check.status]: (acc[check.status] || 0) + 1 }), {
    pass: 0,
    warn: 0,
    fail: 0,
  });
  const averageScore = Math.round(sourceChecks.reduce((sum, check) => sum + check.score, 0) / Math.max(1, sourceChecks.length));
  return {
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    clientName: project.clientName || "Client",
    workflowName: project.workflowName || "Workflow",
    connectorCount: sourceChecks.length,
    averageScore,
    counts,
    readyForPilot: sourceChecks.length > 0 && counts.fail === 0 && averageScore >= 70,
    dryRunOnly: true,
    sourceChecks,
    failureCatalog: uniqueServer(sourceChecks.flatMap((check) => check.tests.filter((test) => test.status !== "pass").map((test) => test.code))),
  };
}

function uniqueServer(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function splitServerSystems(systemText = "") {
  return String(systemText || "")
    .split(/,|\/| and | & /i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildServerContextGraph(project = {}, documents = []) {
  const processSteps = Array.isArray(project.processSteps) ? project.processSteps : [];
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const evalCases = Array.isArray(project.evalCases) ? project.evalCases : [];
  const governance = project.governance || {};
  const roles = uniqueServer(processSteps.map((step) => step.owner));
  const nodes = [
    { id: "client", type: "organization", name: project.clientName || "Client", detail: "Client organization and executive sponsor." },
    ...roles.map((role) => ({ id: `role:${role}`, type: "role", name: role, detail: "Owns or operates part of the workflow." })),
    ...processSteps.map((step, index) => ({ id: `step:${index}`, type: "process_step", name: step.title || `Step ${index + 1}`, detail: `${step.owner || "Owner"} in ${step.system || "system"}: ${step.pain || "No pain described."}` })),
    ...connectors.map((connector) => ({ id: `connector:${connector.name}`, type: "connector", name: connector.name, detail: `${connector.type}; ${connector.access}; ${connector.dataClass}; ${connector.status}.` })),
    ...tools.map((tool) => ({ id: `tool:${tool.name}`, type: "tool", name: tool.name, detail: `${tool.code}; ${tool.auth}; ${tool.risk} risk.` })),
    ...documents.slice(0, 30).map((document) => ({ id: `document:${document.id}`, type: "document", name: document.name, detail: `${document.chunkCount} chunks; ${(document.systems || []).join(", ")}.` })),
    ...(governance.policies || []).map((policy) => ({ id: `policy:${policy.area}`, type: "policy", name: policy.area, detail: `${policy.severity}; ${policy.status}; ${policy.rule}` })),
    ...evalCases.map((test) => ({ id: `eval:${test.id || test.name}`, type: "eval", name: test.name, detail: `${test.severity}; ${test.result || "pending"}; ${test.target || test.expected}` })),
  ];

  const edges = [
    ...processSteps.flatMap((step, index) => [
      { from: `role:${step.owner}`, to: `step:${index}`, type: "owns" },
      ...splitServerSystems(step.system).map((system) => ({ from: `step:${index}`, to: `connector:${system}`, type: "uses_system" })),
    ]),
    ...connectors.flatMap((connector) =>
      tools
        .filter((tool) => `${tool.name} ${tool.copy} ${tool.code}`.toLowerCase().includes(String(connector.name || "").toLowerCase().split(" ")[0]))
        .map((tool) => ({ from: `connector:${connector.name}`, to: `tool:${tool.name}`, type: "enables_tool" })),
    ),
    ...documents.flatMap((document) => (document.systems || []).map((system) => ({ from: `document:${document.id}`, to: `connector:${system}`, type: "documents_system" }))),
    ...(governance.policies || []).map((policy) => ({ from: `policy:${policy.area}`, to: "client", type: "constrains" })),
    ...evalCases.map((test) => ({ from: `eval:${test.id || test.name}`, to: "client", type: "validates" })),
  ].filter((edge) => edge.from && edge.to);

  const searchIndex = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    name: node.name,
    detail: node.detail,
    haystack: `${node.type} ${node.name} ${node.detail}`.toLowerCase(),
  }));

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    clientName: project.clientName || "Client",
    workflowName: project.workflowName || "Workflow",
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    lineage: [
      "case_input",
      "context_retrieval",
      connectors.length ? "connectors" : "workspace_context",
      tools.length ? "tool_fabric" : "no_tools_ready",
      evalCases.length ? "eval_gate" : "eval_plan_missing",
      governance.policies?.length ? "governance_gate" : "governance_missing",
      "human_handoff_or_action",
    ],
    searchIndex,
  };
}

function searchServerContextGraph(graph, query = "") {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return graph.searchIndex
    .map((item) => ({
      ...item,
      score: terms.reduce((sum, term) => sum + (item.haystack.includes(term) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function extractEvalKeywords(text = "") {
  return [
    ...new Set(
      String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 4 && !["should", "before", "after", "agent", "output", "expected"].includes(word)),
    ),
  ].slice(0, 24);
}

function scoreKeywordOverlap(expected = "", evidence = "") {
  const expectedTerms = extractEvalKeywords(expected);
  if (!expectedTerms.length) return 100;
  const haystack = String(evidence || "").toLowerCase();
  const matched = expectedTerms.filter((term) => haystack.includes(term));
  return Math.round((matched.length / expectedTerms.length) * 100);
}

function getLatestEvalCaseHistory(previousEvalRuns = [], evalId) {
  for (const run of previousEvalRuns) {
    const match = (run.evalCases || []).find((test) => test.id === evalId);
    if (match) return match;
  }
  return null;
}

function runServerEvalSuite(project = {}, documents = [], options = {}) {
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const evalCases = Array.isArray(project.evalCases) ? project.evalCases : [];
  const previousEvalRuns = Array.isArray(options.previousEvalRuns) ? options.previousEvalRuns : [];
  const handoffs = Array.isArray(options.handoffs) ? options.handoffs : [];
  const readiness = Number(project.readiness) || 0;
  const toolAverage = Math.round(tools.reduce((sum, tool) => sum + scoreServerTool(tool), 0) / Math.max(1, tools.length));
  const hasAudit = tools.some((tool) => `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""}`.toLowerCase().match(/audit|trace/));
  const decisionHistory = handoffs.filter((handoff) => handoff.decision || ["Approved", "Blocked", "Escalated"].includes(handoff.status)).length;

  const nextEvalCases = evalCases.map((test, index) => {
    const severity = test.severity || "Medium";
    const evalId = test.id || `eval-${index + 1}`;
    const severityPenalty = { Low: 0, Medium: 6, High: 12, Critical: 18 }[severity] ?? 6;
    const retrievalEvidence = retrieveDocumentChunks(
      documents,
      `${test.name || ""} ${test.category || ""} ${test.input || ""} ${test.expected || ""}`,
      3,
    );
    const evidenceText = retrievalEvidence.map((item) => `${item.documentName} ${item.text} ${(item.keywords || []).join(" ")}`).join(" ");
    const supportCorpus = [
      project.firstAgent,
      project.workflowName,
      project.businessProblem,
      tools.map((tool) => `${tool.name} ${tool.copy} ${tool.auth}`).join(" "),
      project.governance?.policies?.map((policy) => `${policy.area} ${policy.rule}`).join(" "),
      evidenceText,
    ].join(" ");
    const recommendationMatchScore = scoreKeywordOverlap(test.expected, supportCorpus);
    const hallucinationStatus = documents.length && retrievalEvidence.length === 0 && ["High", "Critical"].includes(severity) ? "warn" : "pass";
    const previous = getLatestEvalCaseHistory(previousEvalRuns, evalId);
    const retrievalAdjustment = documents.length ? (retrievalEvidence.length ? 6 : -8) : 0;
    const recommendationAdjustment = Math.round((recommendationMatchScore - 70) / 5);
    const hallucinationPenalty = hallucinationStatus === "warn" ? 10 : 0;
    const regressionPenalty = previous?.result === "pass" && ["warn", "fail"].includes(test.result) ? 8 : 0;
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (readiness + toolAverage) / 2 -
            severityPenalty +
            (hasAudit ? 8 : 0) +
            retrievalAdjustment +
            recommendationAdjustment -
            hallucinationPenalty -
            regressionPenalty +
            Math.min(8, decisionHistory * 2),
        ),
      ),
    );
    const evidenceNote = documents.length
      ? retrievalEvidence.length
        ? ` Retrieval found ${retrievalEvidence.length} supporting chunk${retrievalEvidence.length === 1 ? "" : "s"}.`
        : " Retrieval found no supporting chunks."
      : "";
    const checks = {
      retrieval: {
        status: documents.length ? (retrievalEvidence.length ? "pass" : "warn") : "synthetic",
        evidenceCount: retrievalEvidence.length,
      },
      recommendationMatch: {
        status: recommendationMatchScore >= 70 ? "pass" : recommendationMatchScore >= 45 ? "warn" : "fail",
        score: recommendationMatchScore,
      },
      hallucination: {
        status: hallucinationStatus,
        unsupportedClaims: hallucinationStatus === "warn" ? 1 : 0,
      },
      regression: {
        status: previous ? (previous.result === test.result ? "stable" : "changed") : "new",
        previousResult: previous?.result || null,
      },
    };
    const base = {
      ...test,
      id: evalId,
      score,
      checks,
      retrievalEvidence,
    };
    if (severity === "Critical" && !hasAudit) {
      return {
        ...base,
        result: "fail",
        actual: `Backend gate failed: critical eval requires audit or trace coverage before pilot.${evidenceNote}`,
      };
    }
    if (score >= 74) {
      return {
        ...base,
        result: "pass",
        actual: `Backend gate passed with score ${score}. Evidence, tool readiness, controls, and recommendation match are sufficient for pilot.${evidenceNote}`,
      };
    }
    if (score >= 58) {
      return {
        ...base,
        result: "warn",
        actual: `Backend gate warning with score ${score}. Safe for sandbox, but needs stronger coverage before scale-up.${evidenceNote}`,
      };
    }
    return {
      ...base,
      result: "fail",
      actual: `Backend gate failed with score ${score}. Fix context, tools, recommendation support, or controls before live traffic.${evidenceNote}`,
    };
  });

  const resultCounts = nextEvalCases.reduce(
    (counts, test) => ({ ...counts, [test.result]: (counts[test.result] || 0) + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const criticalFails = nextEvalCases.filter((test) => test.severity === "Critical" && test.result === "fail").length;
  const gateScore = Math.round((resultCounts.pass * 100 + resultCounts.warn * 70) / Math.max(1, nextEvalCases.length));
  const retrievalCovered = nextEvalCases.filter((test) => Array.isArray(test.retrievalEvidence) && test.retrievalEvidence.length).length;
  const recommendationMatch = Math.round(
    nextEvalCases.reduce((sum, test) => sum + (test.checks?.recommendationMatch?.score || 0), 0) / Math.max(1, nextEvalCases.length),
  );
  const hallucinationWarnings = nextEvalCases.filter((test) => test.checks?.hallucination?.status !== "pass").length;
  const regressions = nextEvalCases.filter((test) => test.checks?.regression?.status === "changed").length;
  return {
    evalCases: nextEvalCases,
    summary: {
      gateScore,
      passed: criticalFails === 0 && gateScore >= 80 && hallucinationWarnings === 0,
      criticalFails,
      resultCounts,
      toolAverage,
      hasAudit,
      retrievalCoverage: Math.round((retrievalCovered / Math.max(1, nextEvalCases.length)) * 100),
      recommendationMatch,
      hallucinationWarnings,
      regressions,
      decisionHistory,
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

function decorateRuntimeTrace(trace = []) {
  return trace.map((step, index) => {
    const retryable = ["Sparse context", "No tools"].includes(step.status);
    return {
      ...step,
      state: String(step.layer || `step-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `step_${index + 1}`,
      attempt: retryable ? 2 : 1,
      maxAttempts: retryable ? 2 : 1,
      retryPolicy: retryable ? "retry_once_then_fallback" : "no_retry_needed",
    };
  });
}

function buildRuntimeStateMachine(trace = [], { requiresHumanReview = false, outcome = "Recorded" } = {}) {
  const states = trace.map((step, index) => ({
    position: index + 1,
    state: step.state,
    title: step.title,
    status: step.status,
    attempt: step.attempt || 1,
    maxAttempts: step.maxAttempts || 1,
    retryPolicy: step.retryPolicy || "no_retry_needed",
    latencyMs: step.latencyMs || 0,
  }));
  const retryCount = states.reduce((sum, state) => sum + Math.max(0, Number(state.attempt || 1) - 1), 0);
  return {
    engine: "deterministic-state-machine-v1",
    status: outcome.includes("Blocked") ? "blocked" : requiresHumanReview ? "waiting_for_human" : "completed",
    finalState: requiresHumanReview ? "human_handoff_queue" : "controlled_action_ready",
    retryCount,
    states,
  };
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
  const governanceEnforcement = enforceGovernance(project, {
    input: caseInput,
    tools: callableTools,
    retrievalResults,
  });
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
  const requiresHumanReview =
    governanceEnforcement.decision !== "allow" || !governance.passed || !evalResult.summary.passed || failedCritical || confidence < 82 || highRiskTools.length > 0;
  const outcome = failedCritical
    ? "Blocked by critical eval"
    : governanceEnforcement.decision === "blocked"
      ? "Blocked by runtime governance"
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

  const trace = decorateRuntimeTrace([
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
      title: "Enforced governance",
      detail: `${governanceEnforcement.decision}; ${governanceEnforcement.redactions.length} redaction${governanceEnforcement.redactions.length === 1 ? "" : "s"}; ${governanceEnforcement.findings.length} finding${governanceEnforcement.findings.length === 1 ? "" : "s"}.`,
      status: governanceEnforcement.decision === "allow" ? "Allow" : governanceEnforcement.decision === "approval_required" ? "Approval" : "Blocked",
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
  ]);
  const runtimeStateMachine = buildRuntimeStateMachine(trace, { requiresHumanReview, outcome });

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
    governanceEnforcement,
    evalSummary: evalResult.summary,
    runtimeStateMachine,
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

function createHandoffFromRun(run) {
  if (!run?.requiresHumanReview) return null;
  const now = new Date();
  const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const priority = run.outcome?.includes("Blocked") || run.confidence < 70 ? "High" : "Medium";
  return {
    id: randomUUID(),
    runId: run.id,
    clientName: run.clientName,
    workflowName: run.workflowName,
    gate: run.approvalGate?.gate || "Human review",
    approver: run.approvalGate?.approver || "Workflow owner",
    status: "Pending",
    priority,
    reason: run.outcome,
    recommendation: run.decision?.recommendation || "Review the agent output before downstream action.",
    nextAction: run.decision?.nextAction || "human_review_queue",
    confidence: run.confidence,
    evidenceCount: run.retrievalResults?.length || 0,
    toolCount: run.callableTools?.length || 0,
    dueAt: dueAt.toISOString(),
    reviewerNotes: "",
    decision: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    audit: [
      {
        event: "handoff.created",
        detail: `Created from ${run.id} because ${run.outcome}.`,
        createdAt: now.toISOString(),
      },
    ],
  };
}

function getHandoffSla(handoff, nowMs = Date.now()) {
  const status = handoff.status || "Pending";
  const dueMs = Date.parse(handoff.dueAt || "");
  const isClosed = ["Approved", "Blocked"].includes(status);
  const dueSoonMs = 4 * 60 * 60 * 1000;

  if (status === "Blocked") {
    return { state: "blocked", label: "Blocked", severity: "Critical", minutesRemaining: 0 };
  }

  if (isClosed) {
    return { state: "closed", label: "Closed", severity: "Low", minutesRemaining: 0 };
  }

  if (!Number.isFinite(dueMs)) {
    return { state: "unknown", label: "No due date", severity: "Medium", minutesRemaining: null };
  }

  const minutesRemaining = Math.round((dueMs - nowMs) / 60000);
  if (minutesRemaining < 0) {
    return { state: "overdue", label: "Overdue", severity: "Critical", minutesRemaining };
  }

  if (status === "Escalated") {
    return { state: "escalated", label: "Escalated", severity: "High", minutesRemaining };
  }

  if (dueMs - nowMs <= dueSoonMs) {
    return { state: "due_soon", label: "Due soon", severity: "High", minutesRemaining };
  }

  return { state: "on_track", label: "On track", severity: "Low", minutesRemaining };
}

function buildHandoffAlerts(handoffs = []) {
  const now = Date.now();
  const normalized = handoffs.map((handoff) => ({
    ...handoff,
    sla: getHandoffSla(handoff, now),
  }));
  const activeStates = new Set(["overdue", "due_soon", "escalated", "blocked", "unknown"]);
  const alerts = normalized
    .filter((handoff) => activeStates.has(handoff.sla.state))
    .sort((a, b) => {
      const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (severityRank[a.sla.severity] ?? 9) - (severityRank[b.sla.severity] ?? 9) || Date.parse(a.dueAt || "") - Date.parse(b.dueAt || "");
    })
    .slice(0, 50)
    .map((handoff) => ({
      id: handoff.id,
      runId: handoff.runId,
      workflowName: handoff.workflowName,
      approver: handoff.approver,
      status: handoff.status,
      priority: handoff.priority,
      dueAt: handoff.dueAt,
      sla: handoff.sla,
      message:
        handoff.sla.state === "overdue"
          ? `${handoff.approver} missed the review SLA for ${handoff.workflowName}.`
          : handoff.sla.state === "due_soon"
            ? `${handoff.workflowName} needs review within ${Math.max(0, handoff.sla.minutesRemaining)} minutes.`
            : handoff.sla.state === "escalated"
              ? `${handoff.workflowName} is escalated and waiting for senior review.`
              : handoff.sla.state === "blocked"
                ? `${handoff.workflowName} is blocked and needs remediation.`
                : `${handoff.workflowName} has no valid due date.`,
    }));

  return {
    generatedAt: new Date(now).toISOString(),
    counts: {
      total: handoffs.length,
      pending: normalized.filter((handoff) => handoff.status === "Pending").length,
      escalated: normalized.filter((handoff) => handoff.status === "Escalated").length,
      blocked: normalized.filter((handoff) => handoff.status === "Blocked").length,
      overdue: normalized.filter((handoff) => handoff.sla.state === "overdue").length,
      dueSoon: normalized.filter((handoff) => handoff.sla.state === "due_soon").length,
      open: normalized.filter((handoff) => !["Approved", "Blocked"].includes(handoff.status)).length,
    },
    alerts,
    handoffs: normalized,
  };
}

function parseDurationMinutes(value) {
  const match = String(value || "").match(/[0-9.]+/);
  return match ? Number(match[0]) : 0;
}

function averageNumber(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function buildTelemetryReport(db = {}) {
  const runs = Array.isArray(db.runs) ? db.runs : [];
  const payloads = runs.map((run) => run.payload || run);
  const latencies = payloads.map((run) => run.latencyMs);
  const costs = payloads.map((run) => run.estimatedCostUsd);
  const confidences = runs.map((run) => run.confidence);
  const humanReviewCount = payloads.filter((run) => run.requiresHumanReview).length;
  const totalCost = costs.map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  const outcomes = runs.reduce((acc, run) => {
    const key = run.outcome || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const project = db.workspace?.project || {};
  const model = project.valueModel || {};
  const beforeMinutes = Number(model.beforeMinutes || parseDurationMinutes(project.beforeTime) || 0);
  const afterMinutes = Number(model.afterMinutes || parseDurationMinutes(project.afterTime) || 0);
  const casesPerMonth = Number(model.casesPerMonth || 0);
  const loadedCostPerHour = Number(model.loadedCostPerHour || 0);
  const adoptionPercent = Number(model.adoptionPercent || 0);
  const minutesSaved = Math.max(0, beforeMinutes - afterMinutes);
  const possibleMonthlyHours = (casesPerMonth * minutesSaved) / 60;
  const adoptedMonthlyHours = possibleMonthlyHours * (adoptionPercent / 100);
  const annualLaborSavings = adoptedMonthlyHours * loadedCostPerHour * 12;

  return {
    generatedAt: new Date().toISOString(),
    runCount: runs.length,
    lastRunAt: runs[0]?.createdAt || null,
    avgConfidence: averageNumber(confidences),
    avgLatencyMs: averageNumber(latencies),
    totalEstimatedCostUsd: Number(totalCost.toFixed(4)),
    humanReviewRate: runs.length ? Math.round((humanReviewCount / runs.length) * 100) : 0,
    outcomes,
    value: {
      casesPerMonth,
      minutesSaved,
      possibleMonthlyHours: Math.round(possibleMonthlyHours),
      adoptedMonthlyHours: Math.round(adoptedMonthlyHours),
      annualLaborSavings: Math.round(annualLaborSavings),
    },
  };
}

function updateHandoffRecord(handoff, patch = {}) {
  const now = new Date().toISOString();
  const nextStatus = patch.status || handoff.status;
  const nextDecision = patch.decision || (["Approved", "Blocked"].includes(nextStatus) ? nextStatus.toLowerCase() : handoff.decision);
  return {
    ...handoff,
    status: nextStatus,
    priority: patch.priority || handoff.priority,
    reviewerNotes: patch.reviewerNotes ?? handoff.reviewerNotes,
    decision: nextDecision,
    updatedAt: now,
    audit: [
      ...(Array.isArray(handoff.audit) ? handoff.audit : []),
      {
        event: "handoff.updated",
        detail: `Status changed to ${nextStatus}${patch.reviewerNotes ? `: ${patch.reviewerNotes}` : ""}.`,
        createdAt: now,
      },
    ],
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

function maskSensitiveText(text = "") {
  const input = String(text || "");
  const redactions = [];
  const patterns = [
    { type: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, token: "[EMAIL]" },
    { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g, token: "[SSN]" },
    { type: "card", regex: /\b(?:\d[ -]*?){13,16}\b/g, token: "[CARD]" },
    { type: "account", regex: /\b(?:acct|account|customer|case)[\s:#-]*[A-Z0-9]{6,}\b/gi, token: "[ID]" },
    { type: "phone", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, token: "[PHONE]" },
  ];
  let masked = input;
  patterns.forEach((pattern) => {
    masked = masked.replace(pattern.regex, (match) => {
      redactions.push({ type: pattern.type, chars: match.length });
      return pattern.token;
    });
  });
  return { originalLength: input.length, masked, redactions };
}

function getSecretRefForTool(tool = {}) {
  return `PRAXIS_SECRET_${toToolIdentifier(tool.name || tool.code || "tool").toUpperCase()}`;
}

function enforceGovernance(project = {}, payload = {}) {
  const governanceCheck = runGovernanceChecks(project);
  const inputMask = maskSensitiveText(payload.input || "");
  const tools = Array.isArray(payload.tools) ? payload.tools : Array.isArray(project.tools) ? project.tools : [];
  const connectors = Array.isArray(project.connectors) ? project.connectors : [];
  const approvals = Array.isArray(project.governance?.approvals) ? project.governance.approvals : [];
  const policies = Array.isArray(project.governance?.policies) ? project.governance.policies : [];
  const auditEvents = Array.isArray(project.governance?.auditEvents) ? project.governance.auditEvents : [];
  const findings = [...governanceCheck.findings];

  const policyDecisions = policies.map((policy) => {
    const needsApproval = ["High", "Critical"].includes(policy.severity) && !["Approved", "Required"].includes(policy.status);
    const blocked = policy.status === "Blocked";
    return {
      area: policy.area,
      owner: policy.owner,
      severity: policy.severity,
      status: policy.status,
      decision: blocked ? "block" : needsApproval ? "approval_required" : "allow",
      rule: policy.rule,
    };
  });

  connectors.forEach((connector) => {
    if (["PII", "Regulated", "Financial"].includes(connector.dataClass) && inputMask.redactions.length === 0) {
      findings.push({
        severity: "Medium",
        area: "Data masking",
        title: `${connector.name} may expose ${connector.dataClass} data`,
        detail: "Runtime enforcement did not find obvious PII in the input, but this connector class requires masking and audit review.",
      });
    }
  });

  const toolDecisions = tools.map((tool) => {
    const secretRef = getSecretRefForTool(tool);
    const secretConfigured = Boolean(process.env[secretRef]);
    const highRisk = tool.risk === "High";
    const approvalScoped = String(tool.auth || "").toLowerCase().includes("approval") || String(tool.auth || "").toLowerCase().includes("human");
    const decision = highRisk && !approvalScoped ? "block" : highRisk ? "approval_required" : "allow";
    if (decision === "block") {
      findings.push({
        severity: "High",
        area: "Runtime tool policy",
        title: `${tool.name} blocked at runtime`,
        detail: "High-risk tool cannot be called without approval-scoped auth.",
      });
    }
    return {
      name: tool.name,
      callable: tool.code,
      risk: tool.risk || "Medium",
      auth: tool.auth || "Unknown",
      decision,
      secretRef,
      secretConfigured,
    };
  });

  const pendingApprovals = approvals
    .filter((approval) => approval.status !== "Approved")
    .map((approval) => ({
      gate: approval.gate,
      approver: approval.approver,
      status: approval.status,
      due: approval.due,
      notes: approval.notes,
    }));

  const highFindings = findings.filter((finding) => finding.severity === "High" || finding.severity === "Critical");
  const blockedByPolicy = policyDecisions.some((policy) => policy.decision === "block") || toolDecisions.some((tool) => tool.decision === "block");
  const decision = blockedByPolicy || highFindings.length ? "blocked" : pendingApprovals.length || inputMask.redactions.length ? "approval_required" : "allow";

  return {
    id: randomUUID(),
    checkedAt: new Date().toISOString(),
    decision,
    maskedInput: inputMask.masked,
    redactions: inputMask.redactions,
    findings,
    policyDecisions,
    toolDecisions,
    pendingApprovals,
    secretsManifest: toolDecisions.map((tool) => ({
      tool: tool.name,
      secretRef: tool.secretRef,
      configured: tool.secretConfigured,
      requiredFor: tool.auth,
    })),
    auditRequired: auditEvents.length < 5 ? ["audit_coverage_incomplete"] : [],
    summary:
      decision === "allow"
        ? "Runtime governance allows sandbox execution."
        : decision === "approval_required"
          ? "Runtime governance allows sandbox execution only with human approval."
          : "Runtime governance blocks execution until policy findings are fixed.",
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

  if (req.method === "GET" && url.pathname === "/api/database/status") {
    sendJson(res, 200, { ok: true, database: await buildDatabaseStatus(db) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/database/backup") {
    const body = await readJsonBody(req);
    const backup = await createDbBackup(body.reason || "manual");
    const nextDb = appendAudit(db, "database.backup.created", {
      backup: backup.name,
      sizeBytes: backup.sizeBytes,
      reason: body.reason || "manual",
    });
    const saved = await writeDb(nextDb);
    sendJson(res, 201, {
      ok: true,
      backup,
      database: await buildDatabaseStatus(saved),
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

  if (req.method === "GET" && url.pathname === "/api/evals/history") {
    sendJson(res, 200, { ok: true, evalRuns: Array.isArray(db.evalRuns) ? db.evalRuns : [] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/telemetry") {
    sendJson(res, 200, { ok: true, telemetry: buildTelemetryReport(db) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/handoffs") {
    sendJson(res, 200, { ok: true, handoffs: Array.isArray(db.handoffs) ? db.handoffs : [] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/handoffs/alerts") {
    const report = buildHandoffAlerts(Array.isArray(db.handoffs) ? db.handoffs : []);
    sendJson(res, 200, { ok: true, ...report });
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/handoffs/")) {
    const handoffId = decodeURIComponent(url.pathname.replace("/api/handoffs/", ""));
    const body = await readJsonBody(req);
    const currentHandoffs = Array.isArray(db.handoffs) ? db.handoffs : [];
    const handoff = currentHandoffs.find((item) => item.id === handoffId);
    if (!handoff) {
      sendJson(res, 404, { ok: false, error: "Handoff not found" });
      return;
    }
    const updated = updateHandoffRecord(handoff, {
      status: body.status,
      decision: body.decision,
      priority: body.priority,
      reviewerNotes: body.reviewerNotes,
    });
    const nextDb = appendAudit(
      {
        ...db,
        handoffs: currentHandoffs.map((item) => (item.id === handoffId ? updated : item)),
      },
      "handoff.updated",
      { handoffId, runId: updated.runId, status: updated.status, decision: updated.decision },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, handoff: updated, handoffs: saved.handoffs, handoffAlerts: buildHandoffAlerts(saved.handoffs) });
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

  if (req.method === "POST" && url.pathname === "/api/context/graph") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const graph = buildServerContextGraph(project, Array.isArray(db.documents) ? db.documents : []);
    const nextDb = appendAudit(
      {
        ...db,
        contextGraphs: [graph, ...(Array.isArray(db.contextGraphs) ? db.contextGraphs : [])].slice(0, 50),
      },
      "context.graph.snapshot",
      { graphId: graph.id, workflowName: graph.workflowName, nodes: graph.nodeCount, edges: graph.edgeCount },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, graph, graphHistory: saved.contextGraphs.slice(0, 10) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/context/search") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const graph = buildServerContextGraph(project, Array.isArray(db.documents) ? db.documents : []);
    const results = searchServerContextGraph(graph, body.query || "");
    const nextDb = appendAudit(db, "context.graph.search", {
      query: body.query || "",
      resultCount: results.length,
      workflowName: graph.workflowName,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, query: body.query || "", results, graphSummary: { nodes: graph.nodeCount, edges: graph.edgeCount, lineage: graph.lineage } });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/connectors/test") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const report = buildConnectorTestReport(project, Array.isArray(db.documents) ? db.documents : []);
    const nextDb = appendAudit(
      {
        ...db,
        connectorTests: [report, ...(Array.isArray(db.connectorTests) ? db.connectorTests : [])].slice(0, 100),
      },
      "connectors.tested",
      {
        reportId: report.id,
        workflowName: report.workflowName,
        averageScore: report.averageScore,
        pass: report.counts.pass,
        warn: report.counts.warn,
        fail: report.counts.fail,
        readyForPilot: report.readyForPilot,
      },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, connectorTest: report, connectorTestHistory: saved.connectorTests.slice(0, 10) });
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
    const handoff = createHandoffFromRun(run);
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
        handoffs: handoff ? [handoff, ...(Array.isArray(db.handoffs) ? db.handoffs : [])].slice(0, 500) : db.handoffs,
      },
      "agent.run",
      {
        runId: run.id,
        workflowName: run.workflowName,
        outcome: run.outcome,
        confidence: run.confidence,
        requiresHumanReview: run.requiresHumanReview,
        handoffId: handoff?.id,
      },
    );
    const saved = await writeDb(nextDb);
    sendJson(res, 201, {
      ok: true,
      run,
      handoff,
      handoffAlerts: buildHandoffAlerts(Array.isArray(saved.handoffs) ? saved.handoffs : []),
      telemetry: buildTelemetryReport(saved),
      totalRuns: saved.runs.length,
      totalHandoffs: saved.handoffs.length,
    });
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
    sendJson(res, 201, { ok: true, run, telemetry: buildTelemetryReport(saved), totalRuns: saved.runs.length });
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
      schemaValid: result.analysis.schemaValid,
      repairApplied: result.analysis.repairApplied,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/evals/run") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const result = runServerEvalSuite(project, Array.isArray(db.documents) ? db.documents : [], {
      previousEvalRuns: Array.isArray(db.evalRuns) ? db.evalRuns : [],
      handoffs: Array.isArray(db.handoffs) ? db.handoffs : [],
      runs: Array.isArray(db.runs) ? db.runs : [],
    });
    const evalRun = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      clientName: project.clientName || db.workspace?.project?.clientName || "Unknown client",
      workflowName: project.workflowName || db.workspace?.project?.workflowName || "Unknown workflow",
      summary: result.summary,
      evalCases: result.evalCases,
    };
    const nextDb = appendAudit({
      ...db,
      evalRuns: [evalRun, ...(Array.isArray(db.evalRuns) ? db.evalRuns : [])].slice(0, 100),
    }, "evals.run", {
      workflowName: body.project?.workflowName || db.workspace?.project?.workflowName,
      gateScore: result.summary.gateScore,
      passed: result.summary.passed,
      retrievalCoverage: result.summary.retrievalCoverage,
      recommendationMatch: result.summary.recommendationMatch,
      hallucinationWarnings: result.summary.hallucinationWarnings,
    });
    const saved = await writeDb(nextDb);
    sendJson(res, 200, { ok: true, ...result, evalRun, evalHistory: saved.evalRuns.slice(0, 20) });
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

  if (req.method === "POST" && url.pathname === "/api/tools/sandbox") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const report = buildToolSandboxReport(project);
    const nextDb = appendAudit(db, "tools.sandboxed", {
      workflowName: project.workflowName,
      toolCount: report.toolCount,
      pass: report.counts.pass,
      warn: report.counts.warn,
      fail: report.counts.fail,
      readyForAgentRuntime: report.readyForAgentRuntime,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, sandbox: report });
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

  if (req.method === "POST" && url.pathname === "/api/governance/enforce") {
    const body = await readJsonBody(req);
    const project = body.project || db.workspace?.project || {};
    const enforcement = enforceGovernance(project, {
      input: body.input || "",
      tools: Array.isArray(body.tools) ? body.tools : project.tools,
      retrievalResults: body.retrievalResults || [],
    });
    const nextDb = appendAudit(db, "governance.enforced", {
      enforcementId: enforcement.id,
      workflowName: project.workflowName,
      decision: enforcement.decision,
      redactions: enforcement.redactions.length,
      findings: enforcement.findings.length,
    });
    await writeDb(nextDb);
    sendJson(res, 200, { ok: true, enforcement });
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
