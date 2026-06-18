# PRAXIS

**An operating system for Forward-Deployed Engineering.**

> If an AI agent is a new hire, PRAXIS is the onboarding, the runbook, and the manager.

PRAXIS turns a messy enterprise client engagement into a structured, governed AI deployment workspace. It maps the client's processes, wires up their systems as agent-ready tools, scores where AI actually creates value, models the ROI, and ships human-in-the-loop agent workflows with evals, approvals, and an audit trail — so a forward-deployed engineer can go from "first client call" to "deployed, defensible AI" without rebuilding the plumbing every time.

---

## The problem

Forward-deployed engineering is the fastest-growing role in AI — but FDEs do it with duct tape: Notion docs for process maps, ad-hoc scripts for integrations, screenshots for ROI, and zero governance. Every engagement starts from zero, nothing is reusable, and nothing is audit-ready when the client's security team shows up.

PRAXIS is the missing control plane.

---

## What you do with it

| Step | Example |
| --- | --- |
| 01 — Map the engagement | Import the client's process ("AML alert triage"), systems, and stakeholders into a context graph. |
| 02 — Wire the tools | Point PRAXIS at the client's OpenAPI specs; it generates an agent-ready Tool Fabric with auth and schemas. |
| 03 — Score & model | Rank automation opportunities by value/feasibility/risk; model ROI and payback. |
| 04 — Ship with guardrails | Generate a human-in-the-loop workflow with eval gates, approval steps, and a full audit log. |

---

## PRAXIS is for you if

- ✅ You're a forward-deployed / solutions / applied-AI engineer embedding with enterprise clients
- ✅ You keep rebuilding the same connectors, governance, and ROI decks for every deployment
- ✅ Your clients' security teams need RBAC, SSO/SCIM, and audit trails before anything ships
- ✅ You want agents that act on real client systems — safely, with a human in the loop
- ✅ You need to *prove* value (ROI, payback) to the people who sign the renewal

---

## Features

🗺️ **Context Graph** — People, systems, processes, controls and their relationships, modeled as a graph the agents can reason over.

🔌 **Connectors** — Client systems wired in with PII / data-owner / readiness checks before anything is exposed to an agent.

🛠️ **Tool Fabric** — Converts OpenAPI specs into agent-ready tools with auth and JSON schemas, and scaffolds MCP servers.

🧠 **LLM Intake Engine** — OpenAI-compatible adapter with JSON-schema validation, repair/retry, and deterministic fallback so structured outputs don't break in production.

🎯 **Opportunity Scoring** — Ranks candidate automations by business value, feasibility, and risk.

💰 **ROI & Payback Modeling** — Turns each opportunity into a defensible business case.

🛡️ **Governance** — RBAC, SSO/SCIM, approval gates, and an immutable audit trail. Built for the client's security review.

✅ **Eval Gates** — Every agent workflow runs through evals (coverage, hallucination checks, regression tracking) before it's allowed to act.

👤 **Human-in-the-Loop** — Approvals and overrides on every consequential action.

---

## What's under the hood

```
┌──────────────────────────────────────────────────────────────┐
│                        PRAXIS SERVER                          │
│                                                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Context  │  │   Tool    │  │   Agent   │  │Governance │  │
│  │   Graph   │  │  Fabric   │  │  Runtime  │  │ & Audit   │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
│                                                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │Connectors │  │ LLM Intake│  │   Evals   │  │  ROI &    │  │
│  │ (+PII/RBAC│  │(schema +  │  │  & Gates  │  │  Payback  │  │
│  │  checks)  │  │ repair)   │  │           │  │  Model    │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
└──────────────────────────────────────────────────────────────┘
        ▲               ▲               ▲               ▲
   OpenAPI specs   Client systems   LLM provider    Web dashboard
```

**Context Graph** — entities (people, systems, processes, controls) and edges, so an agent always has the "why" behind a task, not just a prompt.

**Connectors** — each client system is registered with access mode, data owner, PII flags, and a readiness check; nothing reaches an agent until it passes.

**Tool Fabric** — ingests OpenAPI, emits typed, auth-aware tools, and auto-generates MCP server scaffolds so agents can call client APIs safely.

**LLM Intake Engine** — provider-agnostic (OpenAI-compatible) adapter with JSON-schema validation, automatic repair/retry, and a deterministic rule-based fallback when no key is set.

**Agent Runtime** — executes human-in-the-loop workflows, each gated by evals and approvals; every tool call is traced.

**Governance & Audit** — RBAC, SSO/SCIM, approval policies, and an immutable activity log built for enterprise security review.

**ROI & Payback Model** — scores opportunities and produces an executive-ready business case per workflow.

---

## Demo

The included demo deploys an **AML alert-briefing agent**: it ingests an alert, pulls context through the Tool Fabric, drafts an investigator briefing, and routes it for human approval — cutting investigation prep from **~45 minutes to ~9 minutes** while preserving compliance controls.

Open `PRAXIS_DEMO_STANDALONE.html` for the interactive walkthrough.

---

## Tech stack

- **Backend:** Node.js, ~40 REST endpoints (`server.js`)
- **Frontend:** vanilla JS + CSS dashboard (`app.js`, `index.html`, `styles.css`)
- **Data:** PostgreSQL-ready schema (`schema.sql`)
- **AI:** OpenAI-compatible LLM adapter (Anthropic / OpenAI), JSON-schema-validated structured outputs, MCP
- **Deploy:** Dockerfile + docker-compose

---

## Quickstart

```bash
git clone https://github.com/westfellow25/praxis.git
cd praxis
npm install
cp .env.example .env        # add your LLM API key (optional — falls back to rule-based)
node server.js              # API + dashboard on http://localhost:3000
```

Or run the standalone demo with no setup: open `PRAXIS_DEMO_STANDALONE.html` in a browser.

See `DEPLOYMENT.md` for Docker and `DATABASE_SCHEMA.md` for the data model.

---

## What PRAXIS is not

- **Not an agent framework.** Bring your own agents/models — PRAXIS governs the engagement they run inside.
- **Not a chatbot.** Agents have scoped tools, approvals, and audit — not a chat window.
- **Not a no-code toy.** It models real enterprise deployments: connectors, RBAC, evals, ROI.

---

## Roadmap

- [x] Context graph + connectors with PII/readiness checks
- [x] OpenAPI → Tool Fabric + MCP scaffolding
- [x] Governance (RBAC/SSO/SCIM), approvals, audit log
- [x] Eval gates on the agent runtime
- [x] ROI / payback modeling + AML demo
- [ ] Reusable engagement templates (export/import)
- [ ] Multi-client isolation in one deployment
- [ ] Live eval dashboards & regression history

---

Built by [@westfellow25](https://github.com/westfellow25).
