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
- `GET /api/database/status`
- `POST /api/database/backup`
- `GET /api/workspace`
- `PUT /api/workspace`
- `GET /api/playbooks`
- `PUT /api/playbooks`
- `GET /api/playbooks/registry`
- `POST /api/playbooks/publish`
- `POST /api/playbooks/registry/use`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/evals/history`
- `GET /api/handoffs`
- `GET /api/handoffs/alerts`
- `PATCH /api/handoffs/:id`
- `GET /api/telemetry`
- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/search`
- `POST /api/retrieval/query`
- `POST /api/context/graph`
- `POST /api/context/search`
- `POST /api/connectors/test`
- `DELETE /api/documents/:id`
- `POST /api/agent/run`
- `POST /api/intake`
- `POST /api/intake/workspace`
- `POST /api/evals/run`
- `POST /api/openapi/import`
- `POST /api/mcp/generate`
- `POST /api/tools/sandbox`
- `POST /api/governance/check`
- `POST /api/governance/enforce`

The local database is `data/praxis-db.json`.

See `DATABASE_SCHEMA.md` for the current schema.
See `schema.sql` for the Postgres-ready schema draft.

`POST /api/intake/workspace` is the first backend intake engine. It takes messy client notes and returns a structured workspace patch: best template, KPI timings, human-review target, source systems, connector patches, success metric, and first-agent summary. By default it uses a deterministic extractor. If `.env` includes `LLM_ENDPOINT`, `LLM_MODEL`, and `LLM_API_KEY`, the backend uses an OpenAI-compatible chat-completions adapter with schema validation, repair/retry, and deterministic fallback if the provider fails or returns invalid JSON.

## Roadmap checklist

Open `REMAINING_CHECKLIST.html` for a color-coded roadmap:

- Green: done enough for MVP.
- Orange: partially done or next layer.
- Red: not started or critical for the next product phase.

## What works in this version

- Edit the client brief and KPI metrics.
- Generate a workspace from a raw process description through the backend intake engine, with schema validation, repair/retry, and browser fallback.
- Use four demo intake presets: banking AML, insurance claims, legal review, and SaaS support.
- View, sync, and search a generated Context Graph with people, systems, agent tools, controls, lineage, and readiness blockers.
- Manage connector readiness across source systems, data classes, access modes, refresh cadence, and blockers.
- Run connector dry-run tests that check access, owner, data controls, refresh cadence, Knowledge Base evidence, and pilot gates before agents rely on sources.
- View an ingestion plan that explains how PRAXIS connects, masks, indexes, and proves client data.
- Upload or paste `.txt`, `.md`, and `.json` client documents into Knowledge Base.
- Extract document summaries, chunks, keywords, systems, and risk signals for retrieval-ready context.
- Query document chunks through backend retrieval and show citations inside the Pilot Run Console evidence packet.
- Paste OpenAPI JSON specs into Tool Fabric and turn operations into agent-ready tools.
- Generate an MCP server scaffold from the current Tool Fabric.
- Run Tool Sandbox dry-runs that validate callable contracts, owners, auth, approval requirements, readiness gates, and failure modes before agents use tools.
- Score API/tool readiness and edit owner, auth model, risk, callable signatures, and descriptions.
- Generate an MCP-style tool manifest preview.
- Manage governance policies, approval gates, audit trail requirements, and governance readiness.
- Run a governance pre-flight check that flags blocked connectors, sensitive data, high-risk tools, pending approvals, and audit gaps.
- Run runtime governance enforcement that returns allow/approval/block decisions, masks sensitive input, builds a tool secrets manifest, and records the enforcement audit event.
- Run the backend Agent Runtime from Pilot Console and inspect a saved case trace, state machine, retry policy, evidence packet, decision boundary, approval route, latency, cost estimate, and audit payload.
- Browse saved Pilot Console run history with trace steps, evidence counts, tool counts, confidence, and human-review state.
- Manage a Human Handoff Queue created by Agent Runtime, with approve, escalate, block, overdue, due-soon, and escalated SLA reminders saved back to the backend.
- Calculate annual net value, monthly hours saved, payback, conservative/base/upside scenarios, and runtime telemetry from saved agent runs.
- Edit eval cases with input, expected output, category, severity, and last actual result.
- Run a backend eval gate that reports pass, warning, failure, critical blockers, retrieval coverage, recommendation-match score, hallucination warnings, regressions, and pilot readiness.
- Track eval run history as a regression baseline across repeated pilot tests.
- Include retrieval coverage in backend eval runs when Knowledge Base documents exist.
- Manage a deployment timeline, rollout checklist, blockers, owners, statuses, and exit criteria.
- Save the current workspace as a reusable playbook.
- Search playbooks, publish versioned packages into a local marketplace registry, track usage, and clone packages back into the active workspace.
- Save the workspace to browser local storage.
- Inspect local database health, schema version, collection counts, file size, migrations, and backups.
- Create manual JSON database backups from the Workspace editor.
- Export the workspace as JSON.
- Import a previously exported workspace JSON file.
- Add, edit, and delete process-map steps.
- Run a simulated eval gate and generate an executive readout.

## Demo case

The included demo is an AML Alert Briefing Agent for a bank. The goal is to show how PRAXIS helps an FDE reduce investigation prep time from 45 minutes to 9 minutes while preserving human approval and compliance controls.
