# In2ERP Secure Upgrade — Implementation Status & Handover

**Date:** 2026-10-27 · **Branch:** `feat/erp-hardening-app-roles` (from `main` @ `d3e1edd`, uncommitted)
**Baseline:** [ERP_AUDIT_REPORT.md](../ERP_AUDIT_REPORT.md) · **Checklist:** [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)

Nothing was deployed, no Entra tenant or external application was touched, no credential outside
the repository was rotated, and the development database `backend/in2it_erp.db` was **not
modified**. Migrations were tested only on copies.

---

## 1. Verification results (exact)

| Check | Command | Result |
|---|---|---|
| Backend tests | `cd backend && pytest` | **57 passed** (pytest 9.1.1, Python 3.14 venv) |
| Test breakdown | | security 11 · access 8 · auth 8 · Entra 15 · provisioning 10 · bootstrap 3 · ERP RBAC 2 |
| Lint (correctness) | `ruff check --select F,B --ignore B008,F821` | clean (B008 = FastAPI `Depends` idiom, F821 = SQLAlchemy string refs) |
| Python dependency audit | `pip-audit -r requirements.lock` | no known vulnerabilities |
| Frontend types | `npm run type-check` | 0 errors |
| Frontend build | `npm run build` | succeeds; bundle 597 kB (warning >500 kB; MSAL is the main addition) |
| Migrations, fresh DB | `alembic upgrade head` + `alembic check` | applied; no drift |
| Migrations, **copy of current dev DB** | same | applied; 26/26 assignments + 52/52 audit rows preserved; no drift |
| Downgrade/upgrade round-trip | `alembic downgrade 0001_baseline && alembic upgrade head` | succeeds |
| Audit append-only (DB) | UPDATE/DELETE on migrated copy | both blocked by triggers |
| PostgreSQL | `alembic upgrade head --sql` (offline) | DDL generated (13 tables, constraints, trigger). **Not run on a PostgreSQL server** — none available |
| Live server smoke test | uvicorn on scratch DB | startup seeding, worker start, login, CSRF-guarded refresh, disabled registration, request IDs: OK |
| npm audit | `npm audit` | 4 remaining (1 high, 3 moderate) — need major upgrades, see §6 |
| Docker / Bicep | — | **Not built or validated**: Docker and Azure CLI not installed here |
| Browser UI | — | **Not exercised in a browser**; type-checked and built only |

## 2. What changed, by phase

### Phase 1 — Critical security remediation
| Area | Change | Files |
|---|---|---|
| Signing keys | No defaults; production refuses missing/short secrets; dev uses an ephemeral random key; `.env` resolved from file location (was silently ignored) | `core/config.py`, `core/security.py` (PyJWT) |
| Escalation | Cannot grant permissions you don't hold; superadmins manageable only by superadmins; no self-administration | `services/authorization_service.py`, `api/v1/roles.py`, `users.py`, `assignments.py` |
| Registration & credentials | Self-registration off (backend + UI removed); no default/shared passwords anywhere; credential pills removed; one-time passwords shown once to the admin; forced change; first admin via `python -m app.cli bootstrap-admin` (no password logging) | `auth_service.py`, `users.py`, `seed.py`, `cli.py`, `LoginView.tsx`, `MasterSettingsView.tsx` |
| Shared defaults in existing data | Migration clears passwords equal to published defaults; recovery via `app.cli set-password` / Admin Console | `alembic/versions/…0002…` |
| Exposure | Tunnel scripts removed; Vite bound to 127.0.0.1; CORS explicit; DEBUG/SQL echo off; API docs off in production | `vite.config.ts`, `config.py`, `main.py` |
| Sessions | Token version revocation (logout, password change/reset, deactivation); refresh rotation with replay detection in DB; refresh token only in HttpOnly SameSite=Strict cookie + CSRF header; access token in memory | `auth_service.py`, `api/v1/auth.py`, `models/session.py`, `apiClient.ts`, `AuthContext.tsx` |
| Brute force | Lockout after 5 failures (15 min), password policy incl. common-password list | `auth_service.py`, `security.py` |

### Phase 2 — Microsoft Entra ID
- Backend validates Entra v2 access tokens: JWKS signature, audience (API only — ID tokens rejected),
  issuer, tenant allow-list, expiry, delegated scope. Identity = tenant ID + object ID.
- Linking: by email only for unlinked employees; conflicts refused; unknown identities refused
  and audited; optional auto-provisioning off by default.
- Admin policy: Entra sessions get admin permissions only with the `ERP.Admin` app role **and**
  ERP permissions; otherwise baseline employee permissions only.
- SPA: MSAL (`@azure/msal-browser` 5.25.0, auth code + PKCE, sessionStorage cache); "Sign in with
  Microsoft" appears when `/auth/config` reports Entra configured.
- Local login modes `all` / `break_glass_only` / `disabled`.
- Files: `core/entra.py`, `services/identity_service.py`, `api/v1/dependencies.py`, `services/entraAuth.ts`, `docs/entra-setup.md`.

### Phase 3 — Central application & role registry
- Applications: launch URL (validated; no `javascript:`, `//`, `\`), auth method, integration
  type/status, non-secret connector config, secret **reference** only.
- `app_roles` catalogue (external ID, source, sync status); CRM roles no longer created as ERP roles.
- Assignments: one row per employee × application × role (multiple roles per app), status,
  provisioning status, version, expiry, revocation, last error/verification.
- Files: `models/application.py`, `schemas/application.py`, `api/v1/applications.py`, migrations.

### Phase 4/5 — Connectors & reliable provisioning
- Connector interface + Manual, Entra Graph (app-role assignments), SCIM 2.0 (groups), and the
  documented In2ERP provisioning API connector. Secrets resolved from environment/Key Vault references.
- Transactional outbox, worker (in-process, started with the app), exponential backoff, idempotency
  keys, one job per assignment at a time, version guard (stale grant cannot restore revoked
  access), read-back verification, `reconciliation_required` on mismatch, expiry sweep.
- Bulk "sync" that silently deleted access was removed; replaced by explicit grant/revoke change
  sets with a server-side dry run for review.
- Files: `integrations/*`, `services/provisioning_service.py`, `services/assignment_service.py`, `api/v1/assignments.py`, `models/provisioning.py`.

### Phase 6/7 — Workflows, Launchpad, Admin Console
- Launchpad: launchable only when a role is verified; pending/failed explained; opens the
  registered URL in a new tab; fake CRM metrics removed.
- Admin Console: backend registry, catalogue management, test connection, role sync, access
  editor with review → confirm, per-role status, retry, revoke, manual confirmation, deactivation
  (starts revocation), Entra link, one-time password modal; real ERP roles/permissions/audit.
- AI assistant, data scopes, email templates, notifications, permission sets, approval permissions:
  labelled **"Planned — not saved or enforced"**, mock actions disabled.
- Files: `EtherealLaunchpad.tsx`, `MasterSettingsView.tsx`, `ApplicationsView.tsx`, `AssignmentsView.tsx`, `ChangePasswordView.tsx`.

### Phase 8 — Audit & integrity
- All admin and security mutations audited (actor, target, outcome, before/after, IP, user agent,
  correlation ID echoed as `X-Request-ID`); failed logins and permission denials persist.
- Append-only: ORM guard + DB triggers (SQLite and PostgreSQL).
- Org-wide endpoints (dashboard stats, departments, application list) require permissions.

### Phase 9 — Database & Azure readiness
- Alembic baseline (safe on pre-Alembic databases) + platform migration; `create_all`/ad-hoc ALTER removed.
- Dockerfiles (non-root, healthcheck, lockfile), nginx template (same-origin `/api`, CSP and
  security headers), compose with required secrets and a migrate step, Bicep (private PostgreSQL,
  Key Vault references, managed identity, HTTPS/TLS 1.2, App Insights), deploy scripts (what-if
  by default, no secret echo), safe SQLite→PostgreSQL copier.

## 3. Security and architecture decisions
- **Kept React** (spec: do not migrate). Kept FastAPI/SQLAlchemy layering and the visual design.
- **ERP is the control plane, apps enforce.** A DB row is intent; only connector read-back (or an
  audited app-owner confirmation for manual apps) marks access `verified`.
- **Token strategy:** Entra access tokens via MSAL for employees; local sessions (break-glass) use
  memory access tokens + HttpOnly refresh cookie with rotation/replay detection. Same-origin
  serving (nginx proxy) is required for the SameSite=Strict cookie.
- **Existing grants are not assumed correct:** migrated to `manual_action_required` until owners confirm.
- **Manager role** can no longer grant access (only ERP administrators).

## 4. Actions required outside the repository (not done; need your decision/approval)
1. **Run the migration on the dev DB** (backup first) and recover an administrator:
   see [deployment.md → Upgrading the existing development database](deployment.md). All 9
   current accounts will need new passwords (they use published defaults).
2. **Rotate credentials that may have been exposed**: the old shared passwords anywhere they were
   reused outside this database; the ngrok account token / reserved domain if the tunnel was used.
   Your local `.env` keys were never actually loaded before (path bug) and are used from now on;
   if that file was ever shared, replace them with `python -c "import secrets;print(secrets.token_urlsafe(48))"`.
   Remove `"*"` from `CORS_ORIGINS` in `.env` (it is ignored now).
3. **Entra**: create the API and SPA registrations, the `ERP.Admin` app role and assignments,
   MFA/Conditional Access ([entra-setup.md](entra-setup.md)). Provide tenant ID and client IDs.
4. **Per application** (In2CRM, In2Projects, In2HRM, In2Leave, In2Finance, Payroll, Inventory,
   Reports): decide the role owner and integration type, provide base URL/credentials or implement
   the provisioning contract, then test connection and sync roles. Until then they are `manual`.
   The seeded catalogues are starting points and must be confirmed against each application.
5. **Application owners confirm** existing access (26 migrated assignments) in the Admin Console.
6. **Azure**: validate Bicep (`what-if`) in an authorised subscription; build/push images; restrict
   the backend app to the frontend; set up alerting; run PostgreSQL restore drills.

## 5. Destructive or externally visible operations that need explicit approval
- Running `alembic upgrade head` on `backend/in2it_erp.db` (clears 9 default passwords; reversible
  only from the backup).
- Any Azure deployment, Entra registration/consent (especially Graph `AppRoleAssignment.ReadWrite.All`),
  connector credentials, or calls to real applications.
- Committing/pushing this branch (not done).

## 6. Known limitations and follow-ups
- npm: remaining advisories require **Vite 5→8** (dev-server only; mitigated by localhost binding)
  and **React Router 6→7** (open redirect via backslash paths; mitigated by server and client URL
  validation). Plan these major upgrades separately.
- Provisioning worker runs in the API process; job claiming is not multi-instance safe on
  PostgreSQL yet (`SELECT … FOR UPDATE SKIP LOCKED` / separate worker app) — run one instance.
- Reconciliation is per-assignment (verify jobs, read-back); a scheduled full drift scan per
  application is not implemented.
- SCIM connector manages group membership only (users must already exist in the target).
- No frontend unit tests; UI not exercised in a browser in this session.
- Frontend bundle > 500 kB; consider code-splitting the Admin Console.
- `MY_SKILL/` (git-ignored) was not reviewed.
