# In2ERP Secure Upgrade — Implementation Checklist

Baseline: `ERP_AUDIT_REPORT.md` (commit `d3e1edd`). Branch: `feat/erp-hardening-app-roles`.
Status key: ✅ done & verified by tests/checks · 🟡 done, cannot be exercised until external setup exists · ⛔ requires approval or external access (not done) · ⏳ follow-up

Details and exact results: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Pre-flight
- ✅ Branch created from clean `main`; no unrelated working-tree changes overwritten.
- ✅ Audit findings re-verified against code before editing.
- ✅ Migration risk identified (no Alembic history) → idempotent baseline revision.
- ✅ Dev DB never modified; migrations tested on copies only.

## Phase 1 — Critical security remediation
- ✅ No default signing keys; production fails closed; `.env` path fixed.
- ✅ Escalation guards (cannot grant beyond own permissions; superadmin targets protected; no self-administration).
- ✅ Self-registration disabled (backend + UI).
- ✅ Shared/default passwords removed from seed, scripts, UI, docs; published defaults cleared by migration.
- ✅ Controlled bootstrap (`app.cli bootstrap-admin`) and break-glass recovery (`app.cli set-password`); no password logging.
- ✅ Tunnels removed; dev server localhost-only; CORS explicit; DEBUG off; docs off in production.
- ✅ Session revocation on logout / password change / reset / deactivation.
- ✅ Lockout, password policy, common-password rejection.
- ✅ Refresh-token rotation + replay detection; HttpOnly SameSite=Strict cookie + CSRF header; in-memory access token.
- ⛔ Rotation of credentials outside the repo (old shared passwords elsewhere, ngrok).

## Phase 2 — Microsoft Entra ID
- ✅ Access-token validation (signature, audience, issuer, tenant, expiry, scope; ID tokens rejected) — tested with a local signing key.
- ✅ Tenant + object ID identity; safe email linking; unknown identities refused and audited.
- ✅ `ERP.Admin` app role required for admin permissions in Entra sessions.
- 🟡 SPA MSAL sign-in (built and type-checked; needs real app registrations to run).
- ✅ Local login modes incl. break-glass only.

## Phase 3 — Central application & role registry
- ✅ Registry fields (launch URL, auth method, integration type/status, connector config, secret reference).
- ✅ App role catalogue (external ID, source, sync status); no app roles in ERP global roles.
- ✅ Multiple roles per application per employee.
- ✅ Grantor, timestamps, expiry, revocation, provisioning status, version.
- ✅ Alembic migrations preserving data (verified on a copy of the dev DB).

## Phase 4/5 — Connectors & reliable provisioning
- ✅ Connector interface; Manual, Entra Graph, SCIM, Custom API — tested against simulated targets.
- 🟡 Real connectors for In2CRM etc. (need each app's endpoint/credentials or contract implementation).
- ✅ Outbox, retries/backoff, idempotency, stale-job version guard, read-back verification.
- ✅ Explicit grant/revoke with dry-run review; silent bulk delete removed.
- ✅ Expiry sweep revokes downstream.
- ⏳ Scheduled full reconciliation scan per application; multi-instance-safe job claiming.

## Phase 6/7 — Workflows, Launchpad, Admin Console
- ✅ Launchpad launchable only when verified; pending/failed explained; real launch URL.
- ✅ Admin Console on backend APIs (registry, catalogues, access review/confirm, status, retry, revoke, Entra link).
- ✅ Placeholder tabs labelled "Planned", mock actions disabled.
- ⏳ Browser walkthrough of all screens (not done in this session).

## Phase 8 — Audit & integrity
- ✅ All admin/security mutations audited with correlation ID; failed logins and denials persisted.
- ✅ Append-only (ORM guard + DB triggers, verified on migrated copy).
- ✅ Org-wide endpoints restricted.

## Phase 9 — Database & Azure readiness
- ✅ Alembic migrations (fresh + dev copy + round-trip + drift check).
- 🟡 PostgreSQL: DDL compiled offline only (no server available).
- 🟡 Docker/nginx/Bicep rewritten; not built or validated (no Docker / Azure CLI here).
- ⛔ Any deployment or Azure validation.

## Phase 10 — Tests
- ✅ Backend 57 passed; frontend type-check and build pass; pip-audit clean.
- ⏳ npm major upgrades (Vite 8, React Router 7); frontend unit tests.
