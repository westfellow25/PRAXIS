# PRAXIS Local Database Schema

The first backend uses a local JSON database at `data/praxis-db.json`.

This is intentionally simple: it lets us validate the product data model before moving to Postgres.

The Postgres-ready draft is in `schema.sql`.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "workspace": {},
  "playbooks": [],
  "runs": [],
  "handoffs": [],
  "documents": [],
  "auditLog": []
}
```

## workspace

```json
{
  "project": {
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing",
    "processSteps": [],
    "connectors": [],
    "tools": [],
    "governance": {},
    "evalCases": [],
    "deployment": {},
    "valueModel": {}
  },
  "selectedOpportunity": "aml",
  "evalsRun": false,
  "savedAt": "ISO timestamp"
}
```

## playbooks

Each playbook stores a reusable deployment pattern and an optional `projectSnapshot`.

```json
{
  "id": "custom-...",
  "name": "AML Alert Briefing",
  "industry": "Banking",
  "clientName": "Northstar Bank",
  "copy": "Short description",
  "modules": ["Context", "Tools", "Evals"],
  "metrics": {
    "readiness": 68,
    "tools": 6,
    "evals": 4,
    "timeline": 4
  },
  "source": "Saved workspace",
  "createdAt": "ISO timestamp",
  "projectSnapshot": {}
}
```

## runs

Runs are saved from Pilot Console.

```json
{
  "id": "uuid",
  "createdAt": "ISO timestamp",
  "clientName": "Northstar Bank",
  "workflowName": "AML Alert Briefing",
  "outcome": "Ready for sandbox, not production",
  "confidence": 72,
  "trace": [
    {
      "layer": "L1",
      "title": "Retrieve source context",
      "detail": "KYC and policy records returned",
      "status": "Ready"
    }
  ],
  "payload": {}
}
```

## agent runtime response

`POST /api/agent/run` executes the first deterministic backend Agent Runtime. It retrieves document evidence, selects callable tools, checks evals and governance, decides whether human review is required, estimates latency/cost, stores the run, and returns the full trace.

```json
{
  "ok": true,
  "run": {
    "id": "PX-AML-1234abcd",
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing",
    "outcome": "Human review required",
    "confidence": 82,
    "latencyMs": 1140,
    "estimatedCostUsd": 0.086,
    "requiresHumanReview": true,
    "retrievalResults": [],
    "callableTools": [],
    "decision": {
      "recommendation": "Prepare AML Alert Briefing and route it to Compliance Lead before action.",
      "nextAction": "human_review_queue",
      "reason": "Human review required"
    },
    "trace": []
  },
  "totalRuns": 12
}
```

## handoffs

Handoffs are created by `POST /api/agent/run` whenever the runtime decides a human must review the output. They can be read with `GET /api/handoffs` and updated with `PATCH /api/handoffs/:id`.

```json
{
  "id": "uuid",
  "runId": "PX-AMLA-1234abcd",
  "clientName": "Northstar Bank",
  "workflowName": "AML Alert Briefing",
  "gate": "Production pilot go-live",
  "approver": "Compliance Lead",
  "status": "Pending",
  "priority": "Medium",
  "reason": "Human review required",
  "recommendation": "Prepare AML briefing and route it to Compliance Lead before action.",
  "nextAction": "human_review_queue",
  "confidence": 90,
  "evidenceCount": 3,
  "toolCount": 4,
  "dueAt": "ISO timestamp",
  "reviewerNotes": "",
  "decision": null,
  "audit": [
    {
      "event": "handoff.created",
      "detail": "Created from PX-AMLA-1234abcd because Human review required.",
      "createdAt": "ISO timestamp"
    }
  ],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

## documents

Documents are ingested from the Knowledge Base screen through `POST /api/documents`.

```json
{
  "id": "uuid",
  "name": "aml-policy.md",
  "sourceType": "file",
  "templateKey": "banking",
  "summary": "Short deterministic summary",
  "systems": ["ServiceNow", "KYC database"],
  "keywords": ["policy", "approval", "transaction"],
  "signals": {
    "hasRiskLanguage": true,
    "hasApiLanguage": false,
    "hasMetricLanguage": true,
    "hasPiiLanguage": true
  },
  "sizeBytes": 12000,
  "wordCount": 1800,
  "chunkCount": 14,
  "chunks": [
    {
      "id": "chunk-001",
      "text": "Chunk text used later for retrieval",
      "characters": 900,
      "keywords": ["policy", "audit"]
    }
  ],
  "createdAt": "ISO timestamp"
}
```

## retrieval query response

`POST /api/retrieval/query` searches document chunks and returns evidence that the Pilot Console can cite during a simulated agent run.

```json
{
  "ok": true,
  "query": "AML alert KYC sanctions policy",
  "totalDocuments": 3,
  "results": [
    {
      "documentId": "uuid",
      "documentName": "aml-policy.md",
      "chunkId": "chunk-001",
      "score": 8,
      "text": "Relevant policy chunk",
      "keywords": ["aml", "sanctions", "approval"],
      "citation": "aml-policy.md#chunk-001"
    }
  ]
}
```

## OpenAPI import response

`POST /api/openapi/import` converts OpenAPI paths into Tool Fabric rows.

```json
{
  "ok": true,
  "title": "Compliance API",
  "tools": [
    {
      "name": "Get customer",
      "code": "getCustomer(id)",
      "copy": "GET /customers/{id} from imported OpenAPI spec.",
      "owner": "Compliance API",
      "auth": "Read-only service",
      "risk": "Medium",
      "importedFrom": "OpenAPI",
      "method": "GET",
      "path": "/customers/{id}"
    }
  ]
}
```

## MCP generation response

`POST /api/mcp/generate` converts the active Tool Fabric into a starter MCP server file. The generated file is a scaffold: every tool stub still needs to be wired to the real enterprise API.

```json
{
  "ok": true,
  "toolCount": 6,
  "code": "import { McpServer } from \"@modelcontextprotocol/sdk/server/mcp.js\";..."
}
```

## governance check response

`POST /api/governance/check` runs a pre-flight policy check over the active project before a pilot is treated as production-ready.

```json
{
  "ok": true,
  "score": 74,
  "passed": false,
  "checkedAt": "ISO timestamp",
  "findings": [
    {
      "severity": "High",
      "area": "Connector access",
      "title": "Transaction warehouse is not accessible",
      "detail": "Production or pilot runs should not depend on blocked data sources."
    }
  ]
}
```

## auditLog

Server-side audit events for workspace saves, playbook saves, document ingestion, eval runs, and run records.

```json
{
  "id": "uuid",
  "event": "workspace.saved",
  "detail": {
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing"
  },
  "createdAt": "ISO timestamp"
}
```

## intake workspace response

`POST /api/intake/workspace` does not write a full workspace by itself. It returns a patch that the frontend applies over the matching playbook template.

```json
{
  "ok": true,
  "templateKey": "banking",
  "analysis": {
    "industry": "Banking",
    "workflowName": "AML Alert Briefing",
    "confidence": 0.78,
    "extractedSystems": ["ServiceNow", "KYC database", "transaction warehouse"],
    "extractedTimes": {
      "beforeTime": "45m",
      "afterTime": "10m"
    },
    "extractedHumanReview": "20%",
    "mode": "deterministic-extractor"
  },
  "projectPatch": {
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing",
    "beforeTime": "45m",
    "afterTime": "10m",
    "connectors": []
  }
}
```

## Future Postgres tables

When we graduate from JSON to Postgres, this maps cleanly into:

- `organizations`
- `users`
- `workspaces`
- `projects`
- `process_steps`
- `connectors`
- `tools`
- `governance_policies`
- `approval_gates`
- `handoffs`
- `eval_cases`
- `pilot_runs`
- `run_trace_events`
- `playbooks`
- `audit_events`
