# Deployment, migrations and Azure

## Database migrations (all environments)
The schema is managed only by Alembic. The application never creates or alters tables itself.

```bash
cd backend
alembic upgrade head        # fresh database, or a database created before Alembic was adopted
alembic current             # show the applied revision
```

- `0001_baseline` creates the original tables only when they are missing, so it is safe on
  databases created by the old `create_all` startup.
- `0002_access_platform` adds the access-control platform and **preserves existing data**
  (employees, roles, applications, assignments, audit history), with these deliberate changes:
  - every existing assignment is linked to a role catalogue entry and marked
    `manual_action_required` (it was never confirmed in the target application);
  - **passwords equal to a previously published default are cleared** — those accounts cannot
    sign in until recovered (see below); other passwords must be changed at next sign-in;
  - the Manager role loses `assignments.create`.
- **Back up the database first** (copy the SQLite file, or take a PostgreSQL backup).
- Downgrading `0002` drops the new tables and keeps only one role per user and application;
  cleared passwords are not restored.

## Upgrading the existing development database
Tested on a copy of the current development database: all 26 assignments and 52 audit entries
were preserved, and **all 9 accounts had a published default password, so all 9 are cleared**.

```bash
cd backend
cp in2it_erp.db in2it_erp.db.bak                               # 1. backup
alembic upgrade head                                           # 2. migrate
python -m app.cli set-password --email <your superadmin email> # 3. recover one administrator
uvicorn app.main:app --reload --port 8000
```
4. Sign in as that administrator. For every other employee use **Reset password** in the Admin
   Console: it shows a one-time password once, which they must change at first sign-in (or, once
   Entra is configured, they simply sign in with Microsoft).
5. Existing grants show **Awaiting app owner**. Once each application owner confirms the access
   is correct in their application, confirm it per assignment or per application
   (Applications & Registry → manage roles → *Confirm all pending manual changes*).

## Local containers
```bash
cd infrastructure
export JWT_SECRET_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
export SECRET_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(48))")
docker compose up --build              # migrate → backend → frontend on http://localhost:8080
```
The frontend container serves the SPA and proxies `/api` to the backend (same origin, required
for the SameSite=Strict refresh cookie). Ports are bound to localhost only.

## Moving data from SQLite to PostgreSQL
1. `alembic upgrade head` against the **target** (`DATABASE_URL=postgresql+asyncpg://…`).
2. `alembic upgrade head` against the **source** SQLite database.
3. `pip install psycopg2-binary`, then
   `TARGET_DATABASE_URL=postgresql://… python infrastructure/azure/migrate-to-postgres.py --sqlite ./backend/in2it_erp.db`.
   The script refuses to write into non-empty tables and never prints credentials.

## Azure (template provided, not yet validated)
`infrastructure/azure/azure-deploy.bicep` describes the target environment:
- App Service (Linux containers) for backend and frontend, HTTPS only, TLS 1.2, FTP disabled,
  VNet integration; images pulled from Azure Container Registry with managed identity.
- PostgreSQL Flexible Server with **private access only** (delegated subnet + private DNS),
  14-day backups (point-in-time restore).
- Key Vault (RBAC) holding the JWT/app secrets and database URL, read by the backend's managed
  identity through Key Vault references.
- Application Insights + Log Analytics.

```bash
# Build and push images first, then preview:
./infrastructure/azure/deploy.sh <resource-group> <region>            # what-if only
./infrastructure/azure/deploy.sh <resource-group> <region> --apply    # deploy
```
After deployment, run `alembic upgrade head` from inside the VNet (e.g. App Service SSH on the
backend). `SEED_ON_STARTUP` is off in production: create the first administrator with
`python -m app.cli bootstrap-admin --email <email>` in the same SSH session. It prompts for the
password (never echoed or logged), refuses if a superadmin already exists, and is audited.
Add that account to `BREAK_GLASS_EMAILS`; everyone else signs in with Microsoft.

Not yet covered and required before production:
- Validate the template (`az bicep build`, `what-if`) in an authorised subscription.
- Restrict the backend app to the frontend (access restrictions or private endpoint); today it is
  reachable publicly over HTTPS, protected by authentication.
- Restore drills for PostgreSQL backups; alerting on provisioning failures and `refresh_token_replay`.
- Database role for the app without `UPDATE`/`DELETE` on `audit_logs` (triggers already block it).
- Run the provisioning worker as a single instance, or move it to a separate worker app when
  scaling out (job claiming is not yet multi-instance safe on PostgreSQL).
