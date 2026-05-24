# PRAXIS Local Database Schema

The first backend uses a local JSON database at `data/praxis-db.json`.

This is intentionally simple: it lets us validate the product data model before moving to Postgres.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "workspace": {},
  "playbooks": [],
  "runs": [],
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

## auditLog

Server-side audit events for workspace saves, playbook saves, and run records.

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
- `eval_cases`
- `pilot_runs`
- `run_trace_events`
- `playbooks`
- `audit_events`
