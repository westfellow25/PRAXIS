# PRAXIS MVP

PRAXIS is a local prototype for an FDE Operating System.

It demonstrates the first product wedge:

1. Paste a messy client process into AI Intake.
2. Generate a structured deployment workspace.
3. Build a context graph of people, systems, tools, and controls.
4. Map client systems into data connectors with access, PII, owners, and readiness.
5. Convert APIs into an agent-ready Tool Fabric.
6. Define governance, approvals, and audit policy.
7. Map the enterprise workflow.
8. Score AI deployment opportunities.
9. Model ROI, hours saved, adoption, payback, and platform cost.
10. Build a human-in-the-loop agent workflow.
11. Watch a pilot case move through connectors, tools, agent runtime, evals, approvals, and audit.
12. Run an eval suite.
13. Build a 30-day deployment plan.
14. Generate an executive readout.
15. Save the pattern as a reusable playbook.

## How to open

For the full local app with backend persistence:

```powershell
npm start
```

Then open:

```text
http://localhost:4173
```

You can still open `index.html` directly in a browser. In that mode PRAXIS falls back to browser `localStorage` and cannot save Pilot Console runs to the backend.

No package install is required for this version. The server uses only built-in Node.js modules.

## Local backend

The backend lives in `server.js` and exposes:

- `GET /api/health`
- `GET /api/workspace`
- `PUT /api/workspace`
- `GET /api/playbooks`
- `PUT /api/playbooks`
- `GET /api/runs`
- `POST /api/runs`
- `POST /api/intake`
- `POST /api/intake/workspace`
- `POST /api/evals/run`

The local database is `data/praxis-db.json`.

See `DATABASE_SCHEMA.md` for the current schema.

`POST /api/intake/workspace` is the first backend intake engine. It takes messy client notes and returns a structured workspace patch: best template, KPI timings, human-review target, source systems, connector patches, success metric, and first-agent summary. Today it uses a deterministic extractor shaped around the future LLM contract.

## What works in this version

- Edit the client brief and KPI metrics.
- Generate a workspace from a raw process description through the backend intake engine, with browser fallback.
- Use four demo intake presets: banking AML, insurance claims, legal review, and SaaS support.
- View a generated Context Graph with people, systems, agent tools, controls, and readiness blockers.
- Manage connector readiness across source systems, data classes, access modes, refresh cadence, and blockers.
- View an ingestion plan that explains how PRAXIS connects, masks, indexes, and proves client data.
- Score API/tool readiness and edit owner, auth model, risk, callable signatures, and descriptions.
- Generate an MCP-style tool manifest preview.
- Manage governance policies, approval gates, audit trail requirements, and governance readiness.
- Use the Pilot Run Console to inspect a full case trace, evidence packet, decision boundary, approval route, and audit payload.
- Calculate annual net value, monthly hours saved, payback, and conservative/base/upside scenarios.
- Edit eval cases with input, expected output, category, severity, and last actual result.
- Run a deterministic eval gate that reports pass, warning, failure, critical blockers, and pilot readiness.
- Manage a deployment timeline, rollout checklist, blockers, owners, statuses, and exit criteria.
- Save the current workspace as a reusable playbook.
- Search playbooks and clone a template back into the active workspace.
- Save the workspace to browser local storage.
- Export the workspace as JSON.
- Import a previously exported workspace JSON file.
- Add, edit, and delete process-map steps.
- Run a simulated eval gate and generate an executive readout.

## Demo case

The included demo is an AML Alert Briefing Agent for a bank. The goal is to show how PRAXIS helps an FDE reduce investigation prep time from 45 minutes to 9 minutes while preserving human approval and compliance controls.
