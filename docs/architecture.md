# In2IT ERP — Architecture

## Purpose
In2ERP is the control plane for employee access to independently hosted applications. It does
not replace each application's authorisation; it decides who should hold which application role,
pushes that decision to the application, and shows what the application has confirmed.

## Components
```
┌────────────────────────── Microsoft Entra ID ──────────────────────────┐
│ employees, groups, MFA/Conditional Access, app roles (ERP.Admin, apps) │
└───────▲──────────────────────────────▲─────────────────────────────▲───┘
        │ OIDC + PKCE (MSAL)           │ Graph (app-role connector)  │ app SSO
┌───────┴────────┐   same origin  ┌────┴──────────────────────┐   ┌──┴──────────────────┐
│ React SPA      │ ─────/api────▶ │ FastAPI                   │──▶│ Applications         │
│ launchpad,     │   (nginx)      │ • token validation        │   │ (CRM, HRM, …) own &  │
│ admin console  │                │ • ERP RBAC + guards       │   │ enforce their roles  │
└────────────────┘                │ • access registry         │   └──────────────────────┘
                                  │ • outbox + worker         │ connectors: Entra app roles,
                                  │ • append-only audit       │ SCIM 2.0, In2ERP provisioning API,
                                  └────────────┬──────────────┘ manual
                                               ▼
                                     PostgreSQL (SQLite in dev)
```

## Backend layout (`backend/app`)
| Path | Responsibility |
|---|---|
| `api/v1/dependencies.py` | Principal resolution (local or Entra token), admin policy, `require_permission` |
| `api/v1/auth.py` | Config, password sign-in, refresh rotation (cookie), password change, logout, `/me` |
| `api/v1/users.py` | Employees, one-time passwords, deactivation (revokes access), Entra link |
| `api/v1/roles.py` | ERP roles/permissions with escalation guards |
| `api/v1/applications.py` | Registry, connector settings, test connection, role sync, catalogue, launchpad |
| `api/v1/assignments.py` | Explicit grant/revoke change sets (dry run), retry, manual confirm, job queue |
| `core/entra.py` | Entra access-token validation |
| `core/request_context.py` | IP, user agent, correlation ID per request |
| `integrations/` | Connector interface and implementations; secret resolution by name |
| `services/assignment_service.py` | Access planning and changes (`AccessService`) |
| `services/provisioning_service.py` | Outbox, worker, retries, version guard, expiry sweep |
| `services/identity_service.py` | Entra identity → employee mapping |
| `services/audit_service.py` | Audit recording (same transaction, or committed before an error) |

## Data model (key tables)
- `users` — employee; `entra_id` + `entra_tenant_id`; `token_version` (session revocation);
  lockout and password-change fields.
- `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permission_overrides` — ERP
  administration only.
- `applications` — registry, launch URL, auth method, integration type/status, connector config,
  secret reference.
- `app_roles` — each application's role catalogue (external ID, source, sync status).
- `app_assignments` — one row per employee × application × role: intent (`status`),
  observed state (`provisioning_status`), `version`, expiry, revocation, last error.
- `provisioning_jobs` — outbox (operation, assignment version, attempts, backoff, idempotency key).
- `refresh_tokens` — rotation and replay detection by token family.
- `audit_logs` — append-only, with correlation ID.

## Key flows
**Sign-in (Entra)** MSAL obtains an access token for `api://<api>/access_as_user` → API validates
it → maps `tid`+`oid` to the employee → admin permissions only if the token carries `ERP.Admin`.

**Grant** Admin submits a change set → server validates (application, catalogue role, expiry,
capacity, guards) → dry run returns the plan → confirm writes assignment (version+1) and a job in
one transaction → worker calls the connector, reads back, marks `verified` (or `failed` /
`reconciliation_required`) → launchpad shows the application as launchable.

**Revoke / deactivate / expire** Assignment becomes `revoked`/`expired` immediately (launchpad and
ERP stop showing it) → revoke job → connector removes and verifies → `revoked`.

## Authorisation rules
- Every endpoint checks permissions on the server; the UI only hides what the server would refuse.
- Non-superadmins cannot grant permissions they do not hold, act on superadmins, or administer
  themselves. Only ERP administrators (`assignments.*`) change application access.
- Dashboard statistics, employee lists and audit logs require admin permissions.
