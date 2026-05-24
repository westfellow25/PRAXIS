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
  const isInsurance = ["claim", "insurance", "adjuster", "damage"].some((word) => normalized.includes(word));
  const isLegal = ["contract", "legal", "counsel", "clause"].some((word) => normalized.includes(word));
  const isSupport = ["support", "ticket", "customer", "sla"].some((word) => normalized.includes(word));
  const industry = isInsurance ? "Insurance" : isLegal ? "Legal" : isSupport ? "SaaS" : "Banking";
  const workflowName = isInsurance
    ? "Claims Triage"
    : isLegal
      ? "Contract Review"
      : isSupport
        ? "Support Reply Drafting"
        : "AML Alert Briefing";

  return {
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
