-- PRAXIS Postgres-ready schema draft.
-- This keeps JSONB where the MVP still evolves quickly, but gives every core object
-- a stable relational home for the next hosted version.

create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'fde',
  workspace_role text not null default 'Contributor',
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text not null default 'local',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table scim_group_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  external_group text not null,
  praxis_role text not null,
  member_count integer not null default 0,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  client_name text not null,
  workflow_name text not null,
  selected_opportunity text not null default 'aml',
  evals_run boolean not null default false,
  project jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table database_migrations (
  id text primary key,
  from_version integer,
  to_version integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table database_backups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  file_name text not null,
  storage_uri text not null,
  size_bytes integer not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

create table context_graph_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  client_name text not null,
  workflow_name text not null,
  node_count integer not null default 0,
  edge_count integer not null default 0,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  lineage text[] not null default '{}',
  search_index jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  type text not null,
  owner text,
  access_mode text,
  data_class text,
  status text,
  refresh_cadence text,
  purpose text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table connector_test_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  connector_count integer not null default 0,
  average_score integer not null default 0,
  pass_count integer not null default 0,
  warn_count integer not null default 0,
  fail_count integer not null default 0,
  ready_for_pilot boolean not null default false,
  dry_run_only boolean not null default true,
  failure_catalog text[] not null default '{}',
  source_checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  source_type text not null,
  template_key text,
  summary text,
  systems text[] not null default '{}',
  keywords text[] not null default '{}',
  signals jsonb not null default '{}'::jsonb,
  size_bytes integer not null default 0,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_key text not null,
  text text not null,
  keywords text[] not null default '{}',
  characters integer not null default 0,
  search_vector tsvector generated always as (to_tsvector('english', text)) stored,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_key)
);

create index document_chunks_search_idx on document_chunks using gin(search_vector);

create table tools (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  owner text,
  auth_model text,
  risk text,
  method text,
  path text,
  imported_from text,
  failure_modes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table tool_sandbox_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tool_count integer not null default 0,
  pass_count integer not null default 0,
  warn_count integer not null default 0,
  fail_count integer not null default 0,
  ready_for_agent_runtime boolean not null default false,
  failure_catalog text[] not null default '{}',
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table governance_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  area text not null,
  rule text not null,
  owner text,
  severity text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table approval_gates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  gate text not null,
  approver text,
  status text not null,
  due text,
  notes text,
  created_at timestamptz not null default now()
);

create table governance_enforcement_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  decision text not null,
  masked_input text,
  redactions jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  policy_decisions jsonb not null default '[]'::jsonb,
  tool_decisions jsonb not null default '[]'::jsonb,
  secrets_manifest jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table eval_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  category text,
  severity text not null,
  input text,
  expected text,
  actual text,
  result text not null default 'pending',
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  client_name text not null,
  workflow_name text not null,
  gate_score integer,
  passed boolean not null default false,
  retrieval_coverage integer not null default 0,
  recommendation_match integer not null default 0,
  hallucination_warnings integer not null default 0,
  regressions integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  eval_cases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table pilot_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  client_name text not null,
  workflow_name text not null,
  outcome text not null,
  confidence integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table run_trace_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references pilot_runs(id) on delete cascade,
  position integer not null,
  layer text not null,
  title text not null,
  detail text,
  status text,
  created_at timestamptz not null default now()
);

create table handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  run_id uuid references pilot_runs(id) on delete set null,
  client_name text not null,
  workflow_name text not null,
  gate text not null,
  approver text,
  status text not null default 'Pending',
  priority text not null default 'Medium',
  reason text,
  recommendation text,
  next_action text,
  confidence integer,
  evidence_count integer not null default 0,
  tool_count integer not null default 0,
  due_at timestamptz,
  reviewer_notes text,
  decision text,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  surface text not null default 'Workspace',
  status text not null default 'Open',
  created_at timestamptz not null default now()
);

create table workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  owner_id uuid references users(id) on delete set null,
  title text not null,
  due text,
  status text not null default 'Open',
  priority text not null default 'Medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playbooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  industry text,
  client_name text,
  description text,
  modules text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  project_snapshot jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now()
);

create table playbook_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  playbook_id uuid references playbooks(id) on delete set null,
  name text not null,
  industry text,
  version text not null,
  fingerprint text not null,
  quality_score integer not null default 0,
  usage_count integer not null default 0,
  marketplace_status text not null default 'published',
  package jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique(organization_id, fingerprint)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspaces_org_idx on workspaces(organization_id);
create index users_org_idx on users(organization_id);
create index auth_sessions_user_idx on auth_sessions(user_id);
create index scim_group_mappings_org_idx on scim_group_mappings(organization_id);
create index connectors_workspace_idx on connectors(workspace_id);
create index documents_workspace_idx on documents(workspace_id);
create index tools_workspace_idx on tools(workspace_id);
create index tool_sandbox_runs_workspace_idx on tool_sandbox_runs(workspace_id);
create index governance_enforcement_workspace_idx on governance_enforcement_runs(workspace_id);
create index eval_cases_workspace_idx on eval_cases(workspace_id);
create index eval_runs_workspace_idx on eval_runs(workspace_id);
create index pilot_runs_workspace_idx on pilot_runs(workspace_id);
create index handoffs_workspace_idx on handoffs(workspace_id);
create index handoffs_status_idx on handoffs(status);
create index workspace_comments_workspace_idx on workspace_comments(workspace_id);
create index workspace_tasks_workspace_idx on workspace_tasks(workspace_id);
create index database_backups_org_idx on database_backups(organization_id);
create index context_graph_snapshots_workspace_idx on context_graph_snapshots(workspace_id);
create index playbook_registry_org_idx on playbook_registry(organization_id);
create index playbook_registry_fingerprint_idx on playbook_registry(fingerprint);
create index audit_events_workspace_idx on audit_events(workspace_id);
