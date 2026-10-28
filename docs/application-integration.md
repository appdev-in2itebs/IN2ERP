# Integrating an application

Every application registered in In2ERP keeps enforcing its own roles. In2ERP records which
employee should hold which of the application's roles and, through a connector, applies and
verifies that in the application. Hiding a launchpad tile is never treated as access control.

## 1. Decide who owns the roles

| If the application… | Integration | System of record for role membership |
|---|---|---|
| authorises from the `roles` claim of Entra tokens | **Microsoft Entra app roles** | Entra (app-role assignments) |
| exposes SCIM 2.0 and models roles as groups | **SCIM 2.0** | the application |
| keeps roles in its own database | **In2ERP provisioning API** (implement the contract below) | the application |
| cannot be integrated yet | **Manual** | the application; an app owner confirms each change in In2ERP |

Entra app roles and an application's internal RBAC are not interchangeable: pick one owner per
application and document it.

## 2. Register the application (Admin Console → Applications & Registry, or `POST /api/v1/applications`)
- Name, slug, **launch URL** (the application's own URL; it signs users in with its own SSO).
- Integration type and non-secret connector settings:
  - Entra: `{"service_principal_id": "<enterprise app object id>"}`
  - SCIM / provisioning API: `{"base_url": "https://…"}` (https required)
- **Credential secret name** (e.g. `CRM_PROVISIONING_TOKEN`): the name of a server environment
  variable / Key Vault reference. Secret values are never stored in the database.
- **Test connection**, then **Sync roles from app** to build the role catalogue with each role's
  external ID. For manual applications enter the roles by hand.

## 3. Grant and revoke
Administrators pick an employee, choose one or more of the application's roles, **review** the
change (a server-side dry run that validates everything and shows what will happen), and confirm.

| Status | Meaning |
|---|---|
| `pending` / `revocation_pending` | queued for the connector |
| `verified` / `revoked` | the application confirmed the result (read back after the change) |
| `failed` | permanent error, or retries exhausted — see the error, fix, **Retry** |
| `reconciliation_required` | the call succeeded but the read-back disagreed |
| `manual_action_required` | manual app: an owner applies it, then **Confirm** in In2ERP |

Employees see an application on their launchpad as **launchable only once a role is verified**.
Revocation removes the tile immediately and then removes the role in the application.
Expired assignments are revoked automatically by the worker.

Guarantees: one job per assignment runs at a time; jobs carry the assignment version so a stale
grant never restores revoked access; transient errors (timeouts, 429, 5xx) retry with backoff;
connector calls are idempotent and carry an `Idempotency-Key`.

## 4. In2ERP provisioning API contract (for applications with their own RBAC)
All endpoints are JSON over HTTPS with `Authorization: Bearer <token>`; the token is issued by
the application to In2ERP and stored as an In2ERP secret.

| Method & path | Response |
|---|---|
| `GET {base}/health` | `200` |
| `GET {base}/roles` | `{"roles": [{"id": "…", "name": "…", "description": "…"}]}` |
| `GET {base}/users/{email}/roles` | `{"roles": ["<role id>", …]}` (`404` = user has no roles) |
| `PUT {base}/users/{email}/roles/{role_id}` | `200/201/204`, idempotent grant |
| `DELETE {base}/users/{email}/roles/{role_id}` | `200/204/404`, idempotent revoke |

Requests include `Idempotency-Key` and, when known, `X-Entra-Object-Id`. `{email}` is
URL-encoded. The application must authorise every request itself; In2ERP never bypasses it.

## 5. The application must still enforce access
Knowing an application's URL must not grant access. Each application must authenticate users
(Entra SSO recommended) and authorise every request from its own role data.
