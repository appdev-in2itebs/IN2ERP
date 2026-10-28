# In2IT ERP — Central Application Access Portal

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Prod)-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

In2ERP is the control plane for employee access to In2IT's independently hosted applications
(In2CRM, In2Projects, In2HRM, …). An ERP administrator grants and revokes each application's
**own roles** from one place; connectors apply the change in the target application and the ERP
shows only what the target has **confirmed**. Each application remains the enforcement point for
its own permissions.

```
Microsoft Entra ID ─▶ React portal ─▶ FastAPI (authN/authZ, audit) ─▶ PostgreSQL access registry
                                                     │
                                       provisioning outbox + worker
                                                     ▼
                         connectors (Entra app roles · SCIM · In2ERP provisioning API · manual)
                                                     ▼
                         independently hosted applications enforcing their own RBAC
```

Status of each capability, test results and the external setup still required are in
[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

---

## Quick start (local development)

Prerequisites: Python 3.11+, Node.js 20+.

### Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows  (source .venv/bin/activate on Linux/macOS)
pip install -e ".[dev]"

alembic upgrade head              # create or upgrade the schema (safe on existing databases)
python -m app.cli bootstrap-admin --email you@in2itebs.com   # first administrator (prompts for a password)
uvicorn app.main:app --reload --port 8000
```

There are no default accounts or passwords. `bootstrap-admin` only works while no superadmin
exists; later administrators are granted in the Admin Console. (Alternatively set
`SEED_ADMIN_PASSWORD` for the very first start of an empty database.)

API docs (development only): http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173 (localhost only)
```

### Tests
```bash
cd backend && pytest              # backend suite
cd frontend && npm run type-check && npm run build
```

---

## Security model

- **Identity**: Microsoft Entra ID (OIDC, authorization code + PKCE via MSAL) once configured;
  local passwords only for break-glass administrators (`LOCAL_AUTH_MODE`).
- **ERP administration**: ERP roles/permissions in the database. For Entra sessions they also
  require the `ERP.Admin` app role in the token. Administrators cannot grant permissions they
  do not hold, act on superadmin accounts, or change their own access.
- **Application roles**: each application has a role catalogue mirroring its own roles
  (synchronised from the application where a connector exists). They are not ERP roles.
- **Provisioning**: grants and revocations are queued in a transactional outbox, applied by
  connectors, read back and marked `verified`/`revoked` only when the application confirms.
  Manual applications require an app owner to confirm each change.
- **Sessions**: short-lived access tokens kept in memory; refresh tokens in an HttpOnly,
  SameSite=Strict cookie with rotation and replay detection; logout, password change, reset and
  deactivation revoke all sessions.
- **Audit**: every administrative and security event, with actor, target, before/after,
  correlation ID; failed sign-ins persist; the audit table is append-only (ORM guard + DB triggers).

---

## Documentation
- [Implementation status & handover](docs/IMPLEMENTATION_STATUS.md)
- [Architecture](docs/architecture.md)
- [Microsoft Entra ID setup](docs/entra-setup.md)
- [Integrating an application (connectors & provisioning contract)](docs/application-integration.md)
- [Deployment, migrations & Azure](docs/deployment.md)
- [Azure VM deployment with GitHub Actions CI/CD](docs/deployment-azure-vm.md)
- [Original audit](ERP_AUDIT_REPORT.md)
