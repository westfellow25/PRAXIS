const STORAGE_KEY = "praxis-mvp-workspace-v1";
const PLAYBOOK_STORAGE_KEY = "praxis-mvp-playbooks-v1";
const DOCUMENT_STORAGE_KEY = "praxis-mvp-documents-v1";
const API_BASE = "/api";
let workspaceSyncTimer = null;
let playbookSyncTimer = null;

const state = {
  activeView: "intake",
  selectedOpportunity: "aml",
  evalsRun: false,
  project: null,
  playbooks: [],
  documents: [],
  runs: [],
  handoffs: [],
  handoffAlerts: null,
  telemetry: null,
  databaseStatus: null,
  evalHistory: [],
  playbookSearch: "",
  documentSearch: "",
  retrieval: { query: "", results: [] },
  governanceCheck: null,
  governanceEnforcement: null,
  mcpServerCode: "",
  toolSandbox: null,
  agentRuntimeRun: null,
  backendOnline: false,
};

const layers = [
  {
    id: "L1",
    className: "l1",
    title: "Context Graph",
    copy: "Maps people, policies, systems, documents, decisions, approvals, and bottlenecks into one living model.",
  },
  {
    id: "L2",
    className: "l2",
    title: "Tool Fabric",
    copy: "Turns messy APIs into safe, documented, permission-aware tools that agents can actually use.",
  },
  {
    id: "L3",
    className: "l3",
    title: "Agent Runtime",
    copy: "Runs task-specific agents with memory, tools, human handoff, retries, and traceable reasoning.",
  },
  {
    id: "L4",
    className: "l4",
    title: "Evals",
    copy: "Tests the agent against real historic cases before it touches production work.",
  },
  {
    id: "L5",
    className: "l5",
    title: "Governance",
    copy: "Controls permissions, approvals, audit logs, data masking, and compliance rules.",
  },
  {
    id: "L6",
    className: "l6",
    title: "Workspace",
    copy: "Gives FDEs and clients one shared room for process maps, blockers, metrics, readouts, and playbooks.",
  },
];

const processSteps = [
  {
    title: "Alert appears",
    owner: "Monitoring system",
    system: "Transaction warehouse",
    pain: "Raw alert has too little context.",
    time: "1 min",
    tags: ["Trigger", "Risk signal"],
  },
  {
    title: "Analyst opens case",
    owner: "AML analyst",
    system: "ServiceNow",
    pain: "Manual case setup and copy-paste.",
    time: "4 min",
    tags: ["Case work", "Human step"],
  },
  {
    title: "Collect evidence",
    owner: "AML analyst",
    system: "KYC, CRM, transactions",
    pain: "Most of the 45 minutes are spent here.",
    time: "25 min",
    tags: ["Bottleneck", "Multi-system"],
  },
  {
    title: "Check policy",
    owner: "Compliance team",
    system: "Policy docs",
    pain: "Rules are scattered across PDFs and internal pages.",
    time: "8 min",
    tags: ["Policy", "Judgment"],
  },
  {
    title: "Draft recommendation",
    owner: "AML analyst",
    system: "Case notes",
    pain: "Writing style varies by analyst.",
    time: "5 min",
    tags: ["Narrative", "Decision support"],
  },
  {
    title: "Review or file",
    owner: "Compliance lead",
    system: "Regulatory portal",
    pain: "High-risk cases need clean audit trail.",
    time: "2 min",
    tags: ["Approval", "Audit"],
  },
];

const opportunities = [
  {
    id: "aml",
    name: "AML Alert Briefing",
    impact: 92,
    risk: 64,
    complexity: 58,
    data: 76,
    api: 68,
    summary: "Best first pilot: high manual effort, clear input/output, measurable ROI, and human review can remain in the loop.",
    modules: ["Context Graph", "Tool Fabric", "Agent Runtime", "Evals", "Governance"],
  },
  {
    id: "kyc",
    name: "KYC Refresh Assistant",
    impact: 74,
    risk: 70,
    complexity: 62,
    data: 71,
    api: 61,
    summary: "Good second pilot. Similar data footprint, but customer outreach and document freshness create more edge cases.",
    modules: ["Context Graph", "Tool Fabric", "Workspace"],
  },
  {
    id: "sar",
    name: "SAR Narrative Drafting",
    impact: 84,
    risk: 86,
    complexity: 72,
    data: 66,
    api: 52,
    summary: "High value but too risky for the first deployment. Needs stronger evals and legal review before production.",
    modules: ["Agent Runtime", "Evals", "Governance"],
  },
  {
    id: "vendor",
    name: "Vendor Risk Triage",
    impact: 63,
    risk: 45,
    complexity: 49,
    data: 69,
    api: 73,
    summary: "Lower risk and easier technically, but business impact is smaller than AML.",
    modules: ["Context Graph", "Agent Runtime", "Workspace"],
  },
];

const workflow = [
  {
    layer: "L1",
    className: "l1",
    title: "Pull alert context",
    copy: "Find the customer, account, alert reason, prior cases, and policy sections.",
    timing: "0-20 sec",
  },
  {
    layer: "L2",
    className: "l2",
    title: "Call bank tools",
    copy: "Use KYC, transaction history, sanctions, and case management APIs safely.",
    timing: "20-60 sec",
  },
  {
    layer: "L3",
    className: "l3",
    title: "Reason over evidence",
    copy: "Compare the alert with patterns, policies, and historical decisions.",
    timing: "60-90 sec",
  },
  {
    layer: "L4",
    className: "l4",
    title: "Self-check answer",
    copy: "Run evidence completeness, policy citation, and contradiction checks.",
    timing: "90-110 sec",
  },
  {
    layer: "L5",
    className: "l5",
    title: "Route decision",
    copy: "Low-risk goes to analyst approval. High-risk escalates with full audit trail.",
    timing: "110-130 sec",
  },
  {
    layer: "L6",
    className: "l6",
    title: "Track ROI",
    copy: "Update deployment dashboard, blockers, user feedback, and next iteration.",
    timing: "Live",
  },
];

const tools = [
  {
    name: "Customer KYC",
    code: "getCustomerKYC(customer_id)",
    copy: "Returns identity, risk tier, document freshness, and beneficial ownership facts.",
  },
  {
    name: "Transaction History",
    code: "getTransactions(account_id, window)",
    copy: "Pulls recent transfers, counterparties, amounts, geographies, and anomaly tags.",
  },
  {
    name: "Sanctions Check",
    code: "checkSanctions(entity_name)",
    copy: "Checks customer and counterparties against approved sanctions data sources.",
  },
  {
    name: "Create Case Note",
    code: "appendCaseNote(case_id, summary)",
    copy: "Writes the agent's evidence summary into the case system after human approval.",
  },
  {
    name: "Human Approval",
    code: "requestReview(case_id, risk_level)",
    copy: "Routes ambiguous or high-risk cases to the right compliance owner.",
  },
  {
    name: "Audit Log",
    code: "recordAgentTrace(case_id, trace)",
    copy: "Stores model, prompt, tools, evidence, policy citations, and reviewer decisions.",
  },
];

const evals = [
  {
    name: "Retrieval accuracy",
    category: "Retrieval",
    severity: "High",
    input: "Historic case with customer profile, transaction window, sanctions hit, and policy citation.",
    expected: "Agent retrieves the correct KYC record, relevant transactions, sanctions result, and policy section.",
    target: "Finds the right KYC, transaction, and policy evidence in historic cases.",
    actual: "",
    result: "pending",
  },
  {
    name: "Recommendation match",
    category: "Decision support",
    severity: "High",
    input: "Previously closed alert with known analyst recommendation and reviewer outcome.",
    expected: "Agent recommendation matches the historical human decision or explains a justified uncertainty.",
    target: "Matches the human analyst's final decision on known cases.",
    actual: "",
    result: "pending",
  },
  {
    name: "Critical miss check",
    category: "Safety",
    severity: "Critical",
    input: "High-risk case with escalation indicators hidden across multiple systems.",
    expected: "Agent escalates the case and does not classify it as low-risk.",
    target: "Does not miss high-risk cases that were escalated by humans.",
    actual: "",
    result: "pending",
  },
  {
    name: "PII masking",
    category: "Privacy",
    severity: "Critical",
    input: "Case containing sensitive customer identifiers and protected notes.",
    expected: "Agent masks restricted PII and keeps protected fields out of external outputs.",
    target: "Does not expose sensitive customer data outside allowed systems.",
    actual: "",
    result: "pending",
  },
  {
    name: "Audit completeness",
    category: "Governance",
    severity: "Medium",
    input: "Normal case that requires evidence, policy citation, tool trace, and reviewer route.",
    expected: "Agent output includes evidence, policy citations, tools used, and human review path.",
    target: "Every answer includes evidence, policy citations, tools used, and reviewer path.",
    actual: "",
    result: "pending",
  },
];

const playbooks = [
  {
    id: "default-aml",
    name: "AML Alert Briefing",
    industry: "Banking",
    clientName: "Northstar Bank",
    copy: "Best for high-volume compliance teams where analysts spend time gathering evidence.",
    modules: ["Context", "Tools", "Evals", "Governance"],
    metrics: { readiness: 68, tools: 6, evals: 5, timeline: 4 },
    source: "Default template",
  },
  {
    id: "default-claims",
    name: "Claims Triage",
    industry: "Insurance",
    clientName: "Harbor Mutual",
    copy: "Collects policy, claim, history, and fraud signals before routing the claim.",
    modules: ["Context", "Tools", "Routing", "QA"],
    metrics: { readiness: 72, tools: 6, evals: 5, timeline: 4 },
    source: "Default template",
  },
  {
    id: "default-contract",
    name: "Contract Risk Review",
    industry: "Legal",
    clientName: "Aster Cloud",
    copy: "Finds risky clauses, compares playbook language, and prepares attorney review.",
    modules: ["Context", "Privilege", "Evals", "Review"],
    metrics: { readiness: 64, tools: 6, evals: 5, timeline: 4 },
    source: "Default template",
  },
];

const intakePresets = {
  banking: {
    label: "Bank AML",
    match: ["aml", "kyc", "bank", "transaction", "sanctions", "compliance"],
    sampleText:
      "Northstar Bank has 42 AML analysts reviewing transaction alerts. Each alert takes around 45 minutes because analysts open ServiceNow, KYC records, transaction history, sanctions tools, and internal policy PDFs before writing a recommendation. Leadership wants a first AI pilot that prepares an evidence briefing in under 10 minutes, but compliance requires human approval for high-risk cases and a complete audit trail.",
    project: {
      clientName: "Northstar Bank",
      workflowName: "AML Alert Briefing",
      beforeTime: "45m",
      afterTime: "9m",
      expectedRoi: "$2.4M",
      humanReview: "18%",
      readiness: 68,
      pilotStatus: "Pilot ready",
      businessProblem:
        "AML analysts spend most of their time collecting evidence across ServiceNow, KYC, transaction history, sanctions tools, and policy documents.",
      firstAgent:
        "AML Alert Briefing Agent: collect evidence, check policy, draft recommendation, route risky cases to human review.",
      successMetric: "Reduce investigation prep time from 45 minutes to under 10 minutes with zero critical compliance misses.",
      processSteps,
      opportunities,
      agentWorkflow: workflow,
      tools,
    },
  },
  insurance: {
    label: "Insurance claims",
    match: ["claim", "insurance", "policy", "fraud", "adjuster", "damage"],
    sampleText:
      "A regional insurer receives 18,000 property claims per month. Adjusters spend 35 minutes opening the policy, loss description, customer history, damage photos, repair estimate, and fraud flags before deciding whether a claim can be fast-tracked or needs senior review. The COO wants a claims triage agent that prepares a packet in 6 minutes and auto-routes simple claims while keeping suspicious claims with humans.",
    project: {
      clientName: "Harbor Mutual",
      workflowName: "Claims Triage",
      beforeTime: "35m",
      afterTime: "6m",
      expectedRoi: "$4.1M",
      humanReview: "22%",
      readiness: 72,
      pilotStatus: "Discovery complete",
      businessProblem:
        "Claims adjusters waste time assembling policy, customer, damage, estimate, and fraud context before they can decide the right route.",
      firstAgent:
        "Claims Triage Agent: assemble the claim packet, check policy coverage, flag fraud signals, and recommend fast-track or human review.",
      successMetric: "Reduce triage time from 35 minutes to 6 minutes while keeping suspicious claims routed to senior adjusters.",
      processSteps: [
        { title: "Claim arrives", owner: "Claims intake", system: "Guidewire", pain: "New claims arrive with uneven descriptions and missing fields.", time: "2 min", tags: ["Trigger", "Intake"] },
        { title: "Open policy", owner: "Adjuster", system: "Policy admin", pain: "Coverage checks require switching systems and reading policy language.", time: "7 min", tags: ["Policy", "Manual"] },
        { title: "Collect evidence", owner: "Adjuster", system: "Photos, estimates, CRM", pain: "Damage photos, repair estimates, and customer history are scattered.", time: "16 min", tags: ["Bottleneck", "Multi-system"] },
        { title: "Check fraud signals", owner: "Fraud ops", system: "Fraud rules engine", pain: "Fraud signals are hard to interpret without context.", time: "5 min", tags: ["Risk", "Judgment"] },
        { title: "Route claim", owner: "Adjuster", system: "Claims queue", pain: "Simple claims wait behind complex ones.", time: "3 min", tags: ["Routing", "Action"] },
        { title: "Review outcome", owner: "Claims lead", system: "QA dashboard", pain: "Leaders cannot easily see why cases were routed.", time: "2 min", tags: ["Audit", "Quality"] },
      ],
      opportunities: [
        { id: "claims-triage", name: "Claims Triage Packet", impact: 90, risk: 58, complexity: 54, data: 78, api: 70, summary: "Best first pilot: high-volume work, clear packet output, and simple claims can remain human-approved at first.", modules: ["Context Graph", "Tool Fabric", "Agent Runtime", "Evals", "Workspace"] },
        { id: "fraud-review", name: "Fraud Signal Explainer", impact: 78, risk: 74, complexity: 67, data: 69, api: 63, summary: "Useful but higher-risk because bad recommendations can affect claims fairness.", modules: ["Agent Runtime", "Evals", "Governance"] },
        { id: "coverage-check", name: "Coverage Check Assistant", impact: 82, risk: 66, complexity: 59, data: 72, api: 68, summary: "Strong follow-on workflow once policy documents are indexed and cited reliably.", modules: ["Context Graph", "Evals", "Governance"] },
      ],
      agentWorkflow: [
        { layer: "L1", className: "l1", title: "Assemble claim context", copy: "Find policy, customer, loss description, photos, estimates, and prior claims.", timing: "0-25 sec" },
        { layer: "L2", className: "l2", title: "Call claims tools", copy: "Read policy admin, claims system, estimate tool, and fraud rules safely.", timing: "25-70 sec" },
        { layer: "L3", className: "l3", title: "Build triage packet", copy: "Summarize coverage, damage, missing facts, and routing recommendation.", timing: "70-110 sec" },
        { layer: "L4", className: "l4", title: "Check against history", copy: "Compare packet and route with historic claim outcomes and QA failures.", timing: "110-140 sec" },
        { layer: "L5", className: "l5", title: "Route with controls", copy: "Fast-track simple claims, escalate fraud or coverage ambiguity to humans.", timing: "140-160 sec" },
        { layer: "L6", className: "l6", title: "Track leakage", copy: "Measure time saved, wrong-route rate, reviewer overrides, and claimant impact.", timing: "Live" },
      ],
      tools: [
        { name: "Policy Lookup", code: "getPolicy(policy_id)", copy: "Returns coverage, exclusions, limits, deductibles, and policy dates." },
        { name: "Claim Details", code: "getClaim(claim_id)", copy: "Pulls claim facts, loss description, attachments, and status." },
        { name: "Damage Evidence", code: "getDamageEvidence(claim_id)", copy: "Reads photos, estimates, repair categories, and missing evidence flags." },
        { name: "Fraud Signals", code: "getFraudSignals(claim_id)", copy: "Returns suspicious patterns, prior flags, and confidence." },
        { name: "Route Claim", code: "routeClaim(claim_id, queue)", copy: "Moves claim to fast-track, senior review, or fraud investigation queue." },
        { name: "Record Trace", code: "recordTriageTrace(claim_id, trace)", copy: "Stores evidence, recommendation, model trace, and reviewer override." },
      ],
    },
  },
  legal: {
    label: "Legal review",
    match: ["contract", "legal", "clause", "nda", "msa", "attorney", "law"],
    sampleText:
      "The legal team reviews 900 vendor contracts per quarter. Lawyers spend 50 minutes comparing each contract against the company playbook, checking privacy terms, indemnity, liability caps, renewal language, and fallback clauses. The GC wants an agent that prepares a redline risk memo in 12 minutes, but privileged documents must stay protected and attorneys must approve every final position.",
    project: {
      clientName: "Aster Cloud",
      workflowName: "Contract Risk Review",
      beforeTime: "50m",
      afterTime: "12m",
      expectedRoi: "$3.2M",
      humanReview: "100%",
      readiness: 64,
      pilotStatus: "Needs legal approval",
      businessProblem:
        "Lawyers spend too much time comparing contracts against playbooks and hunting for risky clauses before they can make a legal judgment.",
      firstAgent:
        "Contract Risk Review Agent: extract clauses, compare to playbook, draft risk memo, and prepare attorney-approved fallback language.",
      successMetric: "Reduce first-pass review time from 50 minutes to 12 minutes while preserving attorney approval for every final position.",
      processSteps: [
        { title: "Contract uploaded", owner: "Legal ops", system: "CLM", pain: "Contracts arrive in inconsistent formats and versions.", time: "3 min", tags: ["Trigger", "Document"] },
        { title: "Identify agreement type", owner: "Attorney", system: "CLM metadata", pain: "Wrong type means wrong playbook.", time: "5 min", tags: ["Classification", "Risk"] },
        { title: "Extract key clauses", owner: "Attorney", system: "Contract PDF", pain: "Clause extraction is repetitive and easy to miss.", time: "18 min", tags: ["Bottleneck", "Document"] },
        { title: "Compare playbook", owner: "Attorney", system: "Legal playbook", pain: "Fallback language lives in docs and attorney memory.", time: "16 min", tags: ["Policy", "Judgment"] },
        { title: "Draft risk memo", owner: "Attorney", system: "CLM notes", pain: "Memos are inconsistent across reviewers.", time: "6 min", tags: ["Narrative", "Decision support"] },
        { title: "Approve position", owner: "Senior counsel", system: "CLM approval", pain: "Final legal judgment must remain human-owned.", time: "2 min", tags: ["Approval", "Governance"] },
      ],
      opportunities: [
        { id: "contract-risk", name: "Contract Risk Memo", impact: 86, risk: 79, complexity: 63, data: 65, api: 59, summary: "High value, but the first pilot should keep 100% attorney approval and focus on memo preparation.", modules: ["Context Graph", "Agent Runtime", "Evals", "Governance"] },
        { id: "clause-extract", name: "Clause Extraction", impact: 74, risk: 52, complexity: 48, data: 71, api: 61, summary: "Safer wedge: extract clauses and citations without recommending final positions.", modules: ["Context Graph", "Evals"] },
        { id: "fallback-draft", name: "Fallback Drafting", impact: 80, risk: 73, complexity: 66, data: 62, api: 55, summary: "Good second pilot after playbook citations are trusted.", modules: ["Agent Runtime", "Governance", "Workspace"] },
      ],
      agentWorkflow: [
        { layer: "L1", className: "l1", title: "Read contract context", copy: "Classify contract type and pull the right playbook, fallback clauses, and metadata.", timing: "0-30 sec" },
        { layer: "L3", className: "l3", title: "Extract clauses", copy: "Find privacy, indemnity, liability, renewal, termination, and governing-law clauses.", timing: "30-90 sec" },
        { layer: "L4", className: "l4", title: "Compare to playbook", copy: "Check each clause against approved positions and known fallback language.", timing: "90-140 sec" },
        { layer: "L5", className: "l5", title: "Protect privilege", copy: "Keep privileged docs inside approved systems and log every source used.", timing: "Always" },
        { layer: "L6", className: "l6", title: "Attorney review", copy: "Send memo, citations, and proposed fallbacks to counsel for final approval.", timing: "Human gate" },
        { layer: "L6", className: "l6", title: "Update playbook", copy: "Capture approved fallback choices as reusable deployment knowledge.", timing: "Live" },
      ],
      tools: [
        { name: "Contract Text", code: "getContractText(contract_id)", copy: "Extracts normalized text from CLM files and PDFs." },
        { name: "Playbook Lookup", code: "getPlaybook(contract_type)", copy: "Returns approved positions, fallback clauses, and escalation rules." },
        { name: "Clause Finder", code: "findClauses(contract_text)", copy: "Identifies key clauses and source citations." },
        { name: "Privilege Guard", code: "checkPrivilegeAccess(user_id, doc_id)", copy: "Ensures privileged documents stay within allowed access boundaries." },
        { name: "Create Risk Memo", code: "draftRiskMemo(contract_id, findings)", copy: "Creates attorney-facing memo with citations and risk levels." },
        { name: "Approval Request", code: "requestCounselApproval(memo_id)", copy: "Routes final position to the responsible attorney." },
      ],
    },
  },
  support: {
    label: "SaaS support",
    match: ["support", "ticket", "customer", "zendesk", "intercom", "bug", "sla"],
    sampleText:
      "A B2B SaaS company has 31,000 support tickets per month. L2 agents spend 22 minutes reading the ticket, checking account status, product telemetry, docs, prior tickets, and known incidents before drafting an answer. The VP Support wants an agent that prepares replies in 3 minutes, routes urgent bugs to engineering, and learns from support QA feedback.",
    project: {
      clientName: "OrbitDesk",
      workflowName: "Support Reply Drafting",
      beforeTime: "22m",
      afterTime: "3m",
      expectedRoi: "$5.6M",
      humanReview: "12%",
      readiness: 81,
      pilotStatus: "Pilot ready",
      businessProblem:
        "Support agents spend too much time gathering customer, product, and incident context before drafting responses.",
      firstAgent:
        "Support Reply Agent: gather context, draft answer, cite docs, detect urgent bugs, and route ambiguous cases.",
      successMetric: "Reduce L2 response prep from 22 minutes to 3 minutes while improving QA score and SLA compliance.",
      processSteps: [
        { title: "Ticket arrives", owner: "Support queue", system: "Zendesk", pain: "Tickets often lack structured issue type and severity.", time: "1 min", tags: ["Trigger", "Queue"] },
        { title: "Read customer context", owner: "L2 agent", system: "CRM, billing", pain: "Agents need plan, ARR, SLA, and account status.", time: "5 min", tags: ["Context", "Manual"] },
        { title: "Check product signals", owner: "L2 agent", system: "Telemetry, logs", pain: "Product state is spread across logs and dashboards.", time: "8 min", tags: ["Bottleneck", "Multi-system"] },
        { title: "Find known answer", owner: "L2 agent", system: "Docs, prior tickets", pain: "Answers exist but are hard to retrieve reliably.", time: "5 min", tags: ["Retrieval", "Knowledge"] },
        { title: "Draft response", owner: "L2 agent", system: "Zendesk", pain: "Response quality varies and citations are inconsistent.", time: "2 min", tags: ["Narrative", "Customer"] },
        { title: "Route exceptions", owner: "Support lead", system: "Jira, incident channel", pain: "Urgent bugs can wait too long in normal queues.", time: "1 min", tags: ["Escalation", "Action"] },
      ],
      opportunities: [
        { id: "support-reply", name: "Support Reply Drafting", impact: 94, risk: 42, complexity: 51, data: 84, api: 78, summary: "Best first pilot: high volume, low regulatory risk, easy human review, and strong ROI.", modules: ["Context Graph", "Tool Fabric", "Agent Runtime", "Evals", "Workspace"] },
        { id: "bug-router", name: "Bug Escalation Router", impact: 72, risk: 50, complexity: 56, data: 75, api: 72, summary: "Good second workflow once telemetry signals are mapped.", modules: ["Tool Fabric", "Agent Runtime", "Governance"] },
        { id: "qa-coach", name: "QA Coaching Agent", impact: 68, risk: 35, complexity: 44, data: 80, api: 66, summary: "Lower-risk internal agent that improves answer quality over time.", modules: ["Evals", "Workspace"] },
      ],
      agentWorkflow: [
        { layer: "L1", className: "l1", title: "Read ticket context", copy: "Pull issue, customer, SLA, account, plan, and prior ticket history.", timing: "0-15 sec" },
        { layer: "L2", className: "l2", title: "Call support tools", copy: "Check telemetry, incidents, docs, product status, and known issues.", timing: "15-45 sec" },
        { layer: "L3", className: "l3", title: "Draft answer", copy: "Prepare customer reply with citations, steps, and confidence score.", timing: "45-70 sec" },
        { layer: "L4", className: "l4", title: "QA self-check", copy: "Check tone, correctness, citation quality, and hallucination risk.", timing: "70-90 sec" },
        { layer: "L5", className: "l5", title: "Route exceptions", copy: "Escalate outages, security issues, VIP accounts, and low-confidence answers.", timing: "90-110 sec" },
        { layer: "L6", className: "l6", title: "Learn from QA", copy: "Capture accepted replies, rewrites, and QA outcomes as eval data.", timing: "Live" },
      ],
      tools: [
        { name: "Ticket Details", code: "getTicket(ticket_id)", copy: "Reads issue, metadata, priority, customer message, and attachments." },
        { name: "Customer Account", code: "getAccount(customer_id)", copy: "Returns plan, ARR, SLA, CSM owner, health, and open risks." },
        { name: "Telemetry Lookup", code: "getProductTelemetry(account_id)", copy: "Pulls recent errors, feature usage, and product state." },
        { name: "Docs Search", code: "searchDocs(query)", copy: "Finds approved docs and troubleshooting steps with citations." },
        { name: "Create Draft Reply", code: "draftReply(ticket_id, answer)", copy: "Writes a reviewable response into the support tool." },
        { name: "Escalate Bug", code: "createJiraIssue(ticket_id, summary)", copy: "Routes urgent product issues to engineering with context." },
      ],
    },
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultProject() {
  const project = {
    clientName: "Northstar Bank",
    workflowName: "AML Alert Briefing",
    beforeTime: "45m",
    afterTime: "9m",
    expectedRoi: "$2.4M",
    humanReview: "18%",
    readiness: 68,
    pilotStatus: "Pilot ready",
    businessProblem:
      "AML analysts spend most of their time collecting evidence across five systems before they can make a decision.",
    firstAgent:
      "AML Alert Briefing Agent: collect evidence, check policy, draft recommendation, route to human review.",
    successMetric: "Reduce investigation prep time from 45 minutes to under 10 minutes without critical compliance errors.",
    intakeText: intakePresets.banking.sampleText,
    processSteps: clone(processSteps),
    opportunities: clone(opportunities),
    agentWorkflow: clone(workflow),
    tools: clone(tools),
    evalCases: clone(evals),
  };
  project.valueModel = createValueModel(project);
  project.connectors = createConnectorPlan(project);
  project.governance = createGovernancePlan(project);
  project.deployment = createDeploymentPlan(project);
  return project;
}

function parseMinutes(value, fallback = 0) {
  const parsed = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createValueModel(project) {
  const beforeMinutes = parseMinutes(project.beforeTime, 45);
  const afterMinutes = parseMinutes(project.afterTime, 9);
  const workflow = `${project.workflowName || ""} ${project.businessProblem || ""}`.toLowerCase();
  const casesPerMonth = workflow.includes("support")
    ? 31000
    : workflow.includes("claim")
      ? 18000
      : workflow.includes("contract")
        ? 300
        : 5000;
  return {
    casesPerMonth,
    beforeMinutes,
    afterMinutes,
    loadedCostPerHour: 85,
    adoptionPercent: 65,
    errorReductionPercent: 18,
    costPerError: workflow.includes("legal") ? 1200 : workflow.includes("bank") || workflow.includes("aml") ? 650 : 220,
    annualPlatformCost: 250000,
    valueNarrative:
      "The first value case is not full automation. It is reducing prep time while preserving human judgment, auditability, and a clear scale path.",
  };
}

function inferConnectorType(systemName) {
  const text = String(systemName || "").toLowerCase();
  if (text.includes("policy") || text.includes("doc") || text.includes("playbook") || text.includes("confluence")) return "Document store";
  if (text.includes("portal") || text.includes("service") || text.includes("case") || text.includes("ticket")) return "Workflow app";
  if (text.includes("warehouse") || text.includes("transaction") || text.includes("telemetry")) return "Data warehouse";
  if (text.includes("crm") || text.includes("customer") || text.includes("kyc") || text.includes("account")) return "Customer record";
  return "Enterprise system";
}

function inferDataClass(systemName) {
  const text = String(systemName || "").toLowerCase();
  if (text.includes("kyc") || text.includes("customer") || text.includes("account") || text.includes("crm")) return "PII";
  if (text.includes("transaction") || text.includes("claim") || text.includes("contract") || text.includes("policy")) return "Confidential";
  if (text.includes("audit") || text.includes("portal")) return "Regulated";
  return "Internal";
}

function inferConnectorStatus(systemName) {
  const text = String(systemName || "").toLowerCase();
  if (text.includes("portal") || text.includes("policy")) return "Needs approval";
  if (text.includes("legacy") || text.includes("pdf")) return "Blocked";
  return "Sandbox ready";
}

function createConnectorPlan(project) {
  const systems = unique(project.processSteps.flatMap((step) => splitSystems(step.system)));
  const sourceSystems = systems.length ? systems : ["Core system", "Policy docs", "Case queue"];
  return sourceSystems.slice(0, 8).map((system, index) => {
    const status = inferConnectorStatus(system);
    const dataClass = inferDataClass(system);
    return {
      name: system,
      type: inferConnectorType(system),
      owner: project.processSteps.find((step) => splitSystems(step.system).includes(system))?.owner || "System owner",
      access: status === "Blocked" ? "No access" : status === "Needs approval" ? "Read-only pending" : "Read-only sandbox",
      dataClass,
      status,
      refresh: index % 3 === 0 ? "Realtime" : index % 3 === 1 ? "Hourly" : "Daily",
      records: dataClass === "PII" ? "Customer-level records" : dataClass === "Regulated" ? "Audit records" : "Workflow records",
      purpose: `Feeds ${project.workflowName} with ${system} context.`,
    };
  });
}

function createGovernancePlan(project) {
  const owner = project.processSteps?.find((step) => step.tags?.some((tag) => tag.toLowerCase() === "bottleneck"))?.owner || "Business owner";
  return {
    policies: [
      {
        area: "Data access",
        rule: "Agent can read approved workflow records only; restricted fields must be masked before model output.",
        owner: "Security",
        severity: "Critical",
        status: "Required",
      },
      {
        area: "Action control",
        rule: "High-risk or irreversible actions require human approval before writing to production systems.",
        owner,
        severity: "Critical",
        status: "Required",
      },
      {
        area: "Audit trail",
        rule: "Every run records user, input, tools, evidence, model output, reviewer, timestamp, and final action.",
        owner: "Compliance",
        severity: "High",
        status: "Required",
      },
      {
        area: "Model boundary",
        rule: "Sensitive context stays inside approved model and infrastructure boundaries.",
        owner: "Platform owner",
        severity: "High",
        status: "Draft",
      },
    ],
    approvals: [
      {
        gate: "Sandbox data access",
        approver: "Security",
        status: "Approved",
        due: "Day 2",
        notes: "Historic cases can be used after masking restricted fields.",
      },
      {
        gate: "Human review policy",
        approver: owner,
        status: "Approved",
        due: "Day 4",
        notes: `${project.humanReview} of cases stay in human review or escalation.`,
      },
      {
        gate: "Production pilot go-live",
        approver: "Compliance",
        status: "Pending",
        due: "Day 7",
        notes: "Requires passing eval gate and audit export validation.",
      },
    ],
    auditEvents: [
      "User or system trigger",
      "Retrieved context and source records",
      "Tool calls with inputs and outputs",
      "Model response and confidence",
      "Human reviewer decision",
      "Final action and timestamp",
    ],
  };
}

function createDeploymentPlan(project) {
  const selectedOwner = project.processSteps?.find((step) => step.tags?.some((tag) => tag.toLowerCase() === "bottleneck"))?.owner || "FDE lead";
  return {
    timeline: [
      {
        day: "Days 1-3",
        title: "Sandbox validation",
        owner: "FDE lead",
        goal: `Run ${project.workflowName} in sandbox using historic cases and frozen tools.`,
        exitCriteria: "All critical evals pass, tool calls are logged, and no sensitive data escapes allowed systems.",
        status: "Ready",
      },
      {
        day: "Days 4-7",
        title: "Limited human-in-loop pilot",
        owner: selectedOwner,
        goal: "Give the workflow to 3-5 trained users while keeping every action reviewable.",
        exitCriteria: `Median prep time trends toward ${project.afterTime}; reviewers accept or improve agent output.`,
        status: "Planned",
      },
      {
        day: "Days 8-14",
        title: "Production shadow mode",
        owner: "Operations lead",
        goal: "Run agent beside live work without automatic execution and compare against human decisions.",
        exitCriteria: "No critical misses, override reasons are understood, and adoption friction is documented.",
        status: "Planned",
      },
      {
        day: "Days 15-30",
        title: "Controlled scale-up",
        owner: "Executive sponsor",
        goal: "Expand to the full pilot team with weekly governance review and ROI tracking.",
        exitCriteria: `${project.beforeTime} to ${project.afterTime} target is credible, blockers are closed, and scale decision is made.`,
        status: "Planned",
      },
    ],
    blockers: [
      {
        title: "Approve production data access",
        owner: "Security",
        severity: "High",
        status: "Open",
        detail: "Confirm which records can be read by the agent and which fields must be masked.",
      },
      {
        title: "Validate audit export",
        owner: "Compliance",
        severity: "High",
        status: "Open",
        detail: "Reviewer wants weekly export of model, prompt, tools, evidence, and approval path.",
      },
      {
        title: "Train first users",
        owner: selectedOwner,
        severity: "Medium",
        status: "Planned",
        detail: "Pilot users need a 30-minute workflow briefing and feedback channel.",
      },
    ],
    checklist: [
      { text: "Critical evals pass with no unresolved fail state.", owner: "FDE lead", done: false },
      { text: "Tool fabric readiness score is above 75%.", owner: "Platform owner", done: false },
      { text: "Human review path is defined for high-risk or low-confidence cases.", owner: selectedOwner, done: true },
      { text: "Audit trail captures inputs, tools, evidence, output, reviewer and timestamp.", owner: "Compliance", done: false },
      { text: "Executive readout has ROI, blockers, scale plan, and decision ask.", owner: "Executive sponsor", done: false },
    ],
  };
}

function normalizeProject(project) {
  const defaults = createDefaultProject();
  const merged = { ...defaults, ...project };
  merged.processSteps = Array.isArray(project?.processSteps) && project.processSteps.length ? project.processSteps : defaults.processSteps;
  merged.opportunities = Array.isArray(project?.opportunities) && project.opportunities.length ? project.opportunities : defaults.opportunities;
  merged.agentWorkflow = Array.isArray(project?.agentWorkflow) && project.agentWorkflow.length ? project.agentWorkflow : defaults.agentWorkflow;
  merged.tools = Array.isArray(project?.tools) && project.tools.length ? project.tools : defaults.tools;
  merged.evalCases = Array.isArray(project?.evalCases) && project.evalCases.length ? project.evalCases : defaults.evalCases;
  merged.valueModel = project?.valueModel || createValueModel(merged);
  merged.connectors = project?.connectors || createConnectorPlan(merged);
  merged.governance = project?.governance || createGovernancePlan(merged);
  merged.deployment = project?.deployment || createDeploymentPlan(merged);
  merged.processSteps = merged.processSteps.map((step) => ({
    title: step.title || "Untitled step",
    owner: step.owner || "Owner",
    system: step.system || "System",
    pain: step.pain || "Describe what happens here.",
    time: step.time || "0 min",
    tags: Array.isArray(step.tags) ? step.tags : String(step.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
  }));
  merged.opportunities = merged.opportunities.map((opp, index) => ({
    id: opp.id || `opportunity-${index + 1}`,
    name: opp.name || "Untitled opportunity",
    impact: Number(opp.impact) || 50,
    risk: Number(opp.risk) || 50,
    complexity: Number(opp.complexity) || 50,
    data: Number(opp.data) || 50,
    api: Number(opp.api) || 50,
    summary: opp.summary || "No summary yet.",
    modules: Array.isArray(opp.modules) ? opp.modules : [],
  }));
  merged.agentWorkflow = merged.agentWorkflow.map((step) => ({
    layer: step.layer || "L3",
    className: step.className || "l3",
    title: step.title || "Untitled action",
    copy: step.copy || "Describe this agent step.",
    timing: step.timing || "TBD",
  }));
  merged.tools = merged.tools.map((tool) => ({
    name: tool.name || "Untitled tool",
    code: tool.code || "toolCall()",
    copy: tool.copy || "Describe this tool.",
    owner: tool.owner || inferToolOwner(tool),
    auth: tool.auth || inferToolAuth(tool),
    risk: tool.risk || inferToolRisk(tool),
  }));
  merged.evalCases = merged.evalCases.map((test, index) => ({
    id: test.id || `eval-${index + 1}`,
    name: test.name || "Untitled eval",
    category: test.category || "Quality",
    severity: test.severity || "Medium",
    input: test.input || test.target || "Describe the test input.",
    expected: test.expected || test.target || "Describe the expected output.",
    target: test.target || test.expected || "Describe what this eval verifies.",
    actual: test.actual || "",
    result: test.result || "pending",
  }));
  merged.valueModel = normalizeValueModel(merged.valueModel, merged);
  merged.connectors = normalizeConnectors(merged.connectors, merged);
  merged.governance = normalizeGovernance(merged.governance, merged);
  merged.deployment = normalizeDeployment(merged.deployment, merged);
  return merged;
}

function normalizeConnectors(connectors, project) {
  const fallback = createConnectorPlan(project);
  const source = Array.isArray(connectors) && connectors.length ? connectors : fallback;
  return source.map((connector) => ({
    name: connector.name || "Unnamed system",
    type: connector.type || inferConnectorType(connector.name),
    owner: connector.owner || "System owner",
    access: connector.access || "Read-only pending",
    dataClass: connector.dataClass || inferDataClass(connector.name),
    status: connector.status || "Needs approval",
    refresh: connector.refresh || "Daily",
    records: connector.records || "Workflow records",
    purpose: connector.purpose || `Feeds ${project.workflowName} with operational context.`,
  }));
}

function normalizeGovernance(governance, project) {
  const fallback = createGovernancePlan(project);
  const source = governance || fallback;
  return {
    policies: (Array.isArray(source.policies) && source.policies.length ? source.policies : fallback.policies).map((item) => ({
      area: item.area || "Policy area",
      rule: item.rule || "Describe the control rule.",
      owner: item.owner || "Owner",
      severity: item.severity || "High",
      status: item.status || "Draft",
    })),
    approvals: (Array.isArray(source.approvals) && source.approvals.length ? source.approvals : fallback.approvals).map((item) => ({
      gate: item.gate || "Approval gate",
      approver: item.approver || "Approver",
      status: item.status || "Pending",
      due: item.due || "TBD",
      notes: item.notes || "Describe what this approval covers.",
    })),
    auditEvents: Array.isArray(source.auditEvents) && source.auditEvents.length ? source.auditEvents : fallback.auditEvents,
  };
}

function normalizeValueModel(valueModel, project) {
  const fallback = createValueModel(project);
  const source = valueModel || fallback;
  return {
    casesPerMonth: Number(source.casesPerMonth) || fallback.casesPerMonth,
    beforeMinutes: Number(source.beforeMinutes) || fallback.beforeMinutes,
    afterMinutes: Number(source.afterMinutes) || fallback.afterMinutes,
    loadedCostPerHour: Number(source.loadedCostPerHour) || fallback.loadedCostPerHour,
    adoptionPercent: Math.max(0, Math.min(100, Number(source.adoptionPercent) || fallback.adoptionPercent)),
    errorReductionPercent: Math.max(0, Math.min(100, Number(source.errorReductionPercent) || fallback.errorReductionPercent)),
    costPerError: Number(source.costPerError) || fallback.costPerError,
    annualPlatformCost: Number(source.annualPlatformCost) || fallback.annualPlatformCost,
    valueNarrative: source.valueNarrative || fallback.valueNarrative,
  };
}

function normalizeDeployment(deployment, project) {
  const fallback = createDeploymentPlan(project);
  const source = deployment || fallback;
  return {
    timeline: (Array.isArray(source.timeline) && source.timeline.length ? source.timeline : fallback.timeline).map((item) => ({
      day: item.day || "Day TBD",
      title: item.title || "Untitled milestone",
      owner: item.owner || "Owner",
      goal: item.goal || "Describe the deployment goal.",
      exitCriteria: item.exitCriteria || "Describe what must be true to move forward.",
      status: item.status || "Planned",
    })),
    blockers: (Array.isArray(source.blockers) ? source.blockers : fallback.blockers).map((item) => ({
      title: item.title || "Untitled blocker",
      owner: item.owner || "Owner",
      severity: item.severity || "Medium",
      status: item.status || "Open",
      detail: item.detail || "Describe the blocker.",
    })),
    checklist: (Array.isArray(source.checklist) ? source.checklist : fallback.checklist).map((item) => ({
      text: item.text || "Checklist item",
      owner: item.owner || "Owner",
      done: Boolean(item.done),
    })),
  };
}

function loadProject() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultProject();
    return normalizeProject(JSON.parse(saved));
  } catch (error) {
    console.warn("Could not load workspace", error);
    return createDefaultProject();
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function hydrateFromBackend() {
  try {
    const [workspaceResponse, playbooksResponse, documentsResponse, runsResponse, handoffsResponse, handoffAlertsResponse, telemetryResponse, databaseResponse, evalHistoryResponse] = await Promise.all([
      apiRequest("/workspace"),
      apiRequest("/playbooks"),
      apiRequest("/documents"),
      apiRequest("/runs"),
      apiRequest("/handoffs"),
      apiRequest("/handoffs/alerts"),
      apiRequest("/telemetry"),
      apiRequest("/database/status"),
      apiRequest("/evals/history"),
    ]);
    state.backendOnline = true;
    state.databaseStatus = databaseResponse.database || null;
    state.evalHistory = Array.isArray(evalHistoryResponse.evalRuns) ? evalHistoryResponse.evalRuns : [];

    if (workspaceResponse.workspace?.project) {
      state.project = normalizeProject(workspaceResponse.workspace.project);
      state.selectedOpportunity = workspaceResponse.workspace.selectedOpportunity || state.project.opportunities[0]?.id || "aml";
      state.evalsRun = Boolean(workspaceResponse.workspace.evalsRun);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    } else {
      scheduleWorkspaceSync();
    }

    if (Array.isArray(playbooksResponse.playbooks) && playbooksResponse.playbooks.length) {
      const merged = [...playbooks, ...playbooksResponse.playbooks];
      const byId = new Map();
      merged.forEach((playbook, index) => {
        const normalized = normalizePlaybook(playbook, index);
        byId.set(normalized.id, normalized);
      });
      state.playbooks = [...byId.values()];
      localStorage.setItem(
        PLAYBOOK_STORAGE_KEY,
        JSON.stringify(state.playbooks.filter((playbook) => !playbook.id.startsWith("default-"))),
      );
    }

    if (Array.isArray(documentsResponse.documents)) {
      state.documents = documentsResponse.documents.map(normalizeDocument);
      localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(state.documents));
    }

    if (Array.isArray(runsResponse.runs)) {
      state.runs = runsResponse.runs;
    }

    if (Array.isArray(handoffsResponse.handoffs)) {
      state.handoffs = handoffsResponse.handoffs.map(normalizeHandoff);
    }

    state.handoffAlerts = normalizeHandoffAlertReport(handoffAlertsResponse);
    state.telemetry = normalizeTelemetry(telemetryResponse.telemetry);

    setStorageStatus("Backend synced", "green");
    renderAll();
  } catch (error) {
    state.backendOnline = false;
    console.info("Backend unavailable; using local browser storage", error);
    setStorageStatus("Local draft", "");
    renderDatabaseStatus();
  }
}

function scheduleWorkspaceSync() {
  clearTimeout(workspaceSyncTimer);
  workspaceSyncTimer = setTimeout(syncWorkspaceToBackend, 350);
}

async function syncWorkspaceToBackend() {
  try {
    const response = await apiRequest("/workspace", {
      method: "PUT",
      body: JSON.stringify({
        project: state.project,
        selectedOpportunity: state.selectedOpportunity,
        evalsRun: state.evalsRun,
      }),
    });
    state.backendOnline = true;
    setStorageStatus(response.updatedAt ? "Backend saved" : "Saved", "green");
    await refreshDatabaseStatus();
  } catch (error) {
    state.backendOnline = false;
    console.info("Workspace backend sync skipped", error);
  }
}

function schedulePlaybookSync() {
  clearTimeout(playbookSyncTimer);
  playbookSyncTimer = setTimeout(syncPlaybooksToBackend, 350);
}

async function syncPlaybooksToBackend() {
  try {
    const customPlaybooks = state.playbooks.filter((playbook) => !playbook.id.startsWith("default-"));
    await apiRequest("/playbooks", {
      method: "PUT",
      body: JSON.stringify({ playbooks: customPlaybooks }),
    });
    state.backendOnline = true;
    setStorageStatus("Playbooks synced", "green");
  } catch (error) {
    state.backendOnline = false;
    console.info("Playbook backend sync skipped", error);
  }
}

function saveProject(statusText = "Saved locally") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    setStorageStatus(statusText, "green");
    scheduleWorkspaceSync();
  } catch (error) {
    console.warn("Could not save workspace", error);
    setStorageStatus("Save failed", "amber");
  }
}

function normalizePlaybook(playbook, index = 0) {
  return {
    id: playbook.id || `playbook-${Date.now()}-${index}`,
    name: playbook.name || "Untitled playbook",
    industry: playbook.industry || inferIndustryFromProject(playbook.projectSnapshot || state.project || {}),
    clientName: playbook.clientName || playbook.projectSnapshot?.clientName || "Template client",
    copy: playbook.copy || playbook.projectSnapshot?.businessProblem || "Reusable deployment pattern.",
    modules: Array.isArray(playbook.modules) && playbook.modules.length ? playbook.modules : ["Context", "Tools", "Evals"],
    metrics: {
      readiness: Number(playbook.metrics?.readiness) || Number(playbook.projectSnapshot?.readiness) || 0,
      tools: Number(playbook.metrics?.tools) || playbook.projectSnapshot?.tools?.length || 0,
      evals: Number(playbook.metrics?.evals) || playbook.projectSnapshot?.evalCases?.length || 0,
      timeline: Number(playbook.metrics?.timeline) || playbook.projectSnapshot?.deployment?.timeline?.length || 0,
    },
    source: playbook.source || "Saved workspace",
    createdAt: playbook.createdAt || new Date().toISOString(),
    projectSnapshot: playbook.projectSnapshot ? normalizeProject(playbook.projectSnapshot) : null,
  };
}

function inferIndustryFromProject(project) {
  const text = `${project.clientName || ""} ${project.workflowName || ""} ${project.businessProblem || ""}`.toLowerCase();
  if (text.includes("bank") || text.includes("aml") || text.includes("kyc")) return "Banking";
  if (text.includes("claim") || text.includes("insurance")) return "Insurance";
  if (text.includes("contract") || text.includes("legal")) return "Legal";
  if (text.includes("support") || text.includes("ticket")) return "SaaS";
  return "Enterprise";
}

function loadPlaybooks() {
  try {
    const saved = localStorage.getItem(PLAYBOOK_STORAGE_KEY);
    const savedPlaybooks = saved ? JSON.parse(saved) : [];
    const merged = [...playbooks, ...savedPlaybooks];
    const byId = new Map();
    merged.forEach((playbook, index) => {
      const normalized = normalizePlaybook(playbook, index);
      byId.set(normalized.id, normalized);
    });
    return [...byId.values()];
  } catch (error) {
    console.warn("Could not load playbooks", error);
    return playbooks.map(normalizePlaybook);
  }
}

function savePlaybooks() {
  const customPlaybooks = state.playbooks.filter((playbook) => !playbook.id.startsWith("default-"));
  localStorage.setItem(PLAYBOOK_STORAGE_KEY, JSON.stringify(customPlaybooks));
  schedulePlaybookSync();
}

function normalizeDocument(document) {
  return {
    id: document.id || `local-doc-${Date.now()}`,
    name: document.name || "Untitled document",
    sourceType: document.sourceType || "pasted",
    templateKey: document.templateKey || inferIndustryFromProject({ workflowName: document.name }).toLowerCase(),
    summary: document.summary || "No summary yet.",
    systems: Array.isArray(document.systems) ? document.systems : [],
    keywords: Array.isArray(document.keywords) ? document.keywords : [],
    signals: document.signals || {},
    sizeBytes: Number(document.sizeBytes) || 0,
    wordCount: Number(document.wordCount) || 0,
    chunkCount: Number(document.chunkCount) || 0,
    chunks: Array.isArray(document.chunks) ? document.chunks : [],
    createdAt: document.createdAt || new Date().toISOString(),
  };
}

function normalizeHandoff(handoff = {}) {
  return {
    id: handoff.id || `handoff-${Date.now()}`,
    runId: handoff.runId || "manual-run",
    clientName: handoff.clientName || state.project?.clientName || "Client",
    workflowName: handoff.workflowName || state.project?.workflowName || "Workflow",
    gate: handoff.gate || "Human review",
    approver: handoff.approver || "Workflow owner",
    status: handoff.status || "Pending",
    priority: handoff.priority || "Medium",
    reason: handoff.reason || "Human review required",
    recommendation: handoff.recommendation || "Review the agent output before action.",
    nextAction: handoff.nextAction || "human_review_queue",
    confidence: Number(handoff.confidence) || 0,
    evidenceCount: Number(handoff.evidenceCount) || 0,
    toolCount: Number(handoff.toolCount) || 0,
    dueAt: handoff.dueAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    reviewerNotes: handoff.reviewerNotes || "",
    decision: handoff.decision || null,
    createdAt: handoff.createdAt || new Date().toISOString(),
    updatedAt: handoff.updatedAt || handoff.createdAt || new Date().toISOString(),
    audit: Array.isArray(handoff.audit) ? handoff.audit : [],
    sla: handoff.sla || null,
  };
}

function getLocalHandoffSla(handoff, nowMs = Date.now()) {
  const status = handoff.status || "Pending";
  const dueMs = Date.parse(handoff.dueAt || "");
  const isClosed = ["Approved", "Blocked"].includes(status);
  const dueSoonMs = 4 * 60 * 60 * 1000;

  if (status === "Blocked") return { state: "blocked", label: "Blocked", severity: "Critical", minutesRemaining: 0 };
  if (isClosed) return { state: "closed", label: "Closed", severity: "Low", minutesRemaining: 0 };
  if (!Number.isFinite(dueMs)) return { state: "unknown", label: "No due date", severity: "Medium", minutesRemaining: null };

  const minutesRemaining = Math.round((dueMs - nowMs) / 60000);
  if (minutesRemaining < 0) return { state: "overdue", label: "Overdue", severity: "Critical", minutesRemaining };
  if (status === "Escalated") return { state: "escalated", label: "Escalated", severity: "High", minutesRemaining };
  if (dueMs - nowMs <= dueSoonMs) return { state: "due_soon", label: "Due soon", severity: "High", minutesRemaining };
  return { state: "on_track", label: "On track", severity: "Low", minutesRemaining };
}

function buildLocalHandoffAlertReport(handoffs = state.handoffs) {
  const now = Date.now();
  const normalized = handoffs.map((handoff) => ({ ...handoff, sla: getLocalHandoffSla(handoff, now) }));
  const activeStates = new Set(["overdue", "due_soon", "escalated", "blocked", "unknown"]);
  const alerts = normalized
    .filter((handoff) => activeStates.has(handoff.sla.state))
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

function normalizeHandoffAlertReport(report) {
  const fallback = buildLocalHandoffAlertReport();
  if (!report || !report.counts) return fallback;
  return {
    generatedAt: report.generatedAt || fallback.generatedAt,
    counts: { ...fallback.counts, ...report.counts },
    alerts: Array.isArray(report.alerts) ? report.alerts : fallback.alerts,
    handoffs: Array.isArray(report.handoffs) ? report.handoffs.map(normalizeHandoff) : fallback.handoffs,
  };
}

function normalizeTelemetry(telemetry = {}) {
  return {
    generatedAt: telemetry.generatedAt || new Date().toISOString(),
    runCount: Number(telemetry.runCount) || 0,
    lastRunAt: telemetry.lastRunAt || null,
    avgConfidence: Number(telemetry.avgConfidence) || 0,
    avgLatencyMs: Number(telemetry.avgLatencyMs) || 0,
    totalEstimatedCostUsd: Number(telemetry.totalEstimatedCostUsd) || 0,
    humanReviewRate: Number(telemetry.humanReviewRate) || 0,
    outcomes: telemetry.outcomes || {},
    value: {
      casesPerMonth: Number(telemetry.value?.casesPerMonth) || state.project?.valueModel?.casesPerMonth || 0,
      minutesSaved: Number(telemetry.value?.minutesSaved) || 0,
      possibleMonthlyHours: Number(telemetry.value?.possibleMonthlyHours) || 0,
      adoptedMonthlyHours: Number(telemetry.value?.adoptedMonthlyHours) || 0,
      annualLaborSavings: Number(telemetry.value?.annualLaborSavings) || 0,
    },
  };
}

function loadDocuments() {
  try {
    const saved = localStorage.getItem(DOCUMENT_STORAGE_KEY);
    return saved ? JSON.parse(saved).map(normalizeDocument) : [];
  } catch (error) {
    console.warn("Could not load documents", error);
    return [];
  }
}

function saveDocumentsLocal() {
  localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(state.documents));
}

function createLocalDocument(name, content, sourceType = "pasted") {
  const cleanContent = String(content || "").replace(/\s+/g, " ").trim();
  const keywords = unique((cleanContent.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) || []).slice(0, 30)).slice(0, 10);
  const systems = [
    "ServiceNow",
    "Salesforce",
    "Slack",
    "Jira",
    "Zendesk",
    "Snowflake",
    "BigQuery",
    "KYC database",
    "transaction warehouse",
    "sanctions API",
    "policy docs",
    "CLM",
    "CRM",
  ].filter((system) => cleanContent.toLowerCase().includes(system.toLowerCase()));
  const chunks = [];
  for (let start = 0; start < cleanContent.length; start += 900) {
    const text = cleanContent.slice(start, start + 900);
    chunks.push({ id: `chunk-${chunks.length + 1}`, text, characters: text.length, keywords: keywords.slice(0, 5) });
  }
  return normalizeDocument({
    id: `local-doc-${Date.now()}`,
    name: name || "Pasted document",
    sourceType,
    templateKey: pickIntakeTemplate(cleanContent).label,
    summary: `${cleanContent.slice(0, 360)}${cleanContent.length > 360 ? "..." : ""}`,
    systems,
    keywords,
    signals: {
      hasRiskLanguage: /risk|compliance|approval|policy|legal|regulated|audit/i.test(cleanContent),
      hasApiLanguage: /api|endpoint|schema|payload|oauth|webhook|database/i.test(cleanContent),
      hasMetricLanguage: /\d+\s*(min|minute|hour|day|%|percent)|roi|cost|save|sla/i.test(cleanContent),
      hasPiiLanguage: /pii|customer|kyc|account|email|phone|address|ssn/i.test(cleanContent),
    },
    sizeBytes: cleanContent.length,
    wordCount: cleanContent.split(/\s+/).filter(Boolean).length,
    chunkCount: chunks.length,
    chunks,
    createdAt: new Date().toISOString(),
  });
}

function tokenizeText(text = "") {
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .match(/[a-z][a-z0-9_-]{2,}/g) || [],
    ),
  ].filter((token) => !["the", "and", "for", "with", "from", "that", "this", "into", "case", "agent"].includes(token));
}

function buildRetrievalQuery() {
  const project = state.project || {};
  const bottleneck =
    project.processSteps?.find((step) => step.tags?.some((tag) => tag.toLowerCase() === "bottleneck")) ||
    project.processSteps?.[0];
  return [
    project.workflowName,
    project.firstAgent,
    project.businessProblem,
    bottleneck?.title,
    bottleneck?.pain,
    project.connectors?.map((connector) => connector.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);
}

function searchLocalDocumentChunks(query, limit = 6) {
  const terms = tokenizeText(query);
  if (!terms.length) return [];
  return state.documents
    .flatMap((document) =>
      (document.chunks || []).map((chunk) => {
        const haystack = `${document.name} ${document.summary} ${document.systems.join(" ")} ${document.keywords.join(" ")} ${chunk.text}`.toLowerCase();
        const matchedTerms = terms.filter((term) => haystack.includes(term));
        const score = matchedTerms.length * 3 + (document.signals.hasRiskLanguage ? 1 : 0) + (document.signals.hasPiiLanguage ? 1 : 0);
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

async function refreshRetrievalEvidence() {
  const query = buildRetrievalQuery();
  try {
    const response = await apiRequest("/retrieval/query", {
      method: "POST",
      body: JSON.stringify({ query, limit: 6 }),
    });
    state.retrieval = { query: response.query, results: response.results || [] };
    state.backendOnline = true;
  } catch (error) {
    console.info("Backend retrieval unavailable; using local document search", error);
    state.retrieval = { query, results: searchLocalDocumentChunks(query, 6) };
  }
  renderPilotRunConsole();
}

function setStorageStatus(text, variant = "") {
  const element = document.querySelector("#storage-status");
  if (!element) return;
  element.textContent = text;
  element.className = `status-pill ${variant}`.trim();
}

function renderDatabaseStatus() {
  const element = document.querySelector("#database-status");
  if (!element) return;
  const status = state.databaseStatus;
  if (!status) {
    element.textContent = state.backendOnline ? "DB checking" : "DB offline";
    element.className = `status-pill ${state.backendOnline ? "amber" : ""}`.trim();
    return;
  }
  const sizeKb = Math.max(1, Math.round((status.file?.sizeBytes || 0) / 1024));
  element.textContent = `DB v${status.schemaVersion} · ${sizeKb}KB · ${status.backupCount || 0} backups`;
  element.className = `status-pill ${status.ok ? "green" : "amber"}`.trim();
}

async function refreshDatabaseStatus() {
  try {
    const response = await apiRequest("/database/status");
    state.databaseStatus = response.database || null;
    state.backendOnline = true;
  } catch (error) {
    state.backendOnline = false;
    console.info("Database status unavailable", error);
  }
  renderDatabaseStatus();
}

async function backupDatabase() {
  const button = document.querySelector("#backup-database");
  button.disabled = true;
  button.textContent = "Backing up";
  try {
    const response = await apiRequest("/database/backup", {
      method: "POST",
      body: JSON.stringify({ reason: "manual-ui" }),
    });
    state.databaseStatus = response.database || null;
    state.backendOnline = true;
    setStorageStatus(`Backup ${response.backup.name.slice(0, 10)}`, "green");
  } catch (error) {
    state.backendOnline = false;
    console.info("Database backup unavailable", error);
    setStorageStatus("Backup failed", "amber");
  } finally {
    button.disabled = false;
    button.textContent = "Backup DB";
    renderDatabaseStatus();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inferToolOwner(tool) {
  const text = `${tool.name || ""} ${tool.copy || ""}`.toLowerCase();
  if (text.includes("audit") || text.includes("trace") || text.includes("approval")) return "Governance";
  if (text.includes("policy") || text.includes("contract") || text.includes("claim")) return "Operations";
  if (text.includes("customer") || text.includes("account")) return "Customer systems";
  if (text.includes("transaction") || text.includes("telemetry") || text.includes("product")) return "Data platform";
  return "API owner";
}

function inferToolAuth(tool) {
  const text = `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""}`.toLowerCase();
  if (text.includes("audit") || text.includes("approval") || text.includes("route") || text.includes("create")) return "Service account + approval";
  if (text.includes("customer") || text.includes("kyc") || text.includes("policy") || text.includes("contract")) return "User delegated";
  return "Read-only service";
}

function inferToolRisk(tool) {
  const text = `${tool.name || ""} ${tool.code || ""} ${tool.copy || ""}`.toLowerCase();
  if (text.includes("create") || text.includes("route") || text.includes("approval") || text.includes("escalate")) return "High";
  if (text.includes("customer") || text.includes("kyc") || text.includes("contract") || text.includes("policy")) return "Medium";
  return "Low";
}

function scoreTool(tool) {
  let score = 25;
  if (tool.name && tool.name.length > 3) score += 15;
  if (tool.code && tool.code.includes("(") && tool.code.includes(")")) score += 20;
  if (tool.copy && tool.copy.length > 35) score += 15;
  if (tool.owner && tool.owner !== "API owner") score += 10;
  if (tool.auth) score += 10;
  if (String(tool.copy || "").toLowerCase().includes("audit") || String(tool.name || "").toLowerCase().includes("audit")) score += 5;
  return Math.min(100, score);
}

function getToolFailureModesLocal(tool = {}, score = scoreTool(tool)) {
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

function parseToolInputsLocal(code = "") {
  const match = String(code).match(/\(([^)]*)\)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildToolSandboxReportLocal(project = state.project) {
  const tools = Array.isArray(project.tools) ? project.tools : [];
  const results = tools.map((tool, index) => {
    const readiness = scoreTool(tool);
    const failureModes = getToolFailureModesLocal(tool, readiness);
    const critical = failureModes.filter((failure) => failure.severity === "Critical").length;
    const high = failureModes.filter((failure) => failure.severity === "High").length;
    const status = critical || high ? "fail" : failureModes.length ? "warn" : "pass";
    const inputs = parseToolInputsLocal(tool.code);
    return {
      id: tool.id || tool.name || `tool-${index + 1}`,
      name: tool.name || `Tool ${index + 1}`,
      callable: tool.code || "",
      owner: tool.owner || "API owner",
      auth: tool.auth || "Unknown",
      risk: tool.risk || "Medium",
      readiness,
      status,
      latencyMs: 25 + index * 7 + Math.max(0, 100 - readiness),
      inputs,
      failureModes,
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

function scoreConnector(connector) {
  let score = 20;
  if (connector.name && connector.name.length > 2) score += 10;
  if (connector.owner && connector.owner !== "System owner") score += 10;
  if (connector.access && !connector.access.toLowerCase().includes("no access")) score += 20;
  if (connector.status === "Sandbox ready" || connector.status === "Production ready") score += 25;
  if (connector.status === "Needs approval") score += 8;
  if (connector.dataClass && connector.dataClass !== "Unknown") score += 10;
  if (connector.purpose && connector.purpose.length > 35) score += 5;
  return Math.min(100, score);
}

function getConnectorHealth() {
  const connectorScores = state.project.connectors.map(scoreConnector);
  const averageScore = Math.round(connectorScores.reduce((sum, score) => sum + score, 0) / Math.max(1, connectorScores.length));
  const blocked = state.project.connectors.filter((connector) => connector.status === "Blocked" || connector.access === "No access").length;
  const sensitive = state.project.connectors.filter((connector) => ["PII", "Confidential", "Regulated"].includes(connector.dataClass)).length;
  const ready = averageScore >= 75 && blocked === 0;
  return { averageScore, blocked, sensitive, ready };
}

function badge(layer, className) {
  return `<span class="badge ${className}">${layer}</span>`;
}

function renderProjectSummary() {
  const project = state.project;
  document.querySelector("#client-name").textContent = project.clientName;
  document.querySelector("#pilot-status").textContent = project.pilotStatus;
  document.querySelector("#business-problem").textContent = project.businessProblem;
  document.querySelector("#first-agent").textContent = project.firstAgent;
  document.querySelector("#success-metric").textContent = project.successMetric;
  document.querySelector("#workflow-title").textContent = `${project.workflowName} Agent workflow`;
}

function renderMetrics() {
  const project = state.project;
  const value = computeValueModel();
  document.querySelector("#metric-target-kpi").textContent = `${project.beforeTime} to ${project.afterTime}`;
  document.querySelector("#readiness-score").textContent = `${project.readiness}%`;
  document.querySelector("#metric-roi").textContent = formatCompactMoney(value.annualNetValue);
  document.querySelector("#metric-human-review").textContent = project.humanReview;
}

function populateProjectForm() {
  const project = state.project;
  const form = document.querySelector("#project-form");
  form.clientName.value = project.clientName;
  form.workflowName.value = project.workflowName;
  form.beforeTime.value = project.beforeTime;
  form.afterTime.value = project.afterTime;
  form.expectedRoi.value = project.expectedRoi;
  form.humanReview.value = project.humanReview;
  form.readiness.value = project.readiness;
  form.pilotStatus.value = project.pilotStatus;
  form.businessProblem.value = project.businessProblem;
  form.firstAgent.value = project.firstAgent;
  form.successMetric.value = project.successMetric;
}

function applyProjectForm() {
  const form = document.querySelector("#project-form");
  const data = new FormData(form);
  state.project = {
    ...state.project,
    clientName: data.get("clientName").trim() || "Untitled client",
    workflowName: data.get("workflowName").trim() || "Untitled workflow",
    beforeTime: data.get("beforeTime").trim() || "45m",
    afterTime: data.get("afterTime").trim() || "9m",
    expectedRoi: data.get("expectedRoi").trim() || "$0",
    humanReview: data.get("humanReview").trim() || "0%",
    readiness: Math.max(0, Math.min(100, Number(data.get("readiness")) || 0)),
    pilotStatus: data.get("pilotStatus").trim() || "Draft",
    businessProblem: data.get("businessProblem").trim(),
    firstAgent: data.get("firstAgent").trim(),
    successMetric: data.get("successMetric").trim(),
  };
  saveProject();
  renderAll({ keepFormValues: true });
}

function computeValueModel(overrides = {}) {
  const model = { ...state.project.valueModel, ...overrides };
  const minutesSaved = Math.max(0, Number(model.beforeMinutes) - Number(model.afterMinutes));
  const monthlyHoursSaved = (Number(model.casesPerMonth) * minutesSaved) / 60;
  const adoptedMonthlyHours = monthlyHoursSaved * (Number(model.adoptionPercent) / 100);
  const annualLaborSavings = adoptedMonthlyHours * Number(model.loadedCostPerHour) * 12;
  const annualErrorSavings =
    Number(model.casesPerMonth) *
    12 *
    (Number(model.errorReductionPercent) / 100) *
    0.02 *
    Number(model.costPerError);
  const annualGrossValue = annualLaborSavings + annualErrorSavings;
  const annualNetValue = annualGrossValue - Number(model.annualPlatformCost);
  const monthlyGrossValue = annualGrossValue / 12;
  const paybackMonths = monthlyGrossValue > 0 ? Number(model.annualPlatformCost) / monthlyGrossValue : Infinity;
  return {
    minutesSaved,
    monthlyHoursSaved,
    adoptedMonthlyHours,
    annualLaborSavings,
    annualErrorSavings,
    annualGrossValue,
    annualNetValue,
    paybackMonths,
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatCompactMoney(value) {
  const number = Number(value) || 0;
  const abs = Math.abs(number);
  if (abs >= 1000000) return `$${(number / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}M`;
  if (abs >= 1000) return `$${Math.round(number / 1000)}K`;
  return formatMoney(number);
}

function populateValueForm() {
  const form = document.querySelector("#value-form");
  const model = state.project.valueModel;
  form.casesPerMonth.value = model.casesPerMonth;
  form.beforeMinutes.value = model.beforeMinutes;
  form.afterMinutes.value = model.afterMinutes;
  form.loadedCostPerHour.value = model.loadedCostPerHour;
  form.adoptionPercent.value = model.adoptionPercent;
  form.errorReductionPercent.value = model.errorReductionPercent;
  form.costPerError.value = model.costPerError;
  form.annualPlatformCost.value = model.annualPlatformCost;
  form.valueNarrative.value = model.valueNarrative;
}

function updateValueModel() {
  const form = document.querySelector("#value-form");
  const data = new FormData(form);
  state.project.valueModel = normalizeValueModel(
    {
      casesPerMonth: Number(data.get("casesPerMonth")),
      beforeMinutes: Number(data.get("beforeMinutes")),
      afterMinutes: Number(data.get("afterMinutes")),
      loadedCostPerHour: Number(data.get("loadedCostPerHour")),
      adoptionPercent: Number(data.get("adoptionPercent")),
      errorReductionPercent: Number(data.get("errorReductionPercent")),
      costPerError: Number(data.get("costPerError")),
      annualPlatformCost: Number(data.get("annualPlatformCost")),
      valueNarrative: data.get("valueNarrative").trim(),
    },
    state.project,
  );
  saveProject("Value model updated");
  renderValueModel();
  renderMetrics();
  renderReadout();
}

function applyValueToWorkspaceKpi() {
  const computed = computeValueModel();
  state.project.beforeTime = `${state.project.valueModel.beforeMinutes}m`;
  state.project.afterTime = `${state.project.valueModel.afterMinutes}m`;
  state.project.expectedRoi = formatCompactMoney(computed.annualNetValue);
  saveProject("Value applied to KPI");
  renderAll();
}

function renderValueModel() {
  const computed = computeValueModel();
  const model = state.project.valueModel;
  const healthy = computed.annualNetValue > 0 && computed.paybackMonths <= 12;
  document.querySelector("#value-model-health").textContent = healthy ? "Positive ROI" : "Needs tuning";
  document.querySelector("#value-model-health").className = `status-pill ${healthy ? "green" : "amber"}`;
  document.querySelector("#value-summary").innerHTML = `
    <article class="value-card highlight">
      <span>Annual net value</span>
      <strong>${formatCompactMoney(computed.annualNetValue)}</strong>
      <p>Gross value minus annual platform cost.</p>
    </article>
    <article class="value-card">
      <span>Hours saved / month</span>
      <strong>${Math.round(computed.adoptedMonthlyHours).toLocaleString()}</strong>
      <p>${model.adoptionPercent}% adoption applied to ${Math.round(computed.monthlyHoursSaved).toLocaleString()} possible hours.</p>
    </article>
    <article class="value-card">
      <span>Payback</span>
      <strong>${Number.isFinite(computed.paybackMonths) ? `${computed.paybackMonths.toFixed(1)} mo` : "N/A"}</strong>
      <p>Months to recover platform cost from gross value.</p>
    </article>
    <article class="value-card">
      <span>Minutes saved / case</span>
      <strong>${computed.minutesSaved}</strong>
      <p>${model.beforeMinutes} minutes before, ${model.afterMinutes} minutes after.</p>
    </article>
  `;
  renderRuntimeTelemetry(computed);

  document.querySelector("#value-scenarios").innerHTML = [
    { name: "Conservative", multiplier: 0.65, adoption: Math.max(20, model.adoptionPercent - 20), className: "" },
    { name: "Base", multiplier: 1, adoption: model.adoptionPercent, className: "base" },
    { name: "Upside", multiplier: 1.35, adoption: Math.min(95, model.adoptionPercent + 20), className: "" },
  ]
    .map((scenario) => {
      const scenarioValue = computeValueModel({
        casesPerMonth: Math.round(model.casesPerMonth * scenario.multiplier),
        adoptionPercent: scenario.adoption,
      });
      return `
        <article class="scenario-card ${scenario.className}">
          <h3>${scenario.name}</h3>
          <div class="scenario-metrics">
            <div><span>Annual net</span><strong>${formatCompactMoney(scenarioValue.annualNetValue)}</strong></div>
            <div><span>Monthly hours</span><strong>${Math.round(scenarioValue.adoptedMonthlyHours).toLocaleString()}</strong></div>
            <div><span>Payback</span><strong>${Number.isFinite(scenarioValue.paybackMonths) ? `${scenarioValue.paybackMonths.toFixed(1)} mo` : "N/A"}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRuntimeTelemetry(computed) {
  const target = document.querySelector("#runtime-telemetry");
  if (!target) return;
  const telemetry = state.telemetry || normalizeTelemetry();
  const lastRun = telemetry.lastRunAt ? formatDate(telemetry.lastRunAt) : "No runs yet";
  const outcomeRows = Object.entries(telemetry.outcomes || {})
    .slice(0, 3)
    .map(([name, count]) => `<span>${escapeHtml(name)}: ${Number(count) || 0}</span>`)
    .join("");

  target.innerHTML = `
    <article class="telemetry-card">
      <span>Runtime telemetry</span>
      <strong>${telemetry.runCount}</strong>
      <p>Saved agent runs. Last run: ${escapeHtml(lastRun)}.</p>
    </article>
    <article class="telemetry-card">
      <span>Quality</span>
      <strong>${telemetry.avgConfidence}%</strong>
      <p>Average confidence · ${telemetry.humanReviewRate}% human review rate.</p>
    </article>
    <article class="telemetry-card">
      <span>Ops</span>
      <strong>${telemetry.avgLatencyMs}ms</strong>
      <p>${formatMoney(telemetry.totalEstimatedCostUsd)} estimated runtime cost so far.</p>
    </article>
    <article class="telemetry-card highlight">
      <span>Model-linked value</span>
      <strong>${formatCompactMoney(telemetry.value.annualLaborSavings || computed.annualLaborSavings)}</strong>
      <p>${Math.round(telemetry.value.adoptedMonthlyHours || computed.adoptedMonthlyHours).toLocaleString()} monthly hours tied to current assumptions.</p>
    </article>
    <div class="telemetry-outcomes">${outcomeRows || "<span>No outcomes recorded yet</span>"}</div>
  `;
}

function pickIntakeTemplate(text) {
  const normalized = text.toLowerCase();
  let best = intakePresets.banking;
  let bestScore = -1;
  Object.values(intakePresets).forEach((template) => {
    const score = template.match.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  });
  return best;
}

async function generateWorkspaceFromIntake() {
  const textarea = document.querySelector("#intake-text");
  const text = textarea.value.trim() || intakePresets.banking.sampleText;
  textarea.value = text;

  let backendIntake = null;
  try {
    backendIntake = await apiRequest("/intake/workspace", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.info("Backend intake unavailable; using browser fallback", error);
  }

  const template = intakePresets[backendIntake?.templateKey] || pickIntakeTemplate(text);
  const generatedProject = normalizeProject({
    ...clone(template.project),
    ...(backendIntake?.projectPatch || {}),
  });
  generatedProject.intakeText = text;

  if (!backendIntake && !text.toLowerCase().includes(generatedProject.clientName.toLowerCase())) {
    generatedProject.businessProblem = `${generatedProject.businessProblem} Intake note: ${text.slice(0, 220)}${text.length > 220 ? "..." : ""}`;
  }

  state.project = generatedProject;
  state.selectedOpportunity = generatedProject.opportunities[0]?.id || "aml";
  state.evalsRun = false;
  state.project.evalCases.forEach((test) => {
    test.result = "pending";
    test.actual = "";
  });

  saveProject(backendIntake ? `Backend intake: ${template.label}` : `Generated: ${template.label}`);
  renderAll();
  renderIntakePreview(template, text, backendIntake?.analysis);
  switchView("context");
}

function renderIntake() {
  const intakeText = state.project?.intakeText || intakePresets.banking.sampleText;
  const textarea = document.querySelector("#intake-text");
  if (document.activeElement !== textarea) {
    textarea.value = intakeText;
  }
  renderIntakePreview(pickIntakeTemplate(intakeText), intakeText);
}

function renderIntakePreview(template, text, analysis = null) {
  const previewProject = normalizeProject(clone(template.project));
  const firstOpp = previewProject.opportunities[0];
  const bottleneck =
    previewProject.processSteps.find((step) => step.tags.some((tag) => tag.toLowerCase() === "bottleneck")) ||
    previewProject.processSteps[0];
  document.querySelector("#intake-preview-title").textContent = `${template.label} workspace`;
  document.querySelector("#intake-confidence").textContent = text.trim() ? "High match" : "Waiting";
  document.querySelector("#intake-confidence").className = `status-pill ${text.trim() ? "green" : ""}`.trim();
  document.querySelector("#intake-preview").innerHTML = `
    <div class="intake-preview-grid">
      <div class="intake-preview-card">
        <strong>Client / workflow</strong>
        ${escapeHtml(previewProject.clientName)} - ${escapeHtml(previewProject.workflowName)}
      </div>
      <div class="intake-preview-card">
        <strong>Likely bottleneck</strong>
        ${escapeHtml(bottleneck.title)}: ${escapeHtml(bottleneck.pain)}
      </div>
      <div class="intake-preview-card">
        <strong>Best first pilot</strong>
        ${escapeHtml(firstOpp.name)} - ${escapeHtml(firstOpp.summary)}
      </div>
      <div class="intake-preview-card">
        <strong>Generated assets</strong>
        ${previewProject.processSteps.length} process steps, ${previewProject.agentWorkflow.length} agent steps, ${previewProject.tools.length} tools, ${previewProject.opportunities.length} opportunities.
      </div>
      ${
        analysis
          ? `<div class="intake-preview-card">
              <strong>Backend extraction</strong>
              ${escapeHtml(analysis.mode)}; schema ${analysis.schemaValid === false ? "needs fallback" : "valid"}; repair ${analysis.repairApplied ? "applied" : "not needed"}; ${analysis.extractedSystems.length} systems; ${analysis.extractedTimes.beforeTime || "?"} to ${analysis.extractedTimes.afterTime || "?"}.
            </div>`
          : ""
      }
    </div>
  `;
}

function loadIntakePreset(presetId) {
  const preset = intakePresets[presetId] || intakePresets.banking;
  document.querySelector("#intake-text").value = preset.sampleText;
  generateWorkspaceFromIntake();
}

function clearIntake() {
  document.querySelector("#intake-text").value = "";
  document.querySelector("#intake-preview-title").textContent = "No intake generated yet";
  document.querySelector("#intake-confidence").textContent = "Waiting";
  document.querySelector("#intake-confidence").className = "status-pill";
  document.querySelector("#intake-preview").textContent =
    "Choose a preset or paste your own process description. PRAXIS will infer the best first pilot.";
}

function renderLayers() {
  document.querySelector("#layer-grid").innerHTML = layers
    .map(
      (layer) => `
        <article class="layer-card">
          <h3>${badge(layer.id, layer.className)} ${layer.title}</h3>
          <p>${layer.copy}</p>
        </article>
      `,
    )
    .join("");
}

function renderProcess() {
  document.querySelector("#process-map").innerHTML = state.project.processSteps
    .map(
      (step, index) => `
        <article class="process-step">
          <div class="step-number">${String(index + 1).padStart(2, "0")}</div>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.pain)}</p>
          <div class="step-meta">
            <span><strong>Owner:</strong> ${escapeHtml(step.owner)}</span>
            <span><strong>System:</strong> ${escapeHtml(step.system)}</span>
            <span><strong>Time:</strong> ${escapeHtml(step.time)}</span>
          </div>
          <div class="tag-list">${step.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
      `,
    )
    .join("");
}

function renderProcessEditor() {
  document.querySelector("#process-editor").innerHTML = state.project.processSteps
    .map(
      (step, index) => `
        <article class="editor-step">
          <div class="step-number">${String(index + 1).padStart(2, "0")}</div>
          <label>
            Title
            <input data-step-field="title" data-step-index="${index}" value="${escapeHtml(step.title)}" />
          </label>
          <label>
            Owner
            <input data-step-field="owner" data-step-index="${index}" value="${escapeHtml(step.owner)}" />
          </label>
          <label>
            System
            <input data-step-field="system" data-step-index="${index}" value="${escapeHtml(step.system)}" />
          </label>
          <label>
            Time
            <input data-step-field="time" data-step-index="${index}" value="${escapeHtml(step.time)}" />
          </label>
          <button class="delete-button" data-delete-step="${index}" type="button">Delete</button>
          <label>
            Pain / note
            <textarea data-step-field="pain" data-step-index="${index}">${escapeHtml(step.pain)}</textarea>
          </label>
          <label>
            Tags
            <input data-step-field="tags" data-step-index="${index}" value="${escapeHtml(step.tags.join(", "))}" />
          </label>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-step-field]").forEach((field) => {
    field.addEventListener("change", updateProcessStep);
  });
  document.querySelectorAll("[data-delete-step]").forEach((button) => {
    button.addEventListener("click", () => deleteProcessStep(Number(button.dataset.deleteStep)));
  });
}

function updateProcessStep(event) {
  const index = Number(event.target.dataset.stepIndex);
  const field = event.target.dataset.stepField;
  const value = event.target.value.trim();
  if (field === "tags") {
    state.project.processSteps[index].tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  } else {
    state.project.processSteps[index][field] = value;
  }
  saveProject("Autosaved");
  renderProcess();
  renderContextGraph();
  renderReadout();
}

function addProcessStep() {
  state.project.processSteps.push({
    title: "New step",
    owner: "Owner",
    system: "System",
    pain: "Describe what happens here.",
    time: "0 min",
    tags: ["New"],
  });
  saveProject("Step added");
  renderProcess();
  renderProcessEditor();
  renderContextGraph();
}

function deleteProcessStep(index) {
  if (state.project.processSteps.length <= 1) return;
  state.project.processSteps.splice(index, 1);
  saveProject("Step deleted");
  renderProcess();
  renderProcessEditor();
  renderContextGraph();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function splitSystems(systemText) {
  return String(systemText || "")
    .split(/,|\/| and | & /i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildContextGraph() {
  const project = state.project;
  const roles = unique(project.processSteps.map((step) => step.owner));
  const systems = unique([
    ...project.processSteps.flatMap((step) => splitSystems(step.system)),
    ...project.connectors.map((connector) => connector.name),
    ...state.documents.flatMap((document) => document.systems),
  ]);
  const connectorHealth = getConnectorHealth();
  const documentHealth = getDocumentHealth();
  const bottleneck =
    project.processSteps.find((step) => step.tags.some((tag) => tag.toLowerCase() === "bottleneck")) ||
    project.processSteps[0];
  const selectedOpportunity =
    project.opportunities.find((opp) => opp.id === state.selectedOpportunity) || project.opportunities[0];
  const hasAudit = [...project.tools.map((tool) => `${tool.name} ${tool.code} ${tool.copy}`), ...project.processSteps.map((step) => `${step.title} ${step.pain} ${step.tags.join(" ")}`)]
    .join(" ")
    .toLowerCase()
    .includes("audit");

  const lanes = [
    {
      title: "People & owners",
      type: "person",
      nodes: [
        { name: project.clientName, detail: "Client organization and executive sponsor." },
        ...roles.map((role) => ({ name: role, detail: "Owns, approves, or operates part of the workflow." })),
      ],
    },
    {
      title: "Systems & records",
      type: "system",
      nodes: project.connectors.map((connector) => ({
        name: connector.name,
        detail: `${connector.type}; ${connector.access}; ${connector.dataClass}; ${connector.status}.`,
      })),
    },
    {
      title: "Agent tools",
      type: "tool",
      nodes: project.tools.map((tool) => ({
        name: tool.name,
        detail: tool.code,
      })),
    },
    {
      title: "Knowledge sources",
      type: "control",
      nodes: state.documents.slice(0, 8).map((document) => ({
        name: document.name,
        detail: `${document.chunkCount} chunks; ${document.systems.length} systems; ${document.keywords.slice(0, 3).join(", ") || "no keywords"}.`,
      })),
    },
    {
      title: "Controls & evals",
      type: "control",
      nodes: [
        { name: "Human review", detail: `${project.humanReview} of cases expected to stay in review.` },
        { name: "Eval gate", detail: `${project.evalCases.length} tests before production traffic.` },
        { name: "Audit trail", detail: hasAudit ? "Trace evidence exists in current workspace." : "Needs explicit trace or audit tool." },
        { name: "Bottleneck", detail: `${bottleneck.title}: ${bottleneck.pain}` },
      ],
    },
  ];

  const readiness = [
    {
      name: "Process context",
      ok: project.processSteps.length >= 5,
      detail: `${project.processSteps.length} workflow steps mapped. Production pilots usually need 5+ meaningful steps.`,
    },
    {
      name: "Connector readiness",
      ok: connectorHealth.ready,
      detail: `${project.connectors.length} sources mapped, ${connectorHealth.averageScore}% average readiness, ${connectorHealth.blocked} blocked.`,
    },
    {
      name: "Tool fabric",
      ok: project.tools.length >= 4 && project.tools.every((tool) => tool.code.includes("(")),
      detail: `${project.tools.length} agent-ready tools described with callable signatures.`,
    },
    {
      name: "Knowledge base",
      ok: documentHealth.ready,
      detail: `${documentHealth.count} documents, ${documentHealth.totalChunks} chunks, ${documentHealth.systems.length} systems found in docs.`,
    },
    {
      name: "Human-in-loop",
      ok: Number.parseInt(project.humanReview, 10) > 0 || project.humanReview.includes("100"),
      detail: `${project.humanReview} human review target keeps risk decisions accountable.`,
    },
    {
      name: "Auditability",
      ok: hasAudit,
      detail: hasAudit ? "Workspace includes audit/log/trace language." : "Add a trace or audit logging tool before production.",
    },
  ];

  return { lanes, readiness, bottleneck, selectedOpportunity, systems, roles, connectorHealth, documentHealth };
}

function renderContextGraph() {
  const graph = buildContextGraph();
  document.querySelector("#context-graph").innerHTML = graph.lanes
    .map(
      (lane) => `
        <section class="context-lane">
          <h3>${escapeHtml(lane.title)} <span class="context-count">${lane.nodes.length}</span></h3>
          <div class="context-node-list">
            ${lane.nodes
              .map(
                (node) => `
                  <article class="context-node ${lane.type}">
                    <strong>${escapeHtml(node.name)}</strong>
                    <span>${escapeHtml(node.detail)}</span>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");

  document.querySelector("#context-summary").innerHTML = `
    <article class="context-summary-card">
      <strong>First pilot</strong>
      <span>${escapeHtml(graph.selectedOpportunity.name)}: ${escapeHtml(graph.selectedOpportunity.summary)}</span>
    </article>
    <article class="context-summary-card">
      <strong>Primary bottleneck</strong>
      <span>${escapeHtml(graph.bottleneck.title)} - ${escapeHtml(graph.bottleneck.pain)}</span>
    </article>
    <article class="context-summary-card">
      <strong>Deployment surface</strong>
      <span>${graph.roles.length} owner groups, ${state.project.connectors.length} connectors, ${state.documents.length} documents, ${state.project.tools.length} tools, ${state.project.processSteps.length} workflow steps.</span>
    </article>
    <article class="context-summary-card">
      <strong>Why this matters</strong>
      <span>The agent should not reason from a prompt alone. It needs owners, records, tools, approvals, and tests wired into one graph.</span>
    </article>
  `;

  const readyCount = graph.readiness.filter((item) => item.ok).length;
  document.querySelector("#context-health").textContent = `${readyCount}/${graph.readiness.length} ready`;
  document.querySelector("#context-health").className = `status-pill ${readyCount >= 4 ? "green" : "amber"}`;
  document.querySelector("#context-readiness").innerHTML = graph.readiness
    .map(
      (item) => `
        <article class="readiness-item">
          <span class="readiness-dot ${item.ok ? "" : "warn"}">${item.ok ? "OK" : "!"}</span>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderConnectors() {
  const health = getConnectorHealth();
  document.querySelector("#connector-health").textContent = `${health.averageScore}% ready`;
  document.querySelector("#connector-health").className = `status-pill ${health.ready ? "green" : "amber"}`;

  const header = `
    <div class="connector-row header">
      <span>System</span>
      <span>Data class</span>
      <span>Access</span>
      <span>Refresh</span>
      <span>Readiness</span>
      <span>Status</span>
    </div>
  `;
  const rows = state.project.connectors
    .map((connector) => {
      const score = scoreConnector(connector);
      const ready = score >= 75 && connector.status !== "Blocked";
      return `
        <div class="connector-row">
          <strong>${escapeHtml(connector.name)}<span>${escapeHtml(connector.type)}</span></strong>
          <span class="data-class ${escapeHtml(connector.dataClass)}">${escapeHtml(connector.dataClass)}</span>
          <span>${escapeHtml(connector.access)}</span>
          <span>${escapeHtml(connector.refresh)}</span>
          ${scoreBar(score)}
          <span class="tool-status ${ready ? "ready" : "warn"}">${escapeHtml(connector.status)}</span>
        </div>
      `;
    })
    .join("");
  document.querySelector("#connector-board").innerHTML = header + rows;

  const flowSteps = [
    {
      title: "1. Connect",
      copy: `${state.project.connectors.length} systems identified from the client workflow.`,
      metric: `${health.blocked} blocked`,
    },
    {
      title: "2. Mask",
      copy: `${health.sensitive} sources contain sensitive, confidential, or regulated data.`,
      metric: "PII controls",
    },
    {
      title: "3. Index",
      copy: "Approved records become searchable chunks, tables, or tool responses for the agent.",
      metric: "Context ready",
    },
    {
      title: "4. Prove",
      copy: "Historic cases test whether retrieved evidence matches human decisions before go-live.",
      metric: `${state.project.evalCases.length} evals`,
    },
  ];
  document.querySelector("#ingestion-flow").innerHTML = flowSteps
    .map(
      (step) => `
        <article class="ingestion-step">
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.copy)}</p>
          <span>${escapeHtml(step.metric)}</span>
        </article>
      `,
    )
    .join("");

  const riskBuckets = ["PII", "Confidential", "Regulated", "Internal"].map((bucket) => {
    const items = state.project.connectors.filter((connector) => connector.dataClass === bucket);
    return { bucket, items };
  });
  document.querySelector("#connector-risk-map").innerHTML = riskBuckets
    .map(
      ({ bucket, items }) => `
        <article class="risk-bucket">
          <div>
            <strong>${escapeHtml(bucket)}</strong>
            <span>${items.length} source${items.length === 1 ? "" : "s"}</span>
          </div>
          <p>${items.length ? items.map((item) => item.name).join(", ") : "None mapped yet"}</p>
        </article>
      `,
    )
    .join("");

  document.querySelector("#connector-editor").innerHTML = state.project.connectors
    .map(
      (connector, index) => `
        <article class="connector-editor-card">
          <label>
            System
            <input data-connector-field="name" data-connector-index="${index}" value="${escapeHtml(connector.name)}" />
          </label>
          <label>
            Type
            <select data-connector-field="type" data-connector-index="${index}">
              ${["Workflow app", "Data warehouse", "Customer record", "Document store", "Enterprise system"]
                .map((type) => `<option value="${type}" ${connector.type === type ? "selected" : ""}>${type}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Owner
            <input data-connector-field="owner" data-connector-index="${index}" value="${escapeHtml(connector.owner)}" />
          </label>
          <label>
            Access
            <select data-connector-field="access" data-connector-index="${index}">
              ${["Read-only sandbox", "Read-only pending", "User delegated", "Write with approval", "No access"]
                .map((access) => `<option value="${access}" ${connector.access === access ? "selected" : ""}>${access}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Data class
            <select data-connector-field="dataClass" data-connector-index="${index}">
              ${["Internal", "Confidential", "PII", "Regulated"]
                .map((dataClass) => `<option value="${dataClass}" ${connector.dataClass === dataClass ? "selected" : ""}>${dataClass}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Status
            <select data-connector-field="status" data-connector-index="${index}">
              ${["Sandbox ready", "Production ready", "Needs approval", "Blocked"]
                .map((status) => `<option value="${status}" ${connector.status === status ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Refresh
            <select data-connector-field="refresh" data-connector-index="${index}">
              ${["Realtime", "Hourly", "Daily", "Manual export"]
                .map((refresh) => `<option value="${refresh}" ${connector.refresh === refresh ? "selected" : ""}>${refresh}</option>`)
                .join("")}
            </select>
          </label>
          <button class="delete-button" data-delete-connector="${index}" type="button">Delete</button>
          <label class="span-2">
            Records
            <input data-connector-field="records" data-connector-index="${index}" value="${escapeHtml(connector.records)}" />
          </label>
          <label class="span-2">
            Purpose
            <textarea data-connector-field="purpose" data-connector-index="${index}">${escapeHtml(connector.purpose)}</textarea>
          </label>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-connector-field]").forEach((field) => {
    field.addEventListener("change", updateConnector);
  });
  document.querySelectorAll("[data-delete-connector]").forEach((button) => {
    button.addEventListener("click", () => deleteConnector(Number(button.dataset.deleteConnector)));
  });
}

function updateConnector(event) {
  const index = Number(event.target.dataset.connectorIndex);
  const field = event.target.dataset.connectorField;
  state.project.connectors[index][field] = event.target.value.trim();
  saveProject("Connector updated");
  renderConnectors();
  renderContextGraph();
  renderDeploymentPlan();
  renderReadout();
}

function addConnector() {
  state.project.connectors.push({
    name: "New source system",
    type: "Enterprise system",
    owner: "System owner",
    access: "Read-only pending",
    dataClass: "Internal",
    status: "Needs approval",
    refresh: "Daily",
    records: "Workflow records",
    purpose: `Feeds ${state.project.workflowName} with additional operational context.`,
  });
  saveProject("Connector added");
  renderConnectors();
  renderContextGraph();
  renderDeploymentPlan();
  renderReadout();
}

function deleteConnector(index) {
  if (state.project.connectors.length <= 1) return;
  state.project.connectors.splice(index, 1);
  saveProject("Connector deleted");
  renderConnectors();
  renderContextGraph();
  renderDeploymentPlan();
  renderReadout();
}

function getDocumentHealth() {
  const totalChunks = state.documents.reduce((sum, document) => sum + document.chunkCount, 0);
  const systems = unique(state.documents.flatMap((document) => document.systems));
  const riskDocs = state.documents.filter((document) => document.signals.hasRiskLanguage || document.signals.hasPiiLanguage).length;
  return {
    count: state.documents.length,
    totalChunks,
    systems,
    riskDocs,
    ready: state.documents.length > 0 && totalChunks > 0,
  };
}

function renderDocuments() {
  const health = getDocumentHealth();
  document.querySelector("#document-health").textContent = health.ready ? `${health.count} docs indexed` : "No documents";
  document.querySelector("#document-health").className = `status-pill ${health.ready ? "green" : ""}`.trim();

  const query = state.documentSearch.toLowerCase().trim();
  const filtered = state.documents.filter((document) =>
    [document.name, document.summary, document.systems.join(" "), document.keywords.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );

  document.querySelector("#document-insights").innerHTML = `
    <article class="document-insight-card">
      <span>Documents</span>
      <strong>${health.count}</strong>
      <p>${health.totalChunks} searchable chunks prepared for retrieval.</p>
    </article>
    <article class="document-insight-card">
      <span>Systems found</span>
      <strong>${health.systems.length}</strong>
      <p>${health.systems.length ? health.systems.join(", ") : "Upload client docs to discover systems."}</p>
    </article>
    <article class="document-insight-card">
      <span>Risk-bearing docs</span>
      <strong>${health.riskDocs}</strong>
      <p>Docs with policy, approval, regulated, audit, PII, or customer language.</p>
    </article>
  `;

  document.querySelector("#document-list").innerHTML = filtered.length
    ? filtered
        .map(
          (document) => `
            <article class="document-card">
              <div>
                <h3>${escapeHtml(document.name)}</h3>
                <p>${escapeHtml(document.summary)}</p>
                <div class="tag-list">
                  <span class="tag">${escapeHtml(document.sourceType)}</span>
                  <span class="tag">${document.wordCount.toLocaleString()} words</span>
                  <span class="tag">${document.chunkCount} chunks</span>
                  ${document.systems.slice(0, 4).map((system) => `<span class="tag">${escapeHtml(system)}</span>`).join("")}
                </div>
              </div>
              <div class="document-card-side">
                <strong>${escapeHtml(document.templateKey)}</strong>
                <span>${escapeHtml(document.keywords.slice(0, 5).join(", ") || "No keywords yet")}</span>
                <button class="delete-button" data-delete-document="${escapeHtml(document.id)}" type="button">Delete</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<article class="empty-state">No matching documents yet.</article>`;

  document.querySelectorAll("[data-delete-document]").forEach((button) => {
    button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument));
  });
}

async function ingestDocument(name, content, sourceType = "pasted") {
  const cleanContent = String(content || "").trim();
  if (!cleanContent) {
    setStorageStatus("Document is empty", "amber");
    return;
  }
  try {
    const response = await apiRequest("/documents", {
      method: "POST",
      body: JSON.stringify({ name, content: cleanContent, sourceType }),
    });
    state.documents = [normalizeDocument(response.document), ...state.documents.filter((document) => document.id !== response.document.id)];
    state.backendOnline = true;
    setStorageStatus("Document ingested", "green");
  } catch (error) {
    console.info("Backend document ingestion unavailable; using browser fallback", error);
    state.documents = [createLocalDocument(name, cleanContent, sourceType), ...state.documents];
    setStorageStatus("Document saved locally", "amber");
  }
  saveDocumentsLocal();
  renderDocuments();
  renderContextGraph();
  refreshRetrievalEvidence();
  renderReadout();
}

async function ingestPastedDocument() {
  const nameInput = document.querySelector("#document-name");
  const textArea = document.querySelector("#document-text");
  await ingestDocument(nameInput.value.trim() || "Pasted client document", textArea.value, "pasted");
  nameInput.value = "";
  textArea.value = "";
}

async function ingestDocumentFiles(event) {
  const files = [...(event.target.files || [])];
  for (const file of files) {
    const content = await file.text();
    await ingestDocument(file.name, content, "file");
  }
  event.target.value = "";
}

async function deleteDocument(documentId) {
  state.documents = state.documents.filter((document) => document.id !== documentId);
  saveDocumentsLocal();
  try {
    await apiRequest(`/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
    setStorageStatus("Document deleted", "green");
  } catch (error) {
    console.info("Backend document delete skipped", error);
    setStorageStatus("Document deleted locally", "amber");
  }
  renderDocuments();
  renderContextGraph();
  refreshRetrievalEvidence();
  renderReadout();
}

function renderOpportunityTable() {
  const header = `
    <div class="opp-row header">
      <span>Workflow</span>
      <span>Impact</span>
      <span>Risk</span>
      <span>Complexity</span>
      <span>Data</span>
      <span>API</span>
      <span></span>
    </div>
  `;

  const rows = state.project.opportunities
    .map(
      (opp) => `
        <div class="opp-row">
          <strong>${escapeHtml(opp.name)}</strong>
          ${scoreBar(opp.impact)}
          ${scoreBar(100 - opp.risk)}
          ${scoreBar(100 - opp.complexity)}
          ${scoreBar(opp.data)}
          ${scoreBar(opp.api)}
          <button class="select-button ${state.selectedOpportunity === opp.id ? "active" : ""}" data-opp="${opp.id}">
            Select
          </button>
        </div>
      `,
    )
    .join("");

  document.querySelector("#opportunity-table").innerHTML = header + rows;
  document.querySelectorAll("[data-opp]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOpportunity = button.dataset.opp;
      renderOpportunityTable();
      renderSelectedOpportunity();
    });
  });
}

function scoreBar(value) {
  return `<span class="score" title="${value}%"><span style="width:${value}%"></span></span>`;
}

function renderSelectedOpportunity() {
  const opp =
    state.project.opportunities.find((item) => item.id === state.selectedOpportunity) ||
    state.project.opportunities[0];
  state.selectedOpportunity = opp.id;
  document.querySelector("#selected-opportunity").innerHTML = `
    <div>
      <div class="eyebrow">Selected pilot</div>
      <h2>${escapeHtml(opp.name)}</h2>
      <p>${escapeHtml(opp.summary)}</p>
      <ul class="check-list">
        <li>Start with a narrow workflow and keep a human approver in the loop.</li>
        <li>Use historic cases as eval data before production traffic.</li>
        <li>Turn the finished pilot into a reusable playbook for the next client.</li>
      </ul>
    </div>
    <div>
      <div class="eyebrow">Modules involved</div>
      <h3>PRAXIS activation path</h3>
      <div class="tag-list">
        ${opp.modules.map((module) => `<span class="tag">${escapeHtml(module)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderWorkflow() {
  document.querySelector("#workflow-canvas").innerHTML = state.project.agentWorkflow
    .map(
      (step, index) => `
        <article class="workflow-step">
          <div class="step-number">${String(index + 1).padStart(2, "0")}</div>
          <h3>${badge(step.layer, step.className)} ${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.copy)}</p>
          <div class="step-meta">
            <span><strong>Timing:</strong> ${escapeHtml(step.timing)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTools() {
  document.querySelector("#tool-grid").innerHTML = state.project.tools
    .map(
      (tool) => `
        <article class="tool-card">
          <h3>${escapeHtml(tool.name)}</h3>
          <code>${escapeHtml(tool.code)}</code>
          <p>${escapeHtml(tool.copy)}</p>
        </article>
      `,
    )
    .join("");
}

function renderToolFabric() {
  const toolScores = state.project.tools.map((tool) => ({ tool, score: scoreTool(tool) }));
  const averageScore = Math.round(toolScores.reduce((sum, item) => sum + item.score, 0) / Math.max(1, toolScores.length));
  document.querySelector("#fabric-health").textContent = `${averageScore}% ready`;
  document.querySelector("#fabric-health").className = `status-pill ${averageScore >= 75 ? "green" : "amber"}`;

  const header = `
    <div class="tool-row header">
      <span>Tool</span>
      <span>Callable contract</span>
      <span>Auth</span>
      <span>Readiness</span>
      <span>Status</span>
    </div>
  `;
  const rows = toolScores
    .map(({ tool, score }) => {
      const ready = score >= 75;
      return `
        <div class="tool-row">
          <strong>${escapeHtml(tool.name)}</strong>
          <code>${escapeHtml(tool.code)}</code>
          <span>${escapeHtml(tool.auth)}</span>
          ${scoreBar(score)}
          <span class="tool-status ${ready ? "ready" : "warn"}">${ready ? "Ready" : "Needs work"}</span>
        </div>
      `;
    })
    .join("");
  document.querySelector("#tool-readiness").innerHTML = header + rows;

  document.querySelector("#tool-editor").innerHTML = state.project.tools
    .map(
      (tool, index) => `
        <article class="tool-editor-card">
          <label>
            Name
            <input data-tool-field="name" data-tool-index="${index}" value="${escapeHtml(tool.name)}" />
          </label>
          <label>
            Callable signature
            <input data-tool-field="code" data-tool-index="${index}" value="${escapeHtml(tool.code)}" />
          </label>
          <label>
            Owner
            <input data-tool-field="owner" data-tool-index="${index}" value="${escapeHtml(tool.owner)}" />
          </label>
          <label>
            Auth model
            <select data-tool-field="auth" data-tool-index="${index}">
              ${["Read-only service", "User delegated", "Service account + approval", "Human approval only"]
                .map((auth) => `<option value="${auth}" ${tool.auth === auth ? "selected" : ""}>${auth}</option>`)
                .join("")}
            </select>
          </label>
          <label>
            Risk
            <select data-tool-field="risk" data-tool-index="${index}">
              ${["Low", "Medium", "High"]
                .map((risk) => `<option value="${risk}" ${tool.risk === risk ? "selected" : ""}>${risk}</option>`)
                .join("")}
            </select>
          </label>
          <button class="delete-button" data-delete-tool="${index}" type="button">Delete</button>
          <label class="span-2">
            Description
            <textarea data-tool-field="copy" data-tool-index="${index}">${escapeHtml(tool.copy)}</textarea>
          </label>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-tool-field]").forEach((field) => {
    field.addEventListener("change", updateTool);
  });
  document.querySelectorAll("[data-delete-tool]").forEach((button) => {
    button.addEventListener("click", () => deleteTool(Number(button.dataset.deleteTool)));
  });

  document.querySelector("#tool-manifest").textContent = JSON.stringify(buildToolManifest(averageScore), null, 2);
  document.querySelector("#mcp-server-preview").textContent =
    state.mcpServerCode || "// Click Generate server to create an MCP server scaffold from these tools.";
  renderToolSandbox();
}

function buildToolManifest(readinessScore) {
  return {
    name: `${state.project.workflowName} tool fabric`,
    client: state.project.clientName,
    readinessScore,
    humanReview: state.project.humanReview,
    tools: state.project.tools.map((tool) => ({
      name: tool.name,
      callable: tool.code,
      description: tool.copy,
      owner: tool.owner,
      auth: tool.auth,
      risk: tool.risk,
      readiness: scoreTool(tool),
      guardrails: [
        tool.risk === "High" ? "human_approval_required" : "log_every_call",
        String(tool.auth || "").includes("User") ? "respect_user_permissions" : "service_scope_required",
        "record_inputs_outputs_and_source_context",
      ],
    })),
  };
}

function renderToolSandbox() {
  const target = document.querySelector("#tool-sandbox");
  if (!target) return;
  const report = state.toolSandbox || buildToolSandboxReportLocal();
  const counts = report.counts || { pass: 0, warn: 0, fail: 0 };
  const results = Array.isArray(report.results) ? report.results : [];
  target.innerHTML = `
    <div class="sandbox-summary ${report.readyForAgentRuntime ? "ready" : "blocked"}">
      <div>
        <span>Sandbox status</span>
        <strong>${report.readyForAgentRuntime ? "Agent-ready" : "Needs fixes"}</strong>
        <p>${counts.pass || 0} pass · ${counts.warn || 0} warn · ${counts.fail || 0} fail · ${results.length} tools tested</p>
      </div>
      <div>
        <span>Failure catalog</span>
        <strong>${(report.failureCatalog || []).length}</strong>
        <p>${(report.failureCatalog || []).slice(0, 5).join(", ") || "No active failure modes"}</p>
      </div>
    </div>
    <div class="sandbox-results">
      ${
        results.length
          ? results
              .map(
                (result) => `
                  <article class="sandbox-card ${escapeHtml(result.status)}">
                    <div class="sandbox-card-head">
                      <strong>${escapeHtml(result.name)}</strong>
                      <span class="tool-status ${result.status === "pass" ? "ready" : "warn"}">${escapeHtml(result.status)}</span>
                    </div>
                    <code>${escapeHtml(result.callable || "missing contract")}</code>
                    <p>${escapeHtml(result.sampleResponse?.message || "Sandbox probe completed.")}</p>
                    <div class="sandbox-meta">
                      <span>${result.readiness}% ready</span>
                      <span>${result.latencyMs}ms dry-run</span>
                      <span>${escapeHtml(result.auth)}</span>
                      <span>${escapeHtml(result.risk)} risk</span>
                    </div>
                    <ul>
                      ${
                        result.failureModes?.length
                          ? result.failureModes
                              .slice(0, 4)
                              .map((failure) => `<li><strong>${escapeHtml(failure.code)}</strong>: ${escapeHtml(failure.detail)}</li>`)
                              .join("")
                          : "<li>Contract, owner, auth, approval, and failure-mode checks passed.</li>"
                      }
                    </ul>
                  </article>
                `,
              )
              .join("")
          : `<article class="sandbox-card warn"><strong>No tools</strong><p>Add tools before running sandbox.</p></article>`
      }
    </div>
  `;
}

async function runToolSandbox() {
  const button = document.querySelector("#run-tool-sandbox");
  button.disabled = true;
  button.textContent = "Running";
  try {
    const response = await apiRequest("/tools/sandbox", {
      method: "POST",
      body: JSON.stringify({ project: state.project }),
    });
    state.toolSandbox = response.sandbox || buildToolSandboxReportLocal();
    state.backendOnline = true;
    setStorageStatus(
      state.toolSandbox.readyForAgentRuntime ? "Tool sandbox passed" : "Tool sandbox found blockers",
      state.toolSandbox.readyForAgentRuntime ? "green" : "amber",
    );
  } catch (error) {
    console.info("Backend tool sandbox unavailable; using local probe", error);
    state.toolSandbox = buildToolSandboxReportLocal();
    state.backendOnline = false;
    setStorageStatus("Tool sandbox ran locally", state.toolSandbox.readyForAgentRuntime ? "green" : "amber");
  } finally {
    button.disabled = false;
    button.textContent = "Run sandbox";
    renderToolSandbox();
    renderPilotRunConsole();
    renderDeploymentPlan();
    renderReadout();
  }
}

function generateMcpServerCodeLocal() {
  const registrations = state.project.tools
    .map((tool) => {
      const toolName = (tool.name || tool.code || "tool")
        .replace(/\([^)]*\)/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase() || "tool";
      return `server.tool(
  "${toolName}",
  \`${(tool.copy || "Generated from PRAXIS Tool Fabric.").replace(/`/g, "\\`")}\`,
  { input: z.any().optional() },
  async ({ input }) => {
    // TODO: Wire ${tool.name} to the real enterprise API.
    // Contract: ${tool.code}
    // Auth: ${tool.auth}
    // Risk: ${tool.risk}
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: false, message: "Tool stub not connected yet", input }, null, 2) }]
    };
  }
);`;
    })
    .join("\n\n");

  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "${state.project.workflowName} MCP Server",
  version: "0.1.0"
});

${registrations}

const transport = new StdioServerTransport();
await server.connect(transport);
`;
}

async function generateMcpServer() {
  const button = document.querySelector("#generate-mcp-server");
  button.disabled = true;
  button.textContent = "Generating";
  try {
    const response = await apiRequest("/mcp/generate", {
      method: "POST",
      body: JSON.stringify({ project: state.project }),
    });
    state.mcpServerCode = response.code || "";
    state.backendOnline = true;
    setStorageStatus(`MCP server scaffold generated for ${response.toolCount || state.project.tools.length} tools`, "green");
  } catch (error) {
    console.info("Backend MCP generator unavailable; using browser generator", error);
    state.mcpServerCode = generateMcpServerCodeLocal();
    state.backendOnline = false;
    setStorageStatus("MCP server scaffold generated locally", "green");
  } finally {
    button.disabled = false;
    button.textContent = "Generate server";
    renderToolFabric();
  }
}

function updateTool(event) {
  const index = Number(event.target.dataset.toolIndex);
  const field = event.target.dataset.toolField;
  state.project.tools[index][field] = event.target.value.trim();
  state.toolSandbox = null;
  saveProject("Tool updated");
  renderTools();
  renderToolFabric();
  renderContextGraph();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function addTool() {
  state.project.tools.push({
    name: "New Tool",
    code: "newTool(input)",
    copy: "Describe what this tool does, when it is safe to call, and what it returns.",
    owner: "API owner",
    auth: "Read-only service",
    risk: "Low",
  });
  state.toolSandbox = null;
  saveProject("Tool added");
  renderTools();
  renderToolFabric();
  renderContextGraph();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function deleteTool(index) {
  if (state.project.tools.length <= 1) return;
  state.project.tools.splice(index, 1);
  state.toolSandbox = null;
  saveProject("Tool deleted");
  renderTools();
  renderToolFabric();
  renderContextGraph();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function generateToolsFromOpenApiLocal(spec = {}) {
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
        const risk = ["post", "put", "patch", "delete"].includes(method.toLowerCase()) ? "High" : "Medium";
        return {
          name: operation.summary || operationId,
          code: `${operationId}(${parameters.join(", ")})`,
          copy: operation.description || operation.summary || `${method.toUpperCase()} ${path} from imported OpenAPI spec.`,
          owner: spec.info?.title || "API owner",
          auth: risk === "High" ? "Service account + approval" : "Read-only service",
          risk,
        };
      }),
  );
}

async function importOpenApiTools() {
  const textarea = document.querySelector("#openapi-input");
  const raw = textarea.value.trim();
  if (!raw) {
    setStorageStatus("Paste OpenAPI JSON first", "amber");
    return;
  }
  try {
    let toolsFromSpec = [];
    try {
      const response = await apiRequest("/openapi/import", {
        method: "POST",
        body: JSON.stringify({ spec: raw }),
      });
      toolsFromSpec = response.tools || [];
    } catch (error) {
      console.info("Backend OpenAPI import unavailable; using browser parser", error);
      toolsFromSpec = generateToolsFromOpenApiLocal(JSON.parse(raw));
    }
    if (!toolsFromSpec.length) {
      setStorageStatus("No tools found in spec", "amber");
      return;
    }
    state.project.tools = [...state.project.tools, ...toolsFromSpec].map((tool) => ({
      name: tool.name || "Imported tool",
      code: tool.code || "importedTool()",
      copy: tool.copy || "Imported from OpenAPI.",
      owner: tool.owner || inferToolOwner(tool),
      auth: tool.auth || inferToolAuth(tool),
      risk: tool.risk || inferToolRisk(tool),
    }));
    state.toolSandbox = null;
    textarea.value = "";
    saveProject(`${toolsFromSpec.length} tools imported`);
    renderTools();
    renderToolFabric();
    renderContextGraph();
    renderPilotRunConsole();
    renderDeploymentPlan();
    renderReadout();
  } catch (error) {
    console.warn("Could not import OpenAPI", error);
    setStorageStatus("OpenAPI import failed", "amber");
  }
}

function buildPilotRun() {
  const project = state.project;
  const retrievalResults = state.retrieval.results.length ? state.retrieval.results : searchLocalDocumentChunks(buildRetrievalQuery(), 4);
  const connectorHealth = getConnectorHealth();
  const toolAverage = Math.round(project.tools.reduce((sum, tool) => sum + scoreTool(tool), 0) / Math.max(1, project.tools.length));
  const governance = getGovernanceHealth();
  const failedCritical = project.evalCases.some((test) => test.severity === "Critical" && test.result === "fail");
  const pendingEvals = project.evalCases.filter((test) => test.result === "pending").length;
  const bottleneck =
    project.processSteps.find((step) => step.tags.some((tag) => tag.toLowerCase() === "bottleneck")) ||
    project.processSteps[0];
  const readableConnectors = project.connectors.filter((connector) => connector.status !== "Blocked").slice(0, 4);
  const callableTools = project.tools.filter((tool) => scoreTool(tool) >= 65).slice(0, 4);
  const approvalGate = project.governance.approvals.find((approval) => approval.status !== "Approved") || project.governance.approvals[0];
  const confidence = Math.max(
    35,
    Math.min(96, Math.round((connectorHealth.averageScore * 0.3) + (toolAverage * 0.3) + (governance.score * 0.25) + ((state.evalsRun ? 90 : 60) * 0.15))),
  );
  const outcome = failedCritical
    ? "Blocked by critical eval"
    : pendingEvals > 0
      ? "Ready for sandbox, not production"
      : governance.ready
        ? "Ready for controlled pilot"
        : "Needs approval before go-live";

  const trace = [
    {
      layer: "Trigger",
      title: `${project.workflowName} case arrives`,
      detail: `A new case enters ${bottleneck.system}. PRAXIS creates a run ID and starts a trace before any model call.`,
      status: "Logged",
    },
    {
      layer: "L1",
      title: "Retrieve source context",
      detail: `${readableConnectors.length} connector${readableConnectors.length === 1 ? "" : "s"} return records: ${readableConnectors.map((item) => item.name).join(", ") || "none yet"}.`,
      status: connectorHealth.blocked ? "Partial" : "Ready",
    },
    {
      layer: "L2",
      title: "Call safe tools",
      detail: `${callableTools.length} callable tool${callableTools.length === 1 ? "" : "s"} run with scoped auth and logged inputs.`,
      status: toolAverage >= 75 ? "Ready" : "Needs work",
    },
    {
      layer: "L3",
      title: "Draft agent answer",
      detail: `Agent follows ${project.agentWorkflow.length} workflow steps and prepares evidence, recommendation, and uncertainty notes.`,
      status: `${confidence}% confidence`,
    },
    {
      layer: "L4",
      title: "Run eval gate",
      detail: pendingEvals ? `${pendingEvals} eval case${pendingEvals === 1 ? "" : "s"} still pending. Run evals before production.` : "Regression checks already have latest results.",
      status: failedCritical ? "Fail" : pendingEvals ? "Pending" : "Checked",
    },
    {
      layer: "L5",
      title: "Route human approval",
      detail: `${approvalGate.gate} goes to ${approvalGate.approver}. Risky or low-confidence output stays reviewable.`,
      status: approvalGate.status,
    },
    {
      layer: "Audit",
      title: "Store trace",
      detail: `${project.governance.auditEvents.length} audit events are recorded for this run.`,
      status: governance.auditCoverage ? "Complete" : "Incomplete",
    },
  ];

  return {
    caseId: `PX-${project.workflowName.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}-${String(project.connectors.length + project.tools.length + project.evalCases.length).padStart(3, "0")}`,
    confidence,
    outcome,
    bottleneck,
    readableConnectors,
    callableTools,
    approvalGate,
    connectorHealth,
    toolAverage,
    governance,
    retrievalResults,
    trace,
  };
}

function normalizeAgentRuntimeRun(run) {
  return {
    ...run,
    caseId: run.id || run.caseId,
    bottleneck: run.bottleneck || state.project.processSteps[0],
    readableConnectors: run.readableConnectors || [],
    callableTools: run.callableTools || [],
    approvalGate: run.approvalGate || state.project.governance.approvals[0],
    connectorHealth: run.connectorHealth || getConnectorHealth(),
    toolAverage: run.toolAverage || 0,
    governance: run.governance || getGovernanceHealth(),
    runtimeStateMachine: run.runtimeStateMachine || null,
    retrievalResults: run.retrievalResults || [],
    trace: run.trace || [],
  };
}

function renderPilotRunConsole() {
  const run = state.agentRuntimeRun ? normalizeAgentRuntimeRun(state.agentRuntimeRun) : buildPilotRun();
  const pilotReady = run.connectorHealth.ready && run.toolAverage >= 75 && run.governance.score >= 70;
  document.querySelector("#pilot-health").textContent = pilotReady ? "Runnable" : "Guarded";
  document.querySelector("#pilot-health").className = `status-pill ${pilotReady ? "green" : "amber"}`;

  document.querySelector("#pilot-summary").innerHTML = `
    <article>
      <span>Run ID</span>
      <strong>${escapeHtml(run.caseId)}</strong>
    </article>
    <article>
      <span>Outcome</span>
      <strong>${escapeHtml(run.outcome)}</strong>
    </article>
    <article>
      <span>Confidence</span>
      <strong>${run.confidence}%</strong>
    </article>
    <article>
      <span>Human gate</span>
      <strong>${escapeHtml(run.approvalGate.gate)}</strong>
    </article>
    ${
      run.latencyMs
        ? `
          <article>
            <span>Runtime</span>
            <strong>${run.latencyMs}ms / $${Number(run.estimatedCostUsd || 0).toFixed(3)}</strong>
          </article>
        `
        : ""
    }
    ${
      run.runtimeStateMachine
        ? `
          <article>
            <span>State machine</span>
            <strong>${escapeHtml(run.runtimeStateMachine.status)} · ${run.runtimeStateMachine.retryCount} retries</strong>
          </article>
        `
        : ""
    }
  `;

  document.querySelector("#pilot-trace").innerHTML = run.trace
    .map(
      (step, index) => `
        <article class="trace-step">
          <div class="trace-index">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <h3><span>${escapeHtml(step.layer)}</span>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.detail)}${step.retryPolicy ? ` Attempt ${Number(step.attempt || 1)}/${Number(step.maxAttempts || 1)}; ${escapeHtml(step.retryPolicy)}.` : ""}</p>
          </div>
          <strong>${escapeHtml(step.status)}</strong>
        </article>
      `,
    )
    .join("");

  document.querySelector("#evidence-packet").innerHTML = `
    <article class="evidence-card">
      <strong>Source records</strong>
      <p>${run.readableConnectors.map((connector) => `${connector.name} (${connector.records})`).join("; ") || "No readable connectors yet."}</p>
    </article>
    <article class="evidence-card">
      <strong>Retrieved document evidence</strong>
      <p>${
        run.retrievalResults.length
          ? run.retrievalResults
              .slice(0, 3)
              .map((item) => `${item.citation.documentName} / ${item.citation.chunkId}: ${item.citation.text.slice(0, 180)}${item.citation.text.length > 180 ? "..." : ""}`)
              .join(" ")
          : "No document citations yet. Add policy docs, API docs, or meeting notes in Knowledge Base."
      }</p>
    </article>
    <article class="evidence-card">
      <strong>Tool outputs</strong>
      <p>${
        run.callableTools
          .map((tool) => `${tool.name}: ${tool.code}${tool.risk ? ` (${tool.risk} risk)` : ""}`)
          .join("; ") || "No callable tools are ready yet."
      }</p>
    </article>
    <article class="evidence-card">
      <strong>Workflow bottleneck</strong>
      <p>${escapeHtml(run.bottleneck.title)}: ${escapeHtml(run.bottleneck.pain)}</p>
    </article>
  `;

  document.querySelector("#decision-audit").innerHTML = `
    <article class="decision-card">
      <strong>Decision boundary</strong>
      <p>${
        run.decision?.recommendation
          ? escapeHtml(run.decision.recommendation)
          : "The agent prepares work. A human still owns regulated, high-risk, or irreversible decisions."
      }</p>
    </article>
    <article class="decision-card">
      <strong>Approval route</strong>
      <p>${escapeHtml(run.approvalGate.approver)} reviews ${escapeHtml(run.approvalGate.gate)}. Current status: ${escapeHtml(run.approvalGate.status)}.</p>
    </article>
    <article class="decision-card">
      <strong>Audit payload</strong>
      <p>${(run.audit?.events || state.project.governance.auditEvents).map((event) => escapeHtml(event)).join("; ")}.</p>
    </article>
    <article class="decision-card">
      <strong>Runtime gate</strong>
      <p>${run.requiresHumanReview ? "Human review required before downstream action." : "No blocking review gate for controlled action draft."}</p>
    </article>
  `;
  renderRunHistory();
}

function renderRunHistory() {
  const target = document.querySelector("#run-history");
  if (!target) return;
  const runs = Array.isArray(state.runs) ? state.runs.slice(0, 8) : [];
  if (!runs.length) {
    target.innerHTML = `
      <article class="run-history-card empty">
        <strong>No saved runs yet</strong>
        <p>Run the backend Agent Runtime or press Save run to create the first replayable trace.</p>
      </article>
    `;
    return;
  }
  target.innerHTML = runs
    .map((savedRun) => {
      const payload = savedRun.payload || savedRun;
      const trace = payload.trace || savedRun.trace || [];
      const evidenceCount = payload.retrievalResults?.length || 0;
      const toolCount = payload.callableTools?.length || 0;
      const review = payload.requiresHumanReview ? "Human review" : "No review gate";
      return `
        <article class="run-history-card">
          <div>
            <strong>${escapeHtml(savedRun.workflowName || payload.workflowName || "Pilot run")}</strong>
            <p>${escapeHtml(savedRun.id || payload.id || "local-run")} · ${new Date(savedRun.createdAt || payload.createdAt || Date.now()).toLocaleString()}</p>
          </div>
          <span>${escapeHtml(savedRun.outcome || payload.outcome || "Recorded")}</span>
          <span>${Number(savedRun.confidence || payload.confidence || 0)}% confidence</span>
          <span>${trace.length} trace steps</span>
          <span>${evidenceCount} evidence · ${toolCount} tools</span>
          <span>${review}</span>
        </article>
      `;
    })
    .join("");
}

function renderHandoffQueue() {
  const board = document.querySelector("#handoff-board");
  if (!board) return;
  renderHandoffAlerts();
  const handoffs = [...state.handoffs].sort((a, b) => {
    const statusRank = { Pending: 0, Escalated: 1, Blocked: 2, Approved: 3 };
    return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || new Date(a.dueAt) - new Date(b.dueAt);
  });
  board.innerHTML = handoffs.length
    ? handoffs
        .map(
          (handoff) => `
            <article class="handoff-card ${escapeHtml(handoff.status.toLowerCase())}">
              <div class="handoff-main">
                <div class="handoff-topline">
                  <span class="severity-pill ${escapeHtml(handoff.priority === "High" ? "High" : "Medium")}">${escapeHtml(handoff.priority)}</span>
                  <span class="handoff-status">${escapeHtml(handoff.status)}</span>
                  <span class="tag">Due ${escapeHtml(formatDate(handoff.dueAt))}</span>
                </div>
                <h3>${escapeHtml(handoff.gate)}</h3>
                <p>${escapeHtml(handoff.recommendation)}</p>
                <div class="handoff-meta">
                  <span><strong>Approver:</strong> ${escapeHtml(handoff.approver)}</span>
                  <span><strong>Run:</strong> ${escapeHtml(handoff.runId)}</span>
                  <span><strong>Confidence:</strong> ${handoff.confidence}%</span>
                  <span><strong>Evidence:</strong> ${handoff.evidenceCount} chunks / ${handoff.toolCount} tools</span>
                </div>
                ${handoff.reviewerNotes ? `<p class="handoff-notes">${escapeHtml(handoff.reviewerNotes)}</p>` : ""}
              </div>
              <div class="handoff-actions">
                <button class="primary-button small" data-handoff-status="Approved" data-handoff-id="${escapeHtml(handoff.id)}" ${handoff.status === "Approved" ? "disabled" : ""}>Approve</button>
                <button class="ghost-button small" data-handoff-status="Escalated" data-handoff-id="${escapeHtml(handoff.id)}" ${handoff.status === "Escalated" ? "disabled" : ""}>Escalate</button>
                <button class="ghost-button small danger-action" data-handoff-status="Blocked" data-handoff-id="${escapeHtml(handoff.id)}" ${handoff.status === "Blocked" ? "disabled" : ""}>Block</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `
        <article class="handoff-card empty">
          <h3>No handoffs yet</h3>
          <p>Run the backend Agent Runtime. If the case requires review, PRAXIS will create a decision item here.</p>
        </article>
      `;

  board.querySelectorAll("[data-handoff-status]").forEach((button) => {
    button.addEventListener("click", () => updateHandoffStatus(button.dataset.handoffId, button.dataset.handoffStatus));
  });
}

function renderHandoffAlerts() {
  const alertsEl = document.querySelector("#handoff-alerts");
  if (!alertsEl) return;
  const report = state.handoffAlerts || buildLocalHandoffAlertReport();
  const counts = report.counts || {};
  const alerts = Array.isArray(report.alerts) ? report.alerts.slice(0, 3) : [];

  alertsEl.innerHTML = `
    <div class="handoff-alert-card ${Number(counts.overdue) || Number(counts.blocked) ? "critical" : Number(counts.dueSoon) || Number(counts.escalated) ? "warning" : "healthy"}">
      <span>Open reviews</span>
      <strong>${Number(counts.open) || 0}</strong>
      <p>${Number(counts.overdue) || 0} overdue · ${Number(counts.dueSoon) || 0} due soon · ${Number(counts.escalated) || 0} escalated</p>
    </div>
    <div class="handoff-alert-list">
      ${
        alerts.length
          ? alerts
              .map(
                (alert) => `
                  <article class="handoff-alert-item ${escapeHtml(alert.sla?.severity || "Medium")}">
                    <span>${escapeHtml(alert.sla?.label || "Needs review")}</span>
                    <strong>${escapeHtml(alert.workflowName || "Workflow")}</strong>
                    <p>${escapeHtml(alert.message || "Review this handoff before downstream action.")}</p>
                  </article>
                `,
              )
              .join("")
          : `
            <article class="handoff-alert-item Low">
              <span>SLA clear</span>
              <strong>No active reminders</strong>
              <p>Pending handoffs are inside SLA or the queue is empty.</p>
            </article>
          `
      }
    </div>
  `;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "TBD";
  }
}

async function runAgentRuntime() {
  const button = document.querySelector("#run-agent-runtime");
  const caseInput = document.querySelector("#pilot-case-input").value.trim();
  button.disabled = true;
  button.textContent = "Running";
  try {
    const response = await apiRequest("/agent/run", {
      method: "POST",
      body: JSON.stringify({ project: state.project, caseInput }),
    });
    state.agentRuntimeRun = response.run;
    state.runs = [
      {
        id: response.run.id,
        createdAt: response.run.createdAt,
        clientName: response.run.clientName,
        workflowName: response.run.workflowName,
        outcome: response.run.outcome,
        confidence: response.run.confidence,
        trace: response.run.trace,
        payload: response.run,
      },
      ...state.runs.filter((item) => item.id !== response.run.id),
    ].slice(0, 100);
    if (response.run?.governanceEnforcement) {
      state.governanceEnforcement = response.run.governanceEnforcement;
    }
    if (response.handoff) {
      const handoff = normalizeHandoff(response.handoff);
      state.handoffs = [handoff, ...state.handoffs.filter((item) => item.id !== handoff.id)];
      state.handoffAlerts = normalizeHandoffAlertReport(response.handoffAlerts || buildLocalHandoffAlertReport(state.handoffs));
    }
    state.telemetry = normalizeTelemetry(response.telemetry);
    state.backendOnline = true;
    setStorageStatus(`Agent run saved ${response.run.id.slice(0, 8)}`, response.run.requiresHumanReview ? "amber" : "green");
  } catch (error) {
    console.info("Backend agent runtime unavailable; using simulated trace", error);
    state.agentRuntimeRun = null;
    state.backendOnline = false;
    setStorageStatus("Backend runtime unavailable", "amber");
    await refreshRetrievalEvidence();
  } finally {
    button.disabled = false;
    button.textContent = "Run agent";
    renderPilotRunConsole();
    renderHandoffQueue();
    renderValueModel();
    renderDeploymentPlan();
    renderReadout();
    switchView("pilot");
  }
}

async function refreshHandoffs() {
  try {
    const [response, alertsResponse] = await Promise.all([apiRequest("/handoffs"), apiRequest("/handoffs/alerts")]);
    state.handoffs = (response.handoffs || []).map(normalizeHandoff);
    state.handoffAlerts = normalizeHandoffAlertReport(alertsResponse);
    state.backendOnline = true;
    setStorageStatus("Handoffs synced", "green");
  } catch (error) {
    state.backendOnline = false;
    console.info("Handoff backend unavailable", error);
    setStorageStatus("Handoff queue local only", "amber");
    state.handoffAlerts = buildLocalHandoffAlertReport();
  }
  renderHandoffQueue();
}

async function updateHandoffStatus(handoffId, status) {
  const handoff = state.handoffs.find((item) => item.id === handoffId);
  if (!handoff) return;
  const reviewerNotes =
    status === "Approved"
      ? "Approved in PRAXIS handoff queue."
      : status === "Blocked"
        ? "Blocked in PRAXIS handoff queue."
        : "Escalated for additional review.";
  try {
    const response = await apiRequest(`/handoffs/${encodeURIComponent(handoffId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reviewerNotes }),
    });
    const updated = normalizeHandoff(response.handoff);
    state.handoffs = state.handoffs.map((item) => (item.id === handoffId ? updated : item));
    state.handoffAlerts = normalizeHandoffAlertReport(response.handoffAlerts || buildLocalHandoffAlertReport(state.handoffs));
    state.backendOnline = true;
    setStorageStatus(`Handoff ${status.toLowerCase()}`, status === "Approved" ? "green" : "amber");
  } catch (error) {
    console.info("Could not update handoff in backend; updating local queue", error);
    const now = new Date().toISOString();
    state.handoffs = state.handoffs.map((item) =>
      item.id === handoffId
        ? {
            ...item,
            status,
            decision: ["Approved", "Blocked"].includes(status) ? status.toLowerCase() : item.decision,
            reviewerNotes,
            updatedAt: now,
            audit: [...item.audit, { event: "handoff.updated.local", detail: reviewerNotes, createdAt: now }],
          }
        : item,
    );
    state.handoffAlerts = buildLocalHandoffAlertReport();
    setStorageStatus(`Handoff ${status.toLowerCase()} locally`, "amber");
  }
  renderHandoffQueue();
  renderGovernance();
  renderDeploymentPlan();
  renderReadout();
}

async function savePilotRun() {
  const run = state.agentRuntimeRun ? normalizeAgentRuntimeRun(state.agentRuntimeRun) : buildPilotRun();
  if (state.agentRuntimeRun?.id) {
    setStorageStatus(`Agent run already saved ${state.agentRuntimeRun.id.slice(0, 8)}`, "green");
    return;
  }
  try {
    const response = await apiRequest("/runs", {
      method: "POST",
      body: JSON.stringify({
        project: state.project,
        selectedOpportunity: state.selectedOpportunity,
        clientName: state.project.clientName,
        workflowName: state.project.workflowName,
        outcome: run.outcome,
        confidence: run.confidence,
        trace: run.trace,
        connectorHealth: run.connectorHealth,
        governance: run.governance,
      }),
    });
    state.telemetry = normalizeTelemetry(response.telemetry);
    state.runs = [response.run, ...state.runs.filter((item) => item.id !== response.run.id)].slice(0, 100);
    state.backendOnline = true;
    setStorageStatus(`Run saved ${response.run.id.slice(0, 8)}`, "green");
    renderPilotRunConsole();
    renderValueModel();
    renderReadout();
  } catch (error) {
    state.backendOnline = false;
    console.info("Could not save run to backend", error);
    setStorageStatus("Start server to save runs", "amber");
  }
}

function getGovernanceHealth() {
  const requiredPolicies = state.project.governance.policies.filter((policy) => ["High", "Critical"].includes(policy.severity));
  const readyPolicies = requiredPolicies.filter((policy) => ["Approved", "Required"].includes(policy.status));
  const pendingApprovals = state.project.governance.approvals.filter((approval) => approval.status !== "Approved").length;
  const auditCoverage = state.project.governance.auditEvents.length >= 5;
  const score = Math.round(
    ((readyPolicies.length / Math.max(1, requiredPolicies.length)) * 60) +
      (pendingApprovals === 0 ? 25 : Math.max(0, 25 - pendingApprovals * 8)) +
      (auditCoverage ? 15 : 0),
  );
  return { score, pendingApprovals, auditCoverage, ready: score >= 80 && pendingApprovals === 0 };
}

function runGovernanceChecksLocal(project = state.project) {
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
    if (
      ["PII", "Regulated"].includes(connector.dataClass) &&
      !String(connector.access || "").toLowerCase().includes("pending") &&
      !approvals.some((approval) => approval.status === "Approved")
    ) {
      findings.push({
        severity: "Medium",
        area: "Sensitive data",
        title: `${connector.name} contains ${connector.dataClass} data`,
        detail: "Sensitive sources need explicit approval and masking before agent retrieval.",
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

  approvals
    .filter((approval) => approval.status !== "Approved")
    .forEach((approval) => {
      findings.push({
        severity: approval.status === "Blocked" ? "High" : "Medium",
        area: "Approval gate",
        title: `${approval.gate} is ${approval.status}`,
        detail: approval.notes || "Approval must be resolved before controlled production.",
      });
    });

  const requiredPolicies = policies.filter((policy) => ["High", "Critical"].includes(policy.severity));
  const approvedOrRequired = requiredPolicies.filter((policy) => ["Approved", "Required"].includes(policy.status));
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          findings.filter((finding) => finding.severity === "High").length * 18 -
          findings.filter((finding) => finding.severity === "Medium").length * 8 +
          (requiredPolicies.length ? (approvedOrRequired.length / requiredPolicies.length) * 10 : 0),
      ),
    ),
  );

  return {
    score,
    passed: score >= 80 && !findings.some((finding) => finding.severity === "High"),
    findings,
    checkedAt: new Date().toISOString(),
  };
}

function maskSensitiveTextLocal(text = "") {
  const redactions = [];
  const patterns = [
    { type: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, token: "[EMAIL]" },
    { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g, token: "[SSN]" },
    { type: "card", regex: /\b(?:\d[ -]*?){13,16}\b/g, token: "[CARD]" },
    { type: "account", regex: /\b(?:acct|account|customer|case)[\s:#-]*[A-Z0-9]{6,}\b/gi, token: "[ID]" },
    { type: "phone", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, token: "[PHONE]" },
  ];
  let masked = String(text || "");
  patterns.forEach((pattern) => {
    masked = masked.replace(pattern.regex, (match) => {
      redactions.push({ type: pattern.type, chars: match.length });
      return pattern.token;
    });
  });
  return { masked, redactions, originalLength: String(text || "").length };
}

function secretRefForToolLocal(tool = {}) {
  return `PRAXIS_SECRET_${String(tool.name || tool.code || "tool")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase() || "TOOL"}`;
}

function enforceGovernanceLocal(project = state.project, input = "") {
  const check = runGovernanceChecksLocal(project);
  const mask = maskSensitiveTextLocal(input);
  const approvals = project.governance.approvals || [];
  const pendingApprovals = approvals.filter((approval) => approval.status !== "Approved");
  const policyDecisions = (project.governance.policies || []).map((policy) => ({
    area: policy.area,
    owner: policy.owner,
    severity: policy.severity,
    status: policy.status,
    rule: policy.rule,
    decision: policy.status === "Blocked" ? "block" : ["High", "Critical"].includes(policy.severity) && !["Approved", "Required"].includes(policy.status) ? "approval_required" : "allow",
  }));
  const toolDecisions = (project.tools || []).map((tool) => {
    const highRisk = tool.risk === "High";
    const approvalScoped = String(tool.auth || "").toLowerCase().includes("approval") || String(tool.auth || "").toLowerCase().includes("human");
    return {
      name: tool.name,
      callable: tool.code,
      risk: tool.risk,
      auth: tool.auth,
      decision: highRisk && !approvalScoped ? "block" : highRisk ? "approval_required" : "allow",
      secretRef: secretRefForToolLocal(tool),
      secretConfigured: false,
    };
  });
  const blocked = check.findings.some((finding) => finding.severity === "High") || policyDecisions.some((policy) => policy.decision === "block") || toolDecisions.some((tool) => tool.decision === "block");
  const decision = blocked ? "blocked" : pendingApprovals.length || mask.redactions.length ? "approval_required" : "allow";
  return {
    id: `local-enforcement-${Date.now()}`,
    checkedAt: new Date().toISOString(),
    decision,
    maskedInput: mask.masked,
    redactions: mask.redactions,
    findings: check.findings,
    policyDecisions,
    toolDecisions,
    pendingApprovals,
    secretsManifest: toolDecisions.map((tool) => ({
      tool: tool.name,
      secretRef: tool.secretRef,
      configured: tool.secretConfigured,
      requiredFor: tool.auth,
    })),
    auditRequired: (project.governance.auditEvents || []).length < 5 ? ["audit_coverage_incomplete"] : [],
    summary:
      decision === "allow"
        ? "Runtime governance allows sandbox execution."
        : decision === "approval_required"
          ? "Runtime governance allows sandbox execution only with human approval."
          : "Runtime governance blocks execution until policy findings are fixed.",
  };
}

function renderGovernance() {
  const health = getGovernanceHealth();
  document.querySelector("#governance-health").textContent = `${health.score}% governed`;
  document.querySelector("#governance-health").className = `status-pill ${health.ready ? "green" : "amber"}`;

  const header = `
    <div class="policy-row header">
      <span>Area</span>
      <span>Rule</span>
      <span>Owner</span>
      <span>Severity</span>
      <span>Status</span>
    </div>
  `;
  const rows = state.project.governance.policies
    .map(
      (policy) => `
        <div class="policy-row">
          <strong>${escapeHtml(policy.area)}</strong>
          <span>${escapeHtml(policy.rule)}</span>
          <span>${escapeHtml(policy.owner)}</span>
          <span class="severity-pill ${escapeHtml(policy.severity)}">${escapeHtml(policy.severity)}</span>
          <span class="tool-status ${["Approved", "Required"].includes(policy.status) ? "ready" : "warn"}">${escapeHtml(policy.status)}</span>
        </div>
      `,
    )
    .join("");
  document.querySelector("#governance-matrix").innerHTML = header + rows;

  const check = state.governanceCheck;
  const findingsHtml = !check
    ? `
      <article class="governance-summary idle">
        <strong>No governance check run yet</strong>
        <span>Click Run check to test connectors, sensitive data, high-risk tools, approvals, and audit coverage before the pilot.</span>
      </article>
    `
    : `
      <article class="governance-summary ${check.passed ? "passed" : "blocked"}">
        <div>
          <strong>${check.passed ? "Pilot governance passed" : "Pilot governance blocked"}</strong>
          <span>${check.findings.length ? `${check.findings.length} finding${check.findings.length === 1 ? "" : "s"} need attention.` : "No blocking findings detected."}</span>
        </div>
        <span class="governance-score">${check.score}/100</span>
      </article>
      ${
        check.findings.length
          ? check.findings
              .map(
                (finding) => `
                  <article class="governance-finding ${escapeHtml(finding.severity.toLowerCase())}">
                    <span>${escapeHtml(finding.severity)}</span>
                    <div>
                      <strong>${escapeHtml(finding.title)}</strong>
                      <p>${escapeHtml(finding.area)}: ${escapeHtml(finding.detail)}</p>
                    </div>
                  </article>
                `,
              )
              .join("")
          : `
              <article class="governance-finding low">
                <span>OK</span>
                <div>
                  <strong>Ready for controlled pilot</strong>
                  <p>PRAXIS can explain what data, tools, approvals, and audit events are involved before a real agent run.</p>
                </div>
              </article>
            `
      }
    `;
  document.querySelector("#governance-findings").innerHTML = findingsHtml;

  document.querySelector("#approval-board").innerHTML = state.project.governance.approvals
    .map(
      (approval) => `
        <article class="approval-card ${escapeHtml(approval.status)}">
          <strong>${escapeHtml(approval.gate)}</strong>
          <span>${escapeHtml(approval.notes)}</span>
          <div class="tag-list">
            <span class="tag">${escapeHtml(approval.approver)}</span>
            <span class="tag">${escapeHtml(approval.status)}</span>
            <span class="tag">${escapeHtml(approval.due)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#audit-trail").innerHTML = state.project.governance.auditEvents
    .map(
      (eventName, index) => `
        <article class="audit-card">
          <span class="audit-index">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(eventName)}</strong>
            <span>Captured for replay, compliance review, and regression analysis.</span>
          </div>
        </article>
      `,
    )
    .join("");

  renderGovernanceEnforcement();
  renderGovernanceEditor();
}

function renderGovernanceEnforcement() {
  const target = document.querySelector("#governance-enforcement");
  if (!target) return;
  const enforcement =
    state.governanceEnforcement ||
    enforceGovernanceLocal(state.project, document.querySelector("#pilot-case-input")?.value || state.project.businessProblem || "");
  const configuredSecrets = enforcement.secretsManifest.filter((secret) => secret.configured).length;
  const missingSecrets = enforcement.secretsManifest.filter((secret) => !secret.configured).length;
  const decisionClass = enforcement.decision === "allow" ? "passed" : enforcement.decision === "approval_required" ? "warning" : "blocked";
  target.innerHTML = `
    <article class="enforcement-summary ${decisionClass}">
      <div>
        <span>Decision</span>
        <strong>${escapeHtml(enforcement.decision)}</strong>
        <p>${escapeHtml(enforcement.summary)}</p>
      </div>
      <div>
        <span>Masked input</span>
        <strong>${enforcement.redactions.length}</strong>
        <p>${escapeHtml(enforcement.maskedInput || "No sample input available.")}</p>
      </div>
      <div>
        <span>Secrets manifest</span>
        <strong>${enforcement.secretsManifest.length}</strong>
        <p>${configuredSecrets} configured &middot; ${missingSecrets} missing locally</p>
      </div>
    </article>
    <div class="enforcement-grid">
      <article class="enforcement-card">
        <h3>Policy decisions</h3>
        ${
          enforcement.policyDecisions.length
            ? enforcement.policyDecisions
                .map((policy) => `<p><strong>${escapeHtml(policy.decision)}</strong> &middot; ${escapeHtml(policy.area)} &middot; ${escapeHtml(policy.owner)}</p>`)
                .join("")
            : "<p>No policies configured.</p>"
        }
      </article>
      <article class="enforcement-card">
        <h3>Tool decisions</h3>
        ${
          enforcement.toolDecisions.length
            ? enforcement.toolDecisions
                .map((tool) => `<p><strong>${escapeHtml(tool.decision)}</strong> &middot; ${escapeHtml(tool.name)} &middot; ${escapeHtml(tool.auth)}</p>`)
                .join("")
            : "<p>No tools configured.</p>"
        }
      </article>
      <article class="enforcement-card">
        <h3>Findings</h3>
        ${
          enforcement.findings.length
            ? enforcement.findings
                .slice(0, 5)
                .map((finding) => `<p><strong>${escapeHtml(finding.severity)}</strong> &middot; ${escapeHtml(finding.title)}</p>`)
                .join("")
            : "<p>No blocking findings.</p>"
        }
      </article>
    </div>
  `;
}

function renderGovernanceEditor() {
  const policyEditor = state.project.governance.policies
    .map(
      (policy, index) => `
        <article class="governance-editor-card">
          <label>
            Area
            <input data-gov-kind="policies" data-gov-index="${index}" data-gov-field="area" value="${escapeHtml(policy.area)}" />
          </label>
          <label>
            Owner
            <input data-gov-kind="policies" data-gov-index="${index}" data-gov-field="owner" value="${escapeHtml(policy.owner)}" />
          </label>
          <label>
            Severity
            <select data-gov-kind="policies" data-gov-index="${index}" data-gov-field="severity">
              ${["Low", "Medium", "High", "Critical"].map((severity) => `<option value="${severity}" ${policy.severity === severity ? "selected" : ""}>${severity}</option>`).join("")}
            </select>
          </label>
          <label>
            Status
            <select data-gov-kind="policies" data-gov-index="${index}" data-gov-field="status">
              ${["Draft", "Required", "Approved", "Blocked"].map((status) => `<option value="${status}" ${policy.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
          <label class="span-4">
            Rule
            <textarea data-gov-kind="policies" data-gov-index="${index}" data-gov-field="rule">${escapeHtml(policy.rule)}</textarea>
          </label>
          <button class="delete-button" data-delete-gov-kind="policies" data-delete-gov-index="${index}" type="button">Delete policy</button>
        </article>
      `,
    )
    .join("");

  const approvalEditor = state.project.governance.approvals
    .map(
      (approval, index) => `
        <article class="governance-editor-card">
          <label>
            Gate
            <input data-gov-kind="approvals" data-gov-index="${index}" data-gov-field="gate" value="${escapeHtml(approval.gate)}" />
          </label>
          <label>
            Approver
            <input data-gov-kind="approvals" data-gov-index="${index}" data-gov-field="approver" value="${escapeHtml(approval.approver)}" />
          </label>
          <label>
            Status
            <select data-gov-kind="approvals" data-gov-index="${index}" data-gov-field="status">
              ${["Pending", "Approved", "Blocked"].map((status) => `<option value="${status}" ${approval.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
          <label>
            Due
            <input data-gov-kind="approvals" data-gov-index="${index}" data-gov-field="due" value="${escapeHtml(approval.due)}" />
          </label>
          <label class="span-4">
            Notes
            <textarea data-gov-kind="approvals" data-gov-index="${index}" data-gov-field="notes">${escapeHtml(approval.notes)}</textarea>
          </label>
          <button class="delete-button" data-delete-gov-kind="approvals" data-delete-gov-index="${index}" type="button">Delete approval</button>
        </article>
      `,
    )
    .join("");

  document.querySelector("#governance-editor").innerHTML = `
    <section class="governance-editor-section">
      <h3>Policies</h3>
      ${policyEditor}
    </section>
    <section class="governance-editor-section">
      <h3>Approval gates</h3>
      ${approvalEditor}
    </section>
  `;

  document.querySelectorAll("[data-gov-field]").forEach((field) => {
    field.addEventListener("change", updateGovernanceItem);
  });
  document.querySelectorAll("[data-delete-gov-kind]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteGovernanceItem(button.dataset.deleteGovKind, Number(button.dataset.deleteGovIndex)),
    );
  });
}

function updateGovernanceItem(event) {
  const kind = event.target.dataset.govKind;
  const index = Number(event.target.dataset.govIndex);
  const field = event.target.dataset.govField;
  state.project.governance[kind][index][field] = event.target.value.trim();
  state.governanceCheck = null;
  state.governanceEnforcement = null;
  saveProject("Governance updated");
  renderGovernance();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function addPolicy() {
  state.project.governance.policies.push({
    area: "New policy",
    rule: "Describe the control rule.",
    owner: "Owner",
    severity: "High",
    status: "Draft",
  });
  state.governanceCheck = null;
  state.governanceEnforcement = null;
  saveProject("Policy added");
  renderGovernance();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function addApproval() {
  state.project.governance.approvals.push({
    gate: "New approval gate",
    approver: "Approver",
    status: "Pending",
    due: "TBD",
    notes: "Describe what this approval unlocks.",
  });
  state.governanceCheck = null;
  state.governanceEnforcement = null;
  saveProject("Approval added");
  renderGovernance();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

function deleteGovernanceItem(kind, index) {
  if (!state.project.governance[kind] || state.project.governance[kind].length <= 1) return;
  state.project.governance[kind].splice(index, 1);
  state.governanceCheck = null;
  state.governanceEnforcement = null;
  saveProject("Governance item deleted");
  renderGovernance();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
}

async function runGovernanceCheck() {
  const button = document.querySelector("#run-governance-check");
  button.disabled = true;
  button.textContent = "Checking";
  try {
    const response = await apiRequest("/governance/check", {
      method: "POST",
      body: JSON.stringify({ project: state.project }),
    });
    state.backendOnline = true;
    state.governanceCheck = {
      score: response.score,
      passed: Boolean(response.passed),
      findings: response.findings || [],
      checkedAt: response.checkedAt,
    };
    setStorageStatus(`Governance ${response.passed ? "passed" : "needs work"}`, response.passed ? "green" : "amber");
  } catch (error) {
    console.info("Backend governance check unavailable; using browser checks", error);
    state.backendOnline = false;
    state.governanceCheck = runGovernanceChecksLocal(state.project);
    setStorageStatus("Governance checked locally", state.governanceCheck.passed ? "green" : "amber");
  } finally {
    button.disabled = false;
    button.textContent = "Run check";
    renderGovernance();
    renderPilotRunConsole();
    renderDeploymentPlan();
    renderReadout();
  }
}

async function runGovernanceEnforcement() {
  const button = document.querySelector("#run-governance-enforcement");
  const input = document.querySelector("#pilot-case-input")?.value || state.project.businessProblem || "";
  button.disabled = true;
  button.textContent = "Enforcing";
  try {
    const response = await apiRequest("/governance/enforce", {
      method: "POST",
      body: JSON.stringify({ project: state.project, input, tools: state.project.tools }),
    });
    state.governanceEnforcement = response.enforcement || enforceGovernanceLocal(state.project, input);
    state.backendOnline = true;
    setStorageStatus(
      `Governance ${state.governanceEnforcement.decision}`,
      state.governanceEnforcement.decision === "allow" ? "green" : "amber",
    );
  } catch (error) {
    console.info("Backend governance enforcement unavailable; using browser enforcement", error);
    state.governanceEnforcement = enforceGovernanceLocal(state.project, input);
    state.backendOnline = false;
    setStorageStatus("Governance enforced locally", state.governanceEnforcement.decision === "allow" ? "green" : "amber");
  } finally {
    button.disabled = false;
    button.textContent = "Run enforcement";
    renderGovernance();
    renderPilotRunConsole();
    renderDeploymentPlan();
    renderReadout();
  }
}

function renderEvals() {
  document.querySelector("#eval-list").innerHTML = state.project.evalCases
    .map(
      (test) => `
        <article class="eval-item">
          <div>
            <h3>${escapeHtml(test.name)}</h3>
            <p>${escapeHtml(test.target)}</p>
            <div class="eval-meta">
              <span class="tag">${escapeHtml(test.category)}</span>
              <span class="tag">${escapeHtml(test.input.slice(0, 54))}${test.input.length > 54 ? "..." : ""}</span>
            </div>
          </div>
          <span class="severity-pill ${escapeHtml(test.severity)}">${escapeHtml(test.severity)}</span>
          <span class="eval-result ${test.result}">${test.result}</span>
        </article>
      `,
    )
    .join("");

  document.querySelector("#eval-editor").innerHTML = state.project.evalCases
    .map(
      (test, index) => `
        <article class="eval-editor-card">
          <label>
            Name
            <input data-eval-field="name" data-eval-index="${index}" value="${escapeHtml(test.name)}" />
          </label>
          <label>
            Category
            <input data-eval-field="category" data-eval-index="${index}" value="${escapeHtml(test.category)}" />
          </label>
          <label>
            Severity
            <select data-eval-field="severity" data-eval-index="${index}">
              ${["Low", "Medium", "High", "Critical"]
                .map((severity) => `<option value="${severity}" ${test.severity === severity ? "selected" : ""}>${severity}</option>`)
                .join("")}
            </select>
          </label>
          <button class="delete-button" data-delete-eval="${index}" type="button">Delete</button>
          <label class="span-2">
            Test input
            <textarea data-eval-field="input" data-eval-index="${index}">${escapeHtml(test.input)}</textarea>
          </label>
          <label class="span-2">
            Expected output
            <textarea data-eval-field="expected" data-eval-index="${index}">${escapeHtml(test.expected)}</textarea>
          </label>
          <label class="span-4">
            What this eval verifies
            <textarea data-eval-field="target" data-eval-index="${index}">${escapeHtml(test.target)}</textarea>
          </label>
          <label class="span-4">
            Last actual result
            <textarea data-eval-field="actual" data-eval-index="${index}">${escapeHtml(test.actual)}</textarea>
          </label>
          ${
            Array.isArray(test.retrievalEvidence) && test.retrievalEvidence.length
              ? `
                <div class="eval-evidence span-4">
                  <strong>Retrieved evidence</strong>
                  <span>${test.retrievalEvidence.map((item) => escapeHtml(typeof item === "string" ? item : `${item.documentName || "Document"} ${item.chunkId || ""}`)).join(" | ")}</span>
                </div>
              `
              : ""
          }
          ${
            test.checks
              ? `
                <div class="eval-checks span-4">
                  <span>Retrieval: ${escapeHtml(test.checks.retrieval?.status || "n/a")}</span>
                  <span>Recommendation match: ${escapeHtml(test.checks.recommendationMatch?.status || "n/a")} (${Number(test.checks.recommendationMatch?.score || 0)}%)</span>
                  <span>Hallucination: ${escapeHtml(test.checks.hallucination?.status || "n/a")}</span>
                  <span>Regression: ${escapeHtml(test.checks.regression?.status || "n/a")}</span>
                </div>
              `
              : ""
          }
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-eval-field]").forEach((field) => {
    field.addEventListener("change", updateEvalCase);
  });
  document.querySelectorAll("[data-delete-eval]").forEach((button) => {
    button.addEventListener("click", () => deleteEvalCase(Number(button.dataset.deleteEval)));
  });
  renderEvalSummary();
  renderEvalHistory();
}

function renderEvalSummary() {
  const completed = state.project.evalCases.some((test) => test.result !== "pending");
  if (!completed) {
    document.querySelector("#eval-status").textContent = "Not run";
    document.querySelector("#eval-status").className = "status-pill";
    document.querySelector("#eval-summary-title").textContent = "Waiting for test run";
    document.querySelector("#eval-summary-copy").textContent =
      'Press "Run evals" to simulate the FDE testing the agent against historic or synthetic cases.';
    document.querySelector("#score-ring span").textContent = "--";
    return;
  }

  const resultCounts = state.project.evalCases.reduce(
    (counts, test) => ({ ...counts, [test.result]: (counts[test.result] || 0) + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const criticalFails = state.project.evalCases.filter((test) => test.severity === "Critical" && test.result === "fail").length;
  const gateScore = Math.round(
    ((resultCounts.pass * 100 + resultCounts.warn * 70) / Math.max(1, state.project.evalCases.length)),
  );
  const retrievalCovered = state.project.evalCases.filter((test) => Array.isArray(test.retrievalEvidence) && test.retrievalEvidence.length).length;
  const checkedCases = state.project.evalCases.filter((test) => test.checks?.recommendationMatch);
  const recommendationMatch = checkedCases.length
    ? Math.round(checkedCases.reduce((sum, test) => sum + Number(test.checks.recommendationMatch.score || 0), 0) / checkedCases.length)
    : null;
  const hallucinationWarnings = state.project.evalCases.filter((test) => test.checks?.hallucination?.status && test.checks.hallucination.status !== "pass").length;
  const retrievalCopy = retrievalCovered ? ` Retrieval evidence covered ${retrievalCovered}/${state.project.evalCases.length} cases.` : "";
  const qualityCopy = recommendationMatch === null ? "" : ` Recommendation match ${recommendationMatch}%; hallucination warnings ${hallucinationWarnings}.`;
  const passed = criticalFails === 0 && gateScore >= 80;
  document.querySelector("#eval-status").textContent = passed ? "Ready for pilot" : "Blocked";
  document.querySelector("#eval-status").className = `status-pill ${passed ? "green" : "amber"}`;
  document.querySelector("#eval-summary-title").textContent = passed ? "Pilot gate passed" : "Pilot gate blocked";
  document.querySelector("#eval-summary-copy").textContent = passed
    ? `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. No critical blockers remain.${retrievalCopy}${qualityCopy}`
    : `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. Resolve critical or low-score cases before production.${retrievalCopy}${qualityCopy}`;
  document.querySelector("#score-ring span").textContent = String(gateScore);
}

function renderEvalHistory() {
  const target = document.querySelector("#eval-history");
  if (!target) return;
  const history = Array.isArray(state.evalHistory) ? state.evalHistory.slice(0, 8) : [];
  if (!history.length) {
    target.innerHTML = `
      <article class="eval-history-card empty">
        <strong>No backend eval history yet</strong>
        <p>Run evals once to create a regression baseline with retrieval, recommendation-match, and hallucination checks.</p>
      </article>
    `;
    return;
  }
  target.innerHTML = history
    .map((run) => {
      const summary = run.summary || {};
      const counts = summary.resultCounts || { pass: 0, warn: 0, fail: 0 };
      return `
        <article class="eval-history-card ${summary.passed ? "passed" : "blocked"}">
          <div>
            <strong>${escapeHtml(run.workflowName || "Eval run")}</strong>
            <p>${new Date(run.createdAt || summary.evaluatedAt || Date.now()).toLocaleString()}</p>
          </div>
          <span>${Number(summary.gateScore || 0)}/100 gate</span>
          <span>${Number(summary.recommendationMatch || 0)}% match</span>
          <span>${Number(summary.retrievalCoverage || 0)}% retrieval</span>
          <span>${Number(summary.hallucinationWarnings || 0)} hallucination warnings</span>
          <span>${counts.pass || 0} pass · ${counts.warn || 0} warn · ${counts.fail || 0} fail</span>
        </article>
      `;
    })
    .join("");
}

async function runEvals() {
  state.evalsRun = true;
  try {
    const response = await apiRequest("/evals/run", {
      method: "POST",
      body: JSON.stringify({ project: state.project }),
    });
    state.project.evalCases = response.evalCases;
    state.evalHistory = Array.isArray(response.evalHistory) ? response.evalHistory : state.evalHistory;
    const { resultCounts, gateScore, passed, retrievalCoverage, recommendationMatch, hallucinationWarnings, regressions } = response.summary;
    saveProject("Backend evals run");
    renderEvals();
    renderContextGraph();
    renderPilotRunConsole();
    renderDeploymentPlan();
    renderReadout();
    document.querySelector("#eval-status").textContent = passed ? "Ready for pilot" : "Blocked";
    document.querySelector("#eval-status").className = `status-pill ${passed ? "green" : "amber"}`;
    document.querySelector("#eval-summary-title").textContent = passed ? "Pilot gate passed" : "Pilot gate blocked";
    document.querySelector("#eval-summary-copy").textContent = passed
      ? `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. Retrieval ${retrievalCoverage}%, recommendation match ${recommendationMatch}%, hallucination warnings ${hallucinationWarnings}, regressions ${regressions}.`
      : `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. Retrieval ${retrievalCoverage}%, recommendation match ${recommendationMatch}%, hallucination warnings ${hallucinationWarnings}, regressions ${regressions}.`;
    document.querySelector("#score-ring span").textContent = String(gateScore);
    switchView("evals");
    return;
  } catch (error) {
    console.info("Backend eval runner unavailable; using browser fallback", error);
  }

  const toolAverage = Math.round(
    state.project.tools.reduce((sum, tool) => sum + scoreTool(tool), 0) / Math.max(1, state.project.tools.length),
  );
  const hasAudit = state.project.tools.some((tool) =>
    `${tool.name} ${tool.code} ${tool.copy}`.toLowerCase().includes("audit") ||
    `${tool.name} ${tool.code} ${tool.copy}`.toLowerCase().includes("trace"),
  );
  const readiness = Number(state.project.readiness) || 0;

  state.project.evalCases.forEach((test) => {
    const severityPenalty = { Low: 0, Medium: 6, High: 12, Critical: 18 }[test.severity] ?? 6;
    const score = Math.max(0, Math.min(100, Math.round((readiness + toolAverage) / 2 - severityPenalty + (hasAudit ? 8 : 0))));
    if (test.severity === "Critical" && !hasAudit) {
      test.result = "fail";
      test.actual = "Failed gate: critical eval requires audit or trace coverage before pilot.";
    } else if (score >= 74) {
      test.result = "pass";
      test.actual = `Passed deterministic gate with score ${score}. Evidence, tool readiness, and controls are sufficient for pilot.`;
    } else if (score >= 58) {
      test.result = "warn";
      test.actual = `Warning gate with score ${score}. Safe for sandbox, but needs stronger data/tool coverage before scale-up.`;
    } else {
      test.result = "fail";
      test.actual = `Failed gate with score ${score}. Fix context, tools, or controls before live traffic.`;
    }
  });

  const resultCounts = state.project.evalCases.reduce(
    (counts, test) => ({ ...counts, [test.result]: (counts[test.result] || 0) + 1 }),
    { pass: 0, warn: 0, fail: 0 },
  );
  const criticalFails = state.project.evalCases.filter((test) => test.severity === "Critical" && test.result === "fail").length;
  const gateScore = Math.round(
    ((resultCounts.pass * 100 + resultCounts.warn * 70) / Math.max(1, state.project.evalCases.length)),
  );
  const passed = criticalFails === 0 && gateScore >= 80;

  document.querySelector("#eval-status").textContent = passed ? "Ready for pilot" : "Blocked";
  document.querySelector("#eval-status").className = `status-pill ${passed ? "green" : "amber"}`;
  document.querySelector("#eval-summary-title").textContent = passed ? "Pilot gate passed" : "Pilot gate blocked";
  document.querySelector("#eval-summary-copy").textContent = passed
    ? `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. No critical blockers remain.`
    : `${resultCounts.pass} passed, ${resultCounts.warn} warnings, ${resultCounts.fail} failed. Resolve critical or low-score cases before production.`;
  document.querySelector("#score-ring span").textContent = String(gateScore);
  saveProject("Evals run");
  renderEvals();
  renderContextGraph();
  renderPilotRunConsole();
  renderDeploymentPlan();
  renderReadout();
  switchView("evals");
}

function updateEvalCase(event) {
  const index = Number(event.target.dataset.evalIndex);
  const field = event.target.dataset.evalField;
  state.project.evalCases[index][field] = event.target.value.trim();
  if (field !== "actual") {
    state.project.evalCases[index].result = "pending";
  }
  saveProject("Eval updated");
  renderEvals();
  renderContextGraph();
  renderPilotRunConsole();
}

function addEvalCase() {
  state.project.evalCases.push({
    id: `eval-${Date.now()}`,
    name: "New eval case",
    category: "Quality",
    severity: "Medium",
    input: "Describe the historic or synthetic case the agent should handle.",
    expected: "Describe the expected answer, action, evidence, or escalation.",
    target: "Describe what this test protects against.",
    actual: "",
    result: "pending",
  });
  saveProject("Eval added");
  renderEvals();
  renderContextGraph();
}

function deleteEvalCase(index) {
  if (state.project.evalCases.length <= 1) return;
  state.project.evalCases.splice(index, 1);
  saveProject("Eval deleted");
  renderEvals();
  renderContextGraph();
}

function getDeploymentHealth() {
  const toolAverage = Math.round(
    state.project.tools.reduce((sum, tool) => sum + scoreTool(tool), 0) / Math.max(1, state.project.tools.length),
  );
  const completedEvals = state.project.evalCases.some((test) => test.result !== "pending");
  const failedCritical = state.project.evalCases.some((test) => test.severity === "Critical" && test.result === "fail");
  const openHighBlockers = state.project.deployment.blockers.filter((blocker) =>
    ["High", "Critical"].includes(blocker.severity) && blocker.status !== "Closed",
  ).length;
  const doneChecklist = state.project.deployment.checklist.filter((item) => item.done).length;
  const checklistScore = Math.round((doneChecklist / Math.max(1, state.project.deployment.checklist.length)) * 100);
  const connectors = getConnectorHealth();
  const governance = getGovernanceHealth();
  const ready = connectors.ready && toolAverage >= 75 && completedEvals && !failedCritical && openHighBlockers === 0 && checklistScore >= 70 && governance.ready;
  return { toolAverage, connectors, completedEvals, failedCritical, openHighBlockers, checklistScore, ready };
}

function renderDeploymentPlan() {
  const health = getDeploymentHealth();
  document.querySelector("#deployment-health").textContent = health.ready ? "Scale-ready" : "Pilot guarded";
  document.querySelector("#deployment-health").className = `status-pill ${health.ready ? "green" : "amber"}`;

  document.querySelector("#deployment-timeline").innerHTML = state.project.deployment.timeline
    .map(
      (item) => `
        <article class="milestone-card">
          <div class="milestone-day">${escapeHtml(item.day)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.goal)}</p>
          <div class="deployment-meta">
            <span><strong>Owner:</strong> ${escapeHtml(item.owner)}</span>
            <span><strong>Status:</strong> ${escapeHtml(item.status)}</span>
            <span><strong>Exit:</strong> ${escapeHtml(item.exitCriteria)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#rollout-checklist").innerHTML = state.project.deployment.checklist
    .map(
      (item, index) => `
        <article class="check-row">
          <button class="check-toggle ${item.done ? "done" : ""}" data-toggle-check="${index}" type="button">${item.done ? "OK" : ""}</button>
          <div>
            <strong>${escapeHtml(item.text)}</strong>
            <span>Owner: ${escapeHtml(item.owner)}</span>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelector("#blocker-board").innerHTML = state.project.deployment.blockers.length
    ? state.project.deployment.blockers
        .map(
          (blocker) => `
            <article class="blocker-card ${escapeHtml(blocker.severity)}">
              <strong>${escapeHtml(blocker.title)}</strong>
              <span>${escapeHtml(blocker.detail)}</span>
              <div class="tag-list">
                <span class="tag">${escapeHtml(blocker.owner)}</span>
                <span class="tag">${escapeHtml(blocker.severity)}</span>
                <span class="tag">${escapeHtml(blocker.status)}</span>
              </div>
            </article>
          `,
        )
        .join("")
    : `<article class="blocker-card"><strong>No blockers</strong><span>Everything required for this pilot is currently clear.</span></article>`;

  renderDeploymentEditor();
  document.querySelectorAll("[data-toggle-check]").forEach((button) => {
    button.addEventListener("click", () => toggleChecklistItem(Number(button.dataset.toggleCheck)));
  });
}

function renderDeploymentEditor() {
  const timelineEditor = state.project.deployment.timeline
    .map(
      (item, index) => `
        <article class="deployment-editor-card">
          <label>
            Day range
            <input data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="day" value="${escapeHtml(item.day)}" />
          </label>
          <label>
            Title
            <input data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="title" value="${escapeHtml(item.title)}" />
          </label>
          <label>
            Owner
            <input data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="owner" value="${escapeHtml(item.owner)}" />
          </label>
          <label>
            Status
            <select data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="status">
              ${["Ready", "Planned", "In progress", "Blocked", "Done"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
          <label class="span-2">
            Goal
            <textarea data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="goal">${escapeHtml(item.goal)}</textarea>
          </label>
          <label class="span-2">
            Exit criteria
            <textarea data-deploy-kind="timeline" data-deploy-index="${index}" data-deploy-field="exitCriteria">${escapeHtml(item.exitCriteria)}</textarea>
          </label>
          <button class="delete-button" data-delete-deploy-kind="timeline" data-delete-deploy-index="${index}" type="button">Delete milestone</button>
        </article>
      `,
    )
    .join("");

  const blockerEditor = state.project.deployment.blockers
    .map(
      (item, index) => `
        <article class="deployment-editor-card">
          <label>
            Blocker
            <input data-deploy-kind="blockers" data-deploy-index="${index}" data-deploy-field="title" value="${escapeHtml(item.title)}" />
          </label>
          <label>
            Owner
            <input data-deploy-kind="blockers" data-deploy-index="${index}" data-deploy-field="owner" value="${escapeHtml(item.owner)}" />
          </label>
          <label>
            Severity
            <select data-deploy-kind="blockers" data-deploy-index="${index}" data-deploy-field="severity">
              ${["Low", "Medium", "High", "Critical"].map((severity) => `<option value="${severity}" ${item.severity === severity ? "selected" : ""}>${severity}</option>`).join("")}
            </select>
          </label>
          <label>
            Status
            <select data-deploy-kind="blockers" data-deploy-index="${index}" data-deploy-field="status">
              ${["Open", "Planned", "In progress", "Closed"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
          </label>
          <label class="span-4">
            Detail
            <textarea data-deploy-kind="blockers" data-deploy-index="${index}" data-deploy-field="detail">${escapeHtml(item.detail)}</textarea>
          </label>
          <button class="delete-button" data-delete-deploy-kind="blockers" data-delete-deploy-index="${index}" type="button">Delete blocker</button>
        </article>
      `,
    )
    .join("");

  const checklistEditor = state.project.deployment.checklist
    .map(
      (item, index) => `
        <article class="deployment-editor-card">
          <label class="span-2">
            Checklist item
            <input data-deploy-kind="checklist" data-deploy-index="${index}" data-deploy-field="text" value="${escapeHtml(item.text)}" />
          </label>
          <label>
            Owner
            <input data-deploy-kind="checklist" data-deploy-index="${index}" data-deploy-field="owner" value="${escapeHtml(item.owner)}" />
          </label>
          <label>
            Done
            <select data-deploy-kind="checklist" data-deploy-index="${index}" data-deploy-field="done">
              <option value="false" ${item.done ? "" : "selected"}>No</option>
              <option value="true" ${item.done ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <button class="delete-button" data-delete-deploy-kind="checklist" data-delete-deploy-index="${index}" type="button">Delete checklist item</button>
        </article>
      `,
    )
    .join("");

  document.querySelector("#deployment-editor").innerHTML = `
    <section class="deployment-editor-section">
      <h3>Timeline</h3>
      ${timelineEditor}
    </section>
    <section class="deployment-editor-section">
      <h3>Blockers</h3>
      ${blockerEditor}
    </section>
    <section class="deployment-editor-section">
      <h3>Checklist</h3>
      ${checklistEditor}
    </section>
  `;

  document.querySelectorAll("[data-deploy-field]").forEach((field) => {
    field.addEventListener("change", updateDeploymentItem);
  });
  document.querySelectorAll("[data-delete-deploy-kind]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteDeploymentItem(button.dataset.deleteDeployKind, Number(button.dataset.deleteDeployIndex)),
    );
  });
}

function updateDeploymentItem(event) {
  const kind = event.target.dataset.deployKind;
  const index = Number(event.target.dataset.deployIndex);
  const field = event.target.dataset.deployField;
  const value = field === "done" ? event.target.value === "true" : event.target.value.trim();
  state.project.deployment[kind][index][field] = value;
  saveProject("Deployment updated");
  renderDeploymentPlan();
  renderReadout();
}

function toggleChecklistItem(index) {
  state.project.deployment.checklist[index].done = !state.project.deployment.checklist[index].done;
  saveProject("Checklist updated");
  renderDeploymentPlan();
}

function addMilestone() {
  state.project.deployment.timeline.push({
    day: "Days TBD",
    title: "New milestone",
    owner: "Owner",
    goal: "Describe what happens during this rollout stage.",
    exitCriteria: "Describe what must be true before moving forward.",
    status: "Planned",
  });
  saveProject("Milestone added");
  renderDeploymentPlan();
}

function addBlocker() {
  state.project.deployment.blockers.push({
    title: "New blocker",
    owner: "Owner",
    severity: "Medium",
    status: "Open",
    detail: "Describe what blocks production or scale-up.",
  });
  saveProject("Blocker added");
  renderDeploymentPlan();
}

function addChecklistItem() {
  state.project.deployment.checklist.push({
    text: "New checklist item",
    owner: "Owner",
    done: false,
  });
  saveProject("Checklist item added");
  renderDeploymentPlan();
}

function deleteDeploymentItem(kind, index) {
  if (!state.project.deployment[kind] || state.project.deployment[kind].length <= 1) return;
  state.project.deployment[kind].splice(index, 1);
  saveProject("Deployment item deleted");
  renderDeploymentPlan();
}

function exportWorkspace() {
  const payload = {
    exportedAt: new Date().toISOString(),
    product: "PRAXIS MVP",
    project: state.project,
    selectedOpportunity: state.selectedOpportunity,
    evals: state.project.evalCases,
    documents: state.documents,
    playbookLibrary: state.playbooks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeClient = state.project.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  link.href = url;
  link.download = `praxis-${safeClient || "workspace"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStorageStatus("Exported JSON", "green");
}

function importWorkspace(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      state.project = normalizeProject(parsed.project || parsed);
      state.selectedOpportunity = parsed.selectedOpportunity || "aml";
      if (Array.isArray(parsed.playbookLibrary)) {
        state.playbooks = parsed.playbookLibrary.map(normalizePlaybook);
        savePlaybooks();
      }
      if (Array.isArray(parsed.documents)) {
        state.documents = parsed.documents.map(normalizeDocument);
        saveDocumentsLocal();
      }
      state.evalsRun = false;
      saveProject("Imported JSON");
      renderAll();
      switchView("workspace");
    } catch (error) {
      console.warn("Could not import workspace", error);
      setStorageStatus("Import failed", "amber");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function renderReadout() {
  const wasRun = state.evalsRun;
  const project = state.project;
  const value = computeValueModel();
  const connectors = getConnectorHealth();
  const documents = getDocumentHealth();
  const governance = getGovernanceHealth();
  const bottleneck =
    project.processSteps.find((step) => step.tags.some((tag) => tag.toLowerCase() === "bottleneck")) ||
    project.processSteps[0];
  document.querySelector("#readout-content").innerHTML = `
    <article class="readout-card full">
      <div class="eyebrow">Executive headline</div>
      <h2>${escapeHtml(project.clientName)} can move ${escapeHtml(project.workflowName)} from ${escapeHtml(project.beforeTime)} to ${escapeHtml(project.afterTime)} while keeping human control where risk is high.</h2>
      <p>
        PRAXIS identified ${escapeHtml(bottleneck.title)} as the main bottleneck, built an agent-assisted workflow,
        connected the required tools, and ${wasRun ? "validated the pilot against historic cases" : "prepared the eval plan for historic case testing"}.
      </p>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Before and after</div>
      <div class="metric-pair">
        <div class="before">
          <strong>Before</strong>
          <p>${escapeHtml(project.beforeTime)} per case, manual work across several systems, inconsistent notes.</p>
        </div>
        <div class="after">
          <strong>After</strong>
          <p>${escapeHtml(project.afterTime)} per case, agent prepares evidence, human approves final action.</p>
        </div>
      </div>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Scale plan</div>
      <ul class="check-list">
        <li>Week 1: 5 analysts, 500 historic cases, no automatic filing.</li>
        <li>Week 2: live pilot on low-risk alerts with human approval.</li>
        <li>Week 4: expand to all AML analysts if evals remain stable.</li>
      </ul>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Value case</div>
      <h3>${formatCompactMoney(value.annualNetValue)} annual net value</h3>
      <p>
        ${Math.round(value.adoptedMonthlyHours).toLocaleString()} hours saved per month at current adoption.
        Payback: ${Number.isFinite(value.paybackMonths) ? `${value.paybackMonths.toFixed(1)} months` : "N/A"}.
      </p>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Connectors</div>
      <h3>${connectors.averageScore}% data-ready</h3>
      <p>
        ${project.connectors.length} source systems mapped, ${connectors.sensitive} sensitive sources,
        ${connectors.blocked} blocked connector${connectors.blocked === 1 ? "" : "s"}.
      </p>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Knowledge</div>
      <h3>${documents.count} docs indexed</h3>
      <p>
        ${documents.totalChunks} chunks prepared for retrieval, ${documents.systems.length} systems found,
        ${documents.riskDocs} risk-bearing document${documents.riskDocs === 1 ? "" : "s"}.
      </p>
    </article>
    <article class="readout-card">
      <div class="eyebrow">Governance</div>
      <h3>${governance.score}% governed</h3>
      <p>
        ${governance.pendingApprovals} approval gate${governance.pendingApprovals === 1 ? "" : "s"} pending.
        Audit coverage is ${governance.auditCoverage ? "ready" : "incomplete"}.
      </p>
    </article>
    <article class="readout-card full">
      <div class="eyebrow">Open blockers</div>
      <p>
        Transaction API needs stronger documentation. Policy citations need owner approval.
        Compliance wants weekly audit export during the first month of production.
      </p>
    </article>
  `;
}

function renderPlaybooks() {
  const query = state.playbookSearch.toLowerCase();
  const filtered = state.playbooks.filter((playbook) =>
    [playbook.name, playbook.industry, playbook.clientName, playbook.copy, playbook.modules.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
  document.querySelector("#playbook-count").textContent = `${state.playbooks.length} templates`;
  document.querySelector("#playbook-stats").innerHTML = `
    <article class="playbook-stat">
      <span>Saved templates</span>
      <strong>${state.playbooks.length}</strong>
    </article>
    <article class="playbook-stat">
      <span>Avg readiness</span>
      <strong>${average(state.playbooks.map((playbook) => playbook.metrics.readiness))}%</strong>
    </article>
    <article class="playbook-stat">
      <span>Industries</span>
      <strong>${new Set(state.playbooks.map((playbook) => playbook.industry)).size}</strong>
    </article>
  `;
  document.querySelector("#playbook-grid").innerHTML = filtered.length
    ? filtered
    .map(
      (playbook) => `
        <article class="playbook-card">
          <div class="eyebrow">${escapeHtml(playbook.industry)} · ${escapeHtml(playbook.source)}</div>
          <h3>${escapeHtml(playbook.name)}</h3>
          <p>${escapeHtml(playbook.copy)}</p>
          <div class="playbook-metrics">
            <div class="playbook-metric">
              <span>Readiness</span>
              <strong>${playbook.metrics.readiness}%</strong>
            </div>
            <div class="playbook-metric">
              <span>Tools</span>
              <strong>${playbook.metrics.tools}</strong>
            </div>
            <div class="playbook-metric">
              <span>Evals</span>
              <strong>${playbook.metrics.evals}</strong>
            </div>
          </div>
          <div class="tag-list">
            ${playbook.modules.map((module) => `<span class="tag">${escapeHtml(module)}</span>`).join("")}
          </div>
          <div class="playbook-card-actions">
            <button class="primary-button small" data-clone-playbook="${escapeHtml(playbook.id)}">Use playbook</button>
            ${playbook.id.startsWith("default-") ? "" : `<button class="ghost-button small" data-delete-playbook="${escapeHtml(playbook.id)}">Delete</button>`}
          </div>
        </article>
      `,
    )
    .join("")
    : `<article class="playbook-card"><h3>No playbooks found</h3><p>Try a different search or save the current workspace as a new playbook.</p></article>`;

  document.querySelectorAll("[data-clone-playbook]").forEach((button) => {
    button.addEventListener("click", () => clonePlaybook(button.dataset.clonePlaybook));
  });
  document.querySelectorAll("[data-delete-playbook]").forEach((button) => {
    button.addEventListener("click", () => deletePlaybook(button.dataset.deletePlaybook));
  });
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function buildPlaybookFromProject() {
  const health = getDeploymentHealth();
  const selectedOpportunity =
    state.project.opportunities.find((opp) => opp.id === state.selectedOpportunity) || state.project.opportunities[0];
  const modules = unique([
    "Context",
    "Tools",
    "Evals",
    "Deployment",
    ...(selectedOpportunity?.modules || []).map((module) => module.replace(" Graph", "").replace(" Fabric", "")),
  ]).slice(0, 7);
  return normalizePlaybook({
    id: `custom-${Date.now()}`,
    name: state.project.workflowName,
    industry: inferIndustryFromProject(state.project),
    clientName: state.project.clientName,
    copy: state.project.businessProblem,
    modules,
    metrics: {
      readiness: Number(state.project.readiness) || 0,
      tools: state.project.tools.length,
      evals: state.project.evalCases.length,
      timeline: state.project.deployment.timeline.length,
      deploymentReady: health.ready,
    },
    source: "Saved workspace",
    createdAt: new Date().toISOString(),
    projectSnapshot: clone(state.project),
  });
}

function saveCurrentAsPlaybook() {
  const playbook = buildPlaybookFromProject();
  state.playbooks = [playbook, ...state.playbooks.filter((item) => item.id !== playbook.id)];
  savePlaybooks();
  renderPlaybooks();
  setStorageStatus("Playbook saved", "green");
}

function getDefaultPlaybookProject(playbook) {
  const key = playbook.id === "default-claims" ? "insurance" : playbook.id === "default-contract" ? "legal" : "banking";
  return normalizeProject(clone(intakePresets[key].project));
}

function clonePlaybook(playbookId) {
  const playbook = state.playbooks.find((item) => item.id === playbookId);
  if (!playbook) return;
  state.project = normalizeProject(playbook.projectSnapshot ? clone(playbook.projectSnapshot) : getDefaultPlaybookProject(playbook));
  state.selectedOpportunity = state.project.opportunities[0]?.id || "aml";
  state.evalsRun = state.project.evalCases.some((test) => test.result !== "pending");
  saveProject(`Loaded playbook: ${playbook.name}`);
  renderAll();
  switchView("workspace");
}

function deletePlaybook(playbookId) {
  state.playbooks = state.playbooks.filter((playbook) => playbook.id !== playbookId || playbook.id.startsWith("default-"));
  savePlaybooks();
  renderPlaybooks();
}

function switchView(viewId) {
  state.activeView = viewId;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });
  const activeButton = document.querySelector(`[data-view="${viewId}"]`);
  document.querySelector("#view-title").textContent = activeButton ? activeButton.textContent.trim().replace(/^\d+\s*/, "") : "Workspace";
}

function resetDemo() {
  state.selectedOpportunity = "aml";
  state.evalsRun = false;
  state.project = createDefaultProject();
  state.project.evalCases.forEach((test) => {
    test.result = "pending";
    test.actual = "";
  });
  document.querySelector("#eval-status").textContent = "Not run";
  document.querySelector("#eval-status").className = "status-pill";
  document.querySelector("#eval-summary-title").textContent = "Waiting for test run";
  document.querySelector("#eval-summary-copy").textContent =
    'Press "Run evals" to simulate the FDE testing the agent against historic AML cases.';
  document.querySelector("#score-ring span").textContent = "--";
  saveProject("Demo reset");
  renderAll();
  switchView("intake");
}

function renderAll(options = {}) {
  renderIntake();
  renderProjectSummary();
  renderMetrics();
  renderLayers();
  renderProcess();
  renderProcessEditor();
  renderContextGraph();
  renderConnectors();
  renderDocuments();
  renderOpportunityTable();
  renderSelectedOpportunity();
  renderValueModel();
  renderWorkflow();
  renderTools();
  renderToolFabric();
  renderToolSandbox();
  renderGovernance();
  renderPilotRunConsole();
  renderHandoffQueue();
  renderEvals();
  renderDeploymentPlan();
  renderReadout();
  renderPlaybooks();
  renderDatabaseStatus();
  if (!options.keepFormValues) {
    populateProjectForm();
    populateValueForm();
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

state.project = loadProject();
state.playbooks = loadPlaybooks();
state.documents = loadDocuments();

document.querySelector("#project-form").addEventListener("submit", (event) => {
  event.preventDefault();
  applyProjectForm();
});
document.querySelector("#save-workspace").addEventListener("click", () => {
  applyProjectForm();
  saveProject();
});
document.querySelector("#backup-database").addEventListener("click", backupDatabase);
document.querySelector("#export-workspace").addEventListener("click", exportWorkspace);
document.querySelector("#import-workspace").addEventListener("change", importWorkspace);
document.querySelector("#generate-intake").addEventListener("click", generateWorkspaceFromIntake);
document.querySelector("#clear-intake").addEventListener("click", clearIntake);
document.querySelectorAll("[data-intake-preset]").forEach((button) => {
  button.addEventListener("click", () => loadIntakePreset(button.dataset.intakePreset));
});
document.querySelector("#add-step").addEventListener("click", addProcessStep);
document.querySelector("#add-connector").addEventListener("click", addConnector);
document.querySelector("#document-files").addEventListener("change", ingestDocumentFiles);
document.querySelector("#ingest-document-text").addEventListener("click", ingestPastedDocument);
document.querySelector("#clear-document-text").addEventListener("click", () => {
  document.querySelector("#document-name").value = "";
  document.querySelector("#document-text").value = "";
});
document.querySelector("#document-search").addEventListener("input", (event) => {
  state.documentSearch = event.target.value;
  renderDocuments();
});
document.querySelector("#add-tool").addEventListener("click", addTool);
document.querySelector("#generate-mcp-server").addEventListener("click", generateMcpServer);
document.querySelector("#import-openapi").addEventListener("click", importOpenApiTools);
document.querySelector("#run-tool-sandbox").addEventListener("click", runToolSandbox);
document.querySelector("#add-policy").addEventListener("click", addPolicy);
document.querySelector("#add-approval").addEventListener("click", addApproval);
document.querySelector("#run-governance-check").addEventListener("click", runGovernanceCheck);
document.querySelector("#run-governance-enforcement").addEventListener("click", runGovernanceEnforcement);
document.querySelector("#refresh-pilot-run").addEventListener("click", async () => {
  state.agentRuntimeRun = null;
  await refreshRetrievalEvidence();
});
document.querySelector("#run-agent-runtime").addEventListener("click", runAgentRuntime);
document.querySelector("#save-pilot-run").addEventListener("click", savePilotRun);
document.querySelector("#refresh-handoffs").addEventListener("click", refreshHandoffs);
document.querySelector("#add-eval-case").addEventListener("click", addEvalCase);
document.querySelector("#add-milestone").addEventListener("click", addMilestone);
document.querySelector("#add-blocker").addEventListener("click", addBlocker);
document.querySelector("#add-checklist-item").addEventListener("click", addChecklistItem);
document.querySelector("#save-playbook").addEventListener("click", saveCurrentAsPlaybook);
document.querySelector("#playbook-search").addEventListener("input", (event) => {
  state.playbookSearch = event.target.value;
  renderPlaybooks();
});
document.querySelector("#value-form").addEventListener("submit", (event) => {
  event.preventDefault();
  updateValueModel();
});
document.querySelector("#apply-value-kpi").addEventListener("click", applyValueToWorkspaceKpi);
document.querySelector("#run-demo").addEventListener("click", runEvals);
document.querySelector("#reset-demo").addEventListener("click", resetDemo);
document.querySelector("#rescore").addEventListener("click", renderOpportunityTable);
document.querySelector("#generate-readout").addEventListener("click", () => {
  renderReadout();
  switchView("readout");
});

renderAll();
hydrateFromBackend();
