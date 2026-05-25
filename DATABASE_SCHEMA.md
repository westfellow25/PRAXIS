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
  "evalRuns": [],
  "contextGraphs": [],
  "connectorTests": [],
  "handoffs": [],
  "documents": [],
  "auditLog": [],
  "migrations": []
}
```

## database status response

`GET /api/database/status` reports the local persistence layer health: schema version, file size, collection counts, migration metadata, and the latest JSON backups.

```json
{
  "ok": true,
  "database": {
    "ok": true,
    "schemaVersion": 2,
    "latestSchemaVersion": 2,
    "databasePath": "data/praxis-db.json",
    "file": {
      "exists": true,
      "sizeBytes": 123456,
      "modifiedAt": "ISO timestamp"
    },
    "collections": {
      "playbooks": 2,
      "runs": 12,
      "evalRuns": 5,
      "contextGraphs": 3,
      "connectorTests": 4,
      "handoffs": 4,
      "documents": 3,
      "auditEvents": 42
    },
    "migrations": [],
    "backups": [],
    "backupCount": 0,
    "checks": [
      {
        "name": "schema_version",
        "passed": true
      }
    ]
  }
}
```

## database backup response

`POST /api/database/backup` writes a timestamped copy of `data/praxis-db.json` into `data/backups/` and appends a `database.backup.created` audit event.

```json
{
  "ok": true,
  "backup": {
    "name": "2026-05-25T10-12-00-000Z-manual-ui.json",
    "path": "data/backups/2026-05-25T10-12-00-000Z-manual-ui.json",
    "sizeBytes": 123456,
    "createdAt": "ISO timestamp"
  },
  "database": {}
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
    "runtimeStateMachine": {
      "engine": "deterministic-state-machine-v1",
      "status": "waiting_for_human",
      "finalState": "human_handoff_queue",
      "retryCount": 1,
      "states": []
    },
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

## eval run response

`POST /api/evals/run` runs the backend regression gate and stores an immutable eval run in `evalRuns`. The runner checks tool readiness, retrieval coverage, recommendation-match support, hallucination risk, and regression drift from the previous run.

```json
{
  "ok": true,
  "evalRun": {
    "id": "uuid",
    "createdAt": "ISO timestamp",
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing",
    "summary": {
      "gateScore": 84,
      "passed": true,
      "retrievalCoverage": 80,
      "recommendationMatch": 76,
      "hallucinationWarnings": 0,
      "regressions": 0
    },
    "evalCases": []
  },
  "evalHistory": []
}
```

`GET /api/evals/history` returns the latest saved eval runs for the Regression History panel.

## handoffs

Handoffs are created by `POST /api/agent/run` whenever the runtime decides a human must review the output. They can be read with `GET /api/handoffs`, summarized with `GET /api/handoffs/alerts`, and updated with `PATCH /api/handoffs/:id`.

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

`GET /api/handoffs/alerts` computes SLA state instead of storing it permanently. The response includes `counts.open`, `counts.overdue`, `counts.dueSoon`, `counts.escalated`, `alerts[]`, and normalized handoffs with an `sla` object.

## telemetry

`GET /api/telemetry` derives operational value telemetry from saved runs and the current workspace value model.

```json
{
  "runCount": 12,
  "lastRunAt": "ISO timestamp",
  "avgConfidence": 87,
  "avgLatencyMs": 42,
  "totalEstimatedCostUsd": 1.24,
  "humanReviewRate": 67,
  "outcomes": {
    "Human review required": 8
  },
  "value": {
    "casesPerMonth": 18000,
    "minutesSaved": 36,
    "possibleMonthlyHours": 10800,
    "adoptedMonthlyHours": 8100,
    "annualLaborSavings": 7776000
  }
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

## context graph response

`POST /api/context/graph` persists a backend graph snapshot with nodes, edges, lineage, and a search index. `POST /api/context/search` searches the current graph across people, process steps, connectors, tools, documents, policies, and evals.

```json
{
  "ok": true,
  "graph": {
    "id": "uuid",
    "clientName": "Northstar Bank",
    "workflowName": "AML Alert Briefing",
    "nodeCount": 32,
    "edgeCount": 41,
    "nodes": [],
    "edges": [],
    "lineage": ["case_input", "context_retrieval", "connectors", "tool_fabric", "eval_gate", "governance_gate", "human_handoff_or_action"]
  },
  "graphHistory": []
}
```

## connector test response

`POST /api/connectors/test` runs a dry-run readiness harness across mapped source systems and stores the report in `connectorTests`. It does not call external SaaS APIs yet; it validates whether each source has enough access, ownership, data-control, refresh, purpose, and Knowledge Base evidence to be trusted by an agent pilot.

```json
{
  "ok": true,
  "connectorTest": {
    "id": "uuid",
    "workflowName": "AML Alert Briefing",
    "connectorCount": 5,
    "averageScore": 82,
    "readyForPilot": true,
    "dryRunOnly": true,
    "counts": {
      "pass": 2,
      "warn": 3,
      "fail": 0
    },
    "sourceChecks": [
      {
        "name": "KYC database",
        "status": "warn",
        "adapterMode": "local-document-connector",
        "tests": [],
        "evidence": []
      }
    ]
  },
  "connectorTestHistory": []
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

## tool sandbox response

`POST /api/tools/sandbox` performs a dry-run validation of Tool Fabric before the Agent Runtime can rely on those tools. It does not call external customer APIs yet. It checks callable contracts, owners, auth model, high-risk approval gates, readiness threshold, and failure-mode documentation.

```json
{
  "ok": true,
  "sandbox": {
    "toolCount": 3,
    "readyForAgentRuntime": false,
    "counts": {
      "pass": 1,
      "warn": 1,
      "fail": 1
    },
    "results": [
      {
        "name": "Get customer KYC",
        "callable": "getCustomerKYC(customer_id)",
        "status": "pass",
        "readiness": 95,
        "latencyMs": 30,
        "failureModes": [],
        "sampleRequest": {
          "dryRun": true,
          "sandboxOnly": true
        },
        "sampleResponse": {
          "ok": true,
          "sandboxOnly": true
        }
      }
    ],
    "failureCatalog": ["approval_required", "missing_callable_contract"]
  }
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

## governance enforcement response

`POST /api/governance/enforce` runs the runtime policy gate immediately before an agent uses tools or produces a pilot output. It masks sensitive input, converts governance policies into decisions, checks high-risk tool approval scopes, creates a secrets manifest, and returns an allow/approval/block decision.

```json
{
  "ok": true,
  "enforcement": {
    "id": "uuid",
    "checkedAt": "ISO timestamp",
    "decision": "approval_required",
    "maskedInput": "Customer [EMAIL] account [ID] paid with [CARD].",
    "redactions": [
      {
        "type": "email",
        "chars": 16
      }
    ],
    "findings": [],
    "policyDecisions": [
      {
        "area": "PII masking",
        "owner": "Compliance",
        "severity": "High",
        "status": "Required",
        "decision": "allow"
      }
    ],
    "toolDecisions": [
      {
        "name": "Create SAR report",
        "risk": "High",
        "auth": "Service account + approval",
        "decision": "approval_required",
        "secretRef": "PRAXIS_SECRET_CREATE_SAR_REPORT",
        "secretConfigured": false
      }
    ],
    "pendingApprovals": [],
    "secretsManifest": [],
    "auditRequired": [],
    "summary": "Runtime governance allows sandbox execution only with human approval."
  }
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
      "schemaValid": true,
      "schemaErrors": [],
      "repairApplied": false,
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
- `connector_test_runs`
- `tools`
- `tool_sandbox_runs`
- `governance_policies`
- `approval_gates`
- `handoffs`
- `eval_cases`
- `pilot_runs`
- `run_trace_events`
- `playbooks`
- `audit_events`
