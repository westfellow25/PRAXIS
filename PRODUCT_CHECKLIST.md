# PRAXIS Product Checklist

Легенда:

- `[x]` сделано в текущем локальном MVP
- `[ ]` еще не сделано
- `Частично` означает: экран или логика есть, но пока без реального backend/API/LLM-интеграции

## 1. Основная идея продукта

| Галочка | Блок | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | FDE Operating System | Не агент вместо FDE, а экзоскелет для FDE | Готово | Концепция заложена во всей структуре MVP |
| [x] | Повторяемый deployment workflow | Intake -> context -> connectors -> tools -> agent -> evals -> deployment -> readout -> playbook | Готово | В MVP есть весь сквозной путь |
| [x] | Reusable playbooks | Успешный кейс превращается в шаблон | Готово | Есть Playbooks: save, search, clone, export/import |
| [ ] | Реальный multi-user collaboration | Совместная работа FDE, клиента и руководителей | Не начато | Локальный backend появился, но accounts/permissions еще нет |
| [ ] | Реальный enterprise deployment | VPC/on-prem/cloud deployment | Не начато | Пока локальный MVP; нужен внешний cloud/VPC контур |

## 2. Connectors Layer

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Connector inventory | Список систем клиента | Готово | Есть экран Connectors |
| [x] | Access mode | Read-only, pending, write with approval, no access | Готово | Редактируется вручную |
| [x] | Data class | Internal, Confidential, PII, Regulated | Готово | Есть risk map |
| [x] | Owner mapping | Кто владеет системой | Готово | Есть owner field |
| [x] | Refresh cadence | Realtime/hourly/daily/manual | Готово | Есть поле refresh |
| [x] | Connector readiness score | Оценка готовности источника | Готово | Есть scoring logic |
| [x] | Ingestion plan | Connect -> Mask -> Index -> Prove | Готово | Есть визуальный ingestion flow |
| [ ] | Реальные Slack/Teams connectors | Подключение к перепискам | Не начато | Нужны OAuth/API |
| [ ] | Реальные Drive/SharePoint/Confluence connectors | Подключение документов | Частично | Knowledge Base уже принимает local file/paste ingestion, OAuth connectors ещё не готовы |
| [ ] | Реальные Jira/ServiceNow/Salesforce connectors | Подключение workflow-систем | Не начато | Нужны интеграции |
| [ ] | Реальные Snowflake/BigQuery/Postgres connectors | Подключение данных | Не начато | Нужны credentials, query layer |
| [ ] | Реальные GitHub/GitLab connectors | Подключение коду и API docs | Не начато | Нужны OAuth/API |

## 3. Identity & Permissions Layer

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Access awareness in UI | PRAXIS показывает access mode и blocked sources | Частично | Есть модель доступа на уровне connector/tool |
| [x] | Human approval flags | Действия с риском требуют approval | Готово для MVP | Governance approvals, tool auth и runtime decision `approval_required` уже связаны |
| [x] | Audit trail requirements | Что надо логировать в каждом run | Готово для MVP | Есть audit events, `/api/governance/enforce` и runtime trace |
| [ ] | SSO | Enterprise login через Okta/Azure AD/Google | Не начато | Нужен backend |
| [ ] | SCIM | Sync users/groups | Не начато | Нужен enterprise identity layer |
| [ ] | RBAC/ABAC | Реальные роли и политики доступа | Не начато | Сейчас только вручную описывается |
| [x] | OPA/policy engine | Машинное enforcement правил | Готово для MVP | `/api/governance/enforce` делает allow/approval/block, policy decisions, tool decisions и audit |
| [x] | Secrets vault | Хранение API keys/secrets | Готово для MVP | Есть secrets manifest и env-ref checks; реальный Vault/KMS нужен в hosted версии |

## 4. Context Graph

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | People & owners | Люди, команды, владельцы шагов | Готово | Строится из Process Map |
| [x] | Systems & records | Системы и источники данных | Готово | Теперь строится из Connectors |
| [x] | Agent tools | Инструменты агента | Готово | Тянется из Tool Fabric |
| [x] | Controls & evals | Human review, eval gate, audit trail, bottleneck | Готово | Есть readiness checklist |
| [x] | Readiness blockers | Что мешает production | Готово | Есть статус readiness |
| [ ] | Реальный graph database | Neo4j/TypeDB/Postgres graph | Не начато | Сейчас DOM/JS model |
| [ ] | Автоматическое построение из корпоративных данных | Mining из Slack/docs/tickets/API | Частично | Документы можно загрузить вручную; автоматический mining из SaaS-систем ещё не готов |
| [ ] | Semantic search over graph | Поиск по процессам/людям/решениям | Не начато | Нужен backend/index |

## 5. Workflow Mining Layer

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Process Map | Карта текущего процесса | Готово | Есть экран Process Map + editor |
| [x] | Bottleneck detection | Где ручная работа/ожидание/ошибки | Частично | Сейчас определяется из tags и demo templates |
| [x] | Opportunity Board | Список AI-возможностей | Готово | Есть impact/risk/complexity/data/API scoring |
| [x] | Time-to-pilot style reasoning | Первый лучший workflow для пилота | Частично | Есть selected pilot и summaries |
| [ ] | Реальный process mining | Автоматический mining из logs/tickets/calls | Не начато | Нужны реальные данные и backend jobs |
| [ ] | Автоматический ROI opportunity discovery | Автопоиск use cases по данным компании | Не начато | Пока deterministic presets |
| [ ] | Cross-company benchmarks | Сравнение с похожими компаниями | Не начато | Нужна база playbooks/deployments |

## 6. Tool & API Fabric

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Tool inventory | Список agent-ready tools | Готово | Есть Tool Fabric |
| [x] | Callable signature | Например getCustomerKYC(customer_id) | Готово | Редактируется |
| [x] | Auth model | Read-only, delegated, approval, human-only | Готово | Есть поле auth |
| [x] | Risk level | Low/Medium/High | Готово | Есть поле risk |
| [x] | Tool readiness score | Оценка готовности tool | Готово | Есть scoring |
| [x] | MCP-style manifest | JSON preview tool contract | Готово | Есть manifest preview |
| [x] | Реальный OpenAPI ingestion | Импорт OpenAPI specs | Готово для MVP | Paste OpenAPI JSON -> `/api/openapi/import` -> Tool Fabric rows; upload/codegen позже |
| [x] | Реальный MCP server generation | Генерация MCP tools | Готово для MVP | `/api/mcp/generate` создаёт starter MCP server scaffold; real API wiring позже |
| [x] | Tool sandbox execution | Безопасный пробный вызов API | Готово для MVP | `/api/tools/sandbox` делает dry-run validation без внешних API calls |
| [x] | Error/failure mode catalog | Ошибки API и safe defaults | Готово для MVP | Sandbox catalog ловит missing contract, auth, approval, owner, readiness и failure-mode gaps |

## 7. Agent Runtime

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Visual Agent Builder | Trigger -> Context -> Tools -> Reasoning -> Human Review -> Action -> Logging | Готово | Есть Agent Builder |
| [x] | Human-in-loop design | Человек утверждает risky cases | Готово | Отражено в workflow/governance |
| [x] | Pilot Run Console | Один кейс проходит через весь stack | Готово | Есть backend Agent Runtime trace, evidence, decision, audit |
| [ ] | Discovery Agent | Помогает FDE понять компанию | Частично | Backend intake engine уже строит workspace patch, но пока без настоящего LLM |
| [ ] | Process Analyst Agent | Автоматически строит process map | Не начато | Нужен LLM |
| [ ] | Data Readiness Agent | Анализирует качество данных | Не начато | Нужны connectors + evals |
| [ ] | API Readiness Agent | Проверяет API пригодность | Не начато | Нужен OpenAPI/API testing |
| [x] | Workflow Agent | Реально выполняет задачу | Частично | `/api/agent/run` выполняет deterministic runtime: retrieval, tools, evals, governance, decision, audit; настоящие tool calls еще не подключены |
| [x] | Compliance Agent | Реально проверяет политики | Готово для MVP | `/api/governance/check` делает pre-flight findings, `/api/governance/enforce` применяет runtime masking, approvals, tool policy и secrets manifest |
| [x] | Human Handoff Agent | Очередь ручных решений | Готово для MVP | Agent Runtime создаёт handoff queue item; UI поддерживает approve/escalate/block; SLA alerts показывают overdue/due soon/escalated; external notifications позже |

## 8. Evals & Observability

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Eval Center | Тесты перед production | Готово | Есть eval suite |
| [x] | Test case editor | Input, expected, category, severity | Готово | Редактируется |
| [x] | Deterministic eval gate | Pass/warn/fail simulation | Готово | Есть run evals |
| [x] | Critical blocker logic | Critical fail блокирует pilot | Готово | Есть logic |
| [x] | Audit trace in Pilot Console | Что было сделано и записано | Готово для MVP | Backend Agent Runtime сохраняет trace; eval runs сохраняют quality history; реальные model/tool payloads позже |
| [x] | Golden datasets | Реальные historical cases | Готово для MVP | Eval cases стали локальным synthetic/historic dataset; customer datasets подключаются позже через connectors |
| [x] | Retrieval accuracy evals | Проверка, нашёл ли агент правильные документы | Готово для MVP | Backend eval runner считает retrieval coverage и сохраняет evidence per case |
| [x] | Recommendation match evals | Сравнение с human decisions | Готово для MVP | Backend eval runner считает recommendation-match score и учитывает saved handoff decision history |
| [x] | Hallucination checks | Проверка unsupported claims | Готово для MVP | Backend eval runner флагует high/critical cases без supporting retrieval evidence как hallucination warnings |
| [x] | Cost/latency tracking | Метрики каждого agent run | Готово для MVP | `/api/telemetry` агрегирует latency, cost, confidence, human review rate и Value screen показывает runtime telemetry |
| [x] | Regression history | История качества по версиям | Готово для MVP | `/api/evals/run` сохраняет evalRuns; UI показывает Regression History и drift |

## 9. Engagement Workspace

| Галочка | Функция | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Shared workspace structure | Единое место для процесса, tools, evals, blockers | Готово | Все экраны собраны в одном приложении |
| [x] | Workspace editor | Client, KPI, problem, first agent | Готово | Есть Workspace |
| [x] | Deployment plan | Timeline, blockers, checklist | Готово | Есть Deployment |
| [x] | Executive Readout | C-level summary | Готово | Есть Executive Readout |
| [x] | Local persistence | Сохранение workspace | Готово | localStorage |
| [x] | JSON export/import | Перенос workspace | Готово | Есть кнопки export/import |
| [ ] | Comments/mentions | Совместные обсуждения | Не начато | Нужен backend |
| [x] | Tasks/owners with notifications | Реальные assignment/alerts | Готово для MVP | Handoff queue хранит approver/status/due date; `/api/handoffs/alerts` и UI показывают overdue/due soon/escalated SLA reminders; external email/slack позже |
| [ ] | Role-based views | FDE/client/executive/compliance modes | Не начато | Можно добавить в UI |

## 10. Типовой AML workflow

| Галочка | Шаг | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Kickoff | Создать workspace Bank AML Automation | Готово | Demo AML workspace есть |
| [x] | Подключение данных | ServiceNow, KYC, transactions, sanctions, docs | Частично | Как connector model, без реальных API |
| [x] | Context Graph | Кто, что, где делает | Готово | Есть Context Graph |
| [x] | Поиск bottleneck | 70% времени на сбор информации | Частично | Есть bottleneck в process map |
| [x] | Tool readiness | API readiness + blockers | Готово | Есть Tool Fabric + Connectors |
| [x] | Построение агента | Workflow AML Alert Briefing Agent | Готово | Есть Agent Builder |
| [x] | Evals | Historic-case eval plan | Готово для MVP | Есть backend eval runner, eval history, retrieval coverage, recommendation match, hallucination warnings и regression tracking |
| [x] | Pilot | 5 analysts, time saved, correctness, human review | Частично | Есть backend Agent Runtime, Pilot Console и Value Model, без реальных пользователей |
| [x] | Executive readout | Презентационный summary для VP/C-level | Готово | Есть экран |
| [x] | Generalize into playbook | AML Alert Briefing Playbook | Готово | Есть Playbooks |

## 11. Главные экраны интерфейса

| Галочка | Экран | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | AI Intake | Ввод messy process | Готово | Есть presets + textarea |
| [x] | Workspace | Основная карточка клиента | Готово | Есть форма |
| [x] | Process Map | Карта процесса | Готово | Есть map + editor |
| [x] | Context Graph | Живая карта компании | Готово | Есть graph lanes |
| [x] | Connectors | Источники данных и readiness | Готово | Добавлено |
| [x] | Knowledge Base | Загрузка документов клиента, chunks, signals, systems | Готово | Первый real connector без OAuth: file/paste ingestion |
| [x] | Opportunity Board | Список AI-возможностей | Готово | Есть scoring table |
| [x] | Tool Fabric | API/tools готовность | Готово | Есть readiness + manifest |
| [x] | Governance | Policies, approvals, audit | Готово | Есть отдельный экран |
| [x] | Value Model | ROI, hours, payback | Готово | Есть model + scenarios + backend runtime telemetry через `/api/telemetry` |
| [x] | Agent Builder | Visual workflow canvas | Готово | Есть |
| [x] | Pilot Console | End-to-end run trace | Готово | Добавлено |
| [x] | Eval Center | Тестовая лаборатория агента | Готово | Есть |
| [x] | Deployment | 30-day rollout | Готово | Есть |
| [x] | Executive Readout | Dashboard для руководства | Готово | Есть |
| [x] | Playbooks | Library reusable deployments | Готово | Есть |

## 12. Moat / защита бизнеса

| Галочка | Moat | Что должно быть | Статус | Комментарий |
|---|---|---|---|---|
| [x] | Context Graph как память transformation | Карта процессов и систем | Частично | Есть модель, нет backend/graph DB |
| [x] | Agent-ready tools | Безопасные API для агентов | Готово для MVP | Есть design layer, OpenAPI import, MCP scaffold, sandbox dry-run и failure catalog; production API execution позже |
| [x] | Eval library | Библиотека тестов по индустриям | Частично | Есть templates, нет реальной базы |
| [x] | Playbook marketplace | Повторяемые deployment-шаблоны | Частично | Есть local library, нет marketplace |
| [x] | Governance | Безопасный enterprise deployment | Готово для MVP | Есть UI, approvals, audit checklist, pre-flight check, runtime enforcement, masking и secrets manifest; production Vault/KMS позже |
| [ ] | Cross-customer learning | Каждый deployment улучшает платформу | Не начато | Нужна hosted платформа и data model |
| [ ] | Integration breadth | Много реальных connectors | Не начато | Нужна интеграционная команда |
| [ ] | Switching cost | Клиент хранит deployment memory в PRAXIS | Не начато | Появится после backend/workspaces |

## 13. Следующие инженерные шаги

| Приоритет | Галочка | Задача | Почему важно |
|---|---|---|---|
| P0 | [ ] | Перенести проект в нормальный repo | Нужна база для разработки |
| P0 | [x] | Добавить backend | Локальный Node backend готов без внешних зависимостей |
| P0 | [x] | Добавить database schema | JSON schema готова в `DATABASE_SCHEMA.md`; локальная БД `data/praxis-db.json` |
| P0 | [x] | Подключить реальный LLM intake | Частично: backend поддерживает OpenAI-compatible `LLM_ENDPOINT`/`LLM_MODEL`/`LLM_API_KEY`, но без ключа работает deterministic fallback |
| P1 | [x] | Реальный run trace storage | Pilot Console сохраняет ручные runs через `POST /api/runs`; Agent Runtime сохраняет runs через `POST /api/agent/run` |
| P1 | [x] | Реальный eval runner | Готово для MVP: backend проверяет eval dataset, evidence, recommendation match, hallucination risk и regression history |
| P1 | [x] | OpenAPI/MCP import | OpenAPI JSON превращается в Tool Fabric rows; MCP server scaffold генерируется через `/api/mcp/generate` |
| P1 | [ ] | Auth/permissions model | Enterprise-grade trust |
| P2 | [x] | First real connector | Local file/paste document ingestion готов в Knowledge Base |
| P2 | [ ] | Team collaboration | Несколько пользователей в workspace |
| P2 | [ ] | Hosted deployment | Vercel/Render/Fly/Cloud Run |
