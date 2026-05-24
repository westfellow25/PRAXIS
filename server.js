import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.cwd();
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

function runServerEvalSuite(project = {}) {
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const evalCases = Array.isArray(project.evalCases) ? project.evalCases : [];
  const readiness = Number(project.readiness) || 0;
  const toolAverage = Math.round(tools.reduce((sum, tool) => sum + scoreServerTool(tool), 0) / Math.max(1, tools.length));
  const hasAudit = tools.some((tool) => `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""}`.toLowerCase().match(/audit|trace/));

  const nextEvalCases = evalCases.map((test, index) => {
    const severity = test.severity || "Medium";
    const severityPenalty = { Low: 0, Medium: 6, High: 12, Critical: 18 }[severity] ?? 6;
    const score = Math.max(0, Math.min(100, Math.round((readiness + toolAverage) / 2 - severityPenalty + (hasAudit ? 8 : 0))));
    if (severity === "Critical" && !hasAudit) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "fail",
        actual: "Backend gate failed: critical eval requires audit or trace coverage before pilot.",
      };
    }
    if (score >= 74) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "pass",
        actual: `Backend gate passed with score ${score}. Evidence, tool readiness, and controls are sufficient for pilot.`,
      };
    }
    if (score >= 58) {
      return {
        ...test,
        id: test.id || `eval-${index + 1}`,
        result: "warn",
        actual: `Backend gate warning with score ${score}. Safe for sandbox, but needs stronger coverage before scale-up.`,
      };
    }
    return {
      ...test,
      id: test.id || `eval-${index + 1}`,
      result: "fail",
      actual: `Backend gate failed with score ${score}. Fix context, tools, or controls before live traffic.`,
    };
  });

  const resultCounts = nextEvalCases.reduce(
    (counts, test) => ({ ...counts, [test.result]: (counts[test.result] || 0) + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const criticalFails = nextEvalCases.filter((test) => test.severity === "Critical" && test.result === "fail").length;
  const gateScore = Math.round((resultCounts.pass * 100 + resultCounts.warn * 70) / Math.max(1, nextEvalCases.length));
  return {
    evalCases: nextEvalCases,
    summary: {
      gateScore,
      passed: criticalFails === 0 && gateScore >= 80,
      criticalFails,
      resultCounts,
      toolAverage,
      hasAudit,
      evaluatedAt: new Date().toISOString(),
    },
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
    const result = buildWorkspacePatchFromIntake(body.text || "");
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
    const result = runServerEvalSuite(body.project || db.workspace?.project || {});
    const nextDb = appendAudit(db, "evals.run", {
      workflowName: body.project?.workflowName || db.workspace?.project?.workflowName,
      gateScore: result.summary.gateScore,
      passed: result.summary.passed,
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
