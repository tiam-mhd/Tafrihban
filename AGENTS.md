# Tafrihban project instructions for Codex

These instructions are the repository's persistent engineering baseline. At the start of every coding task, read this file and the relevant parts of:

- Tafrihban_Project_Description_FA_EN.md
- Tafrihban_Future_Features_Roadmap.md
- Tafrihban_Technical_Engineering_Spec.md
- Tafrihban_Codex_Build_Prompt.md, when it applies to initial implementation

Inspect the repository and its current instructions before editing. Preserve working user changes. Follow higher-priority system and developer instructions. A user can explicitly change a product decision; when they do, update this file, the relevant specification, code, and tests together so the change is visible and consistent. Do not silently discard these requirements.

## Product boundaries

- Tafrihban is a Persian-first PWA for amusement-equipment records, inspections, defects, corrective actions, and maintenance.
- It is not ticketing, generic park ERP, accounting, or a safety-certification authority.
- A qualified human makes operating and safety decisions. No software rule or AI output may certify equipment safe or authorize operation.
- Build the agreed MVP. Treat the roadmap as future options, not permission to implement every feature now.

## Mandatory data and identity model

- Keep every operational account in one global users table.
- Model organizations, branches, organization memberships, branch memberships, scoped roles, permissions, assignments, and constraints as first-class database records from the beginning.
- A user may belong to multiple organizations and branches. Scope grants must never spill from one organization or branch to another.
- Keep platform administrators in a separate platform_admins table with separate roles, permissions, assignments, sessions/auth guard, and audit trail. Do not model a platform admin as an operational user with a privileged tenant role.
- Bootstrap the initial SUPERADMIN through an explicit, idempotent setup command using operator-provided environment secrets. Never commit or invent an email, password, token, or production default.
- Give the SUPERADMIN role a permission-engine wildcard such as grants_all_permissions. It must automatically include permissions added in the future without manual assignment.
- SUPERADMIN can manage organizations, branches, initial customer managers, and platform configuration. Log every global action.

## Non-negotiable authorization and security

- Deny by default. Enforce authentication, authorization, organization scope, and branch scope on the server for every read, write, export, and background job.
- Never trust user_id, role, permission, organization_id, branch_id, tenant scope, or SUPERADMIN claims from browser input.
- UI hiding is not authorization. Resolve scope from trusted identity and database memberships.
- Test cross-tenant and cross-branch access. Use database constraints and consider PostgreSQL RLS as defense in depth; do not treat RLS as a replacement for application authorization.
- Use maintained authentication and cryptographic libraries. Do not hand-roll password hashing, tokens, sessions, or cryptography.
- Keep platform-admin sessions and routes separate from operational sessions. Apply secure cookies, CSRF protection where applicable, rate limits, safe recovery, and MFA support for platform admins.
- Keep secrets out of source, logs, client bundles, and sample defaults. Validate uploads and keep private files behind short-lived access URLs.
- Audit sensitive admin, role, access, and safety-workflow changes.

## PWA and data integrity

- Build Persian RTL first, responsive for field mobile use and desktop management; provide English readiness.
- Ask for camera permission only when the user chooses QR scanning; require HTTPS in production and provide manual equipment-ID fallback.
- Offline submissions are pending until server acknowledgment. Show queued, syncing, failed, conflict, and synced states explicitly.
- Make sync idempotent. Store a unique client event ID, schema version, local event time, server receipt time, and retry state.
- Never put sensitive tenant responses in a shared service-worker cache. Clear local account data on sign-out or membership revocation.
- Store timestamps in UTC and render in the applicable branch/user timezone. Use Jalali only in the presentation/input layer.

## Engineering workflow

- Read before changing. Inspect the app, package manager, migrations, tests, and all applicable AGENTS.md files.
- Keep a modular monolith unless measurable needs justify service separation.
- Put domain operations in server-side application services. UI components do not access the database directly.
- Validate all external inputs on the server. Model workflow transitions explicitly and audit critical ones.
- Make schema changes through migrations. Keep seeds repeatable; development fixtures must be fake and separate from production bootstrap.
- Check current official documentation and package compatibility before selecting versions or changing major dependencies. Record meaningful architecture decisions as ADRs.
- Before completion, run the repository's relevant tests, type checks, lint, migration/bootstrap checks, and production build. Report what ran and any remaining gaps.
- Do not leave a requested feature as a placeholder screen or TODO if it can be implemented in the agreed MVP.
- Update the technical spec and this file when a persistent rule or architecture decision changes.

## MVP implementation profile

- The initial implementation is a Next.js modular monolith with PostgreSQL 15+, Better Auth and separate operational/platform schema and cookie prefixes. Read `README.md` before running migrations, seed, bootstrap, tests or the app.
- `db/migrations/` is the source of truth for deployed schema. Migration changes are append-only after they have been applied; do not edit a migration checksum already recorded in `schema_migrations`.
- The current offline outbox covers inspection submission and associated images. Only the static shell may be cached by the service worker; account-scoped IndexedDB data must be cleared on sign-out and membership revocation.
- Run `npm.cmd test` for unit/database-boundary coverage and `npm.cmd run e2e` for the browser journey. DB tests skip when `DATABASE_URL` is absent; full E2E requires a migrated disposable database and a pre-rotated test SUPERADMIN.
- Local private filesystem storage is a development/single-host provider. Production multi-host deployment needs a durable private provider, backup/retention and upload scanning before rollout.
- MVP limitations are listed in README and the technical spec. Do not present CSV as PDF, text evidence as an uploaded work-order attachment, optional TOTP as enforced MFA, or application checks as PostgreSQL RLS.
- Keep platform recovery operator-mediated until an email/SMS provider and delivery policy are configured. Never expose the temporary credential in audit metadata or logs.

## Change control

When instructions conflict, follow system/developer instructions first, then the current explicit user direction, then repository instructions and existing architecture. For an explicitly authorized product-rule change, do not use this file to block the user: update the specification, implementation, and regression coverage together. If a requested change would weaken tenant isolation or safety boundaries, explain the concrete effect and propose a safer design.
