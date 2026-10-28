# Deploying to an Azure VM (CI/CD with GitHub Actions)

```
push to main ─► CI (tests, type-check, build, audits, image builds)
             ─► build & push images to GitHub Container Registry (ghcr.io)
             ─► [approval, if configured] ─► SSH to the VM ─► DB backup ─► migrate ─► roll out ─► health check
```

On the VM everything runs in Docker:
`Caddy (80/443, automatic HTTPS) → frontend (nginx: SPA + /api proxy) → backend (FastAPI) → PostgreSQL`.
Only ports 80/443 are exposed; the database and API are reachable only inside Docker.

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Quality gate for pull requests and branches; reused before every deployment |
| `.github/workflows/deploy-azure-vm.yml` | Build images and deploy on push to `main`; manual run can roll back |
| `infrastructure/vm/setup-vm.sh` | One-time VM preparation (Docker, `/opt/in2erp`, generated secrets) |
| `infrastructure/vm/docker-compose.prod.yml` | Production stack on the VM |
| `infrastructure/vm/deploy.sh` | Runs on the VM for each deployment |
| `infrastructure/vm/Caddyfile` | HTTPS reverse proxy |

## 1. Create the VM (once)
Azure portal → **Virtual machines → Create**:
- Image **Ubuntu Server 24.04 LTS**, size **Standard B2s** (2 vCPU, 4 GB) or larger.
- Authentication: **SSH public key**, admin user e.g. `azureuser`.
- Inbound ports: **SSH (22)**, **HTTP (80)**, **HTTPS (443)**. Restrict SSH to your office IP if possible
  (GitHub-hosted runners connect from changing addresses; see *Hardening* below).
- After creation: VM → **Overview → DNS name → Configure**, set a label, e.g. `in2erp`. This gives a free
  name such as `in2erp.centralindia.cloudapp.azure.com`, which Caddy uses for a free HTTPS certificate.
  (Or point your own domain's A record at the VM's public IP.)

## 2. Prepare the VM (once)
```bash
ssh azureuser@<vm-dns-name>
git clone https://github.com/appdev-in2itebs/IN2ERP.git /tmp/in2erp
sudo bash /tmp/in2erp/infrastructure/vm/setup-vm.sh deploy https://<vm-dns-name>
```
This installs Docker, creates the `deploy` user and `/opt/in2erp`, and writes `/opt/in2erp/.env` with
random database and signing secrets. The secrets never leave the VM and are never printed.
Optional settings (Entra ID, `LOCAL_AUTH_MODE`) are commented in that file.

Create an SSH key used only by GitHub Actions and allow it for the `deploy` user:
```bash
ssh-keygen -t ed25519 -N "" -C github-deploy -f ~/github_deploy
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
cat ~/github_deploy.pub | sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
cat ~/github_deploy        # copy into the VM_SSH_PRIVATE_KEY secret, then:
rm ~/github_deploy ~/github_deploy.pub
```
On your own machine, capture the VM's host key for `VM_SSH_KNOWN_HOSTS`:
```bash
ssh-keyscan -t ed25519 <vm-dns-name>
```

## 3. Configure GitHub (once)
Repository → **Settings**:
- **Environments → New environment `production`**. Add yourself under **Required reviewers** so every
  deployment waits for an explicit approval (recommended).
- **Secrets and variables → Actions → Secrets** (repository or `production` environment):

  | Secret | Value |
  |---|---|
  | `VM_HOST` | VM DNS name or public IP |
  | `VM_USER` | `deploy` |
  | `VM_SSH_PRIVATE_KEY` | the private key from step 2 |
  | `VM_SSH_KNOWN_HOSTS` | output of `ssh-keyscan` from step 2 |

- **Variables**: `APP_URL` = `https://<vm-dns-name>` (shown as the deployment link).

Images go to `ghcr.io/appdev-in2itebs/in2erp-backend` / `-frontend` using the workflow's own token;
no registry secret is needed. The VM receives a short-lived token per deployment over SSH stdin.

## 4. Deploy
Merge or push to `main`, then approve the **production** deployment in the Actions tab.
The first deployment creates the database. Create the first administrator on the VM:
```bash
ssh azureuser@<vm-dns-name>
cd /opt/in2erp
sudo -u deploy IMAGE_PREFIX=ghcr.io/appdev-in2itebs/in2erp IMAGE_TAG=$(cat .deployed-tag) \
  docker compose -f docker-compose.prod.yml --env-file .env run --rm backend \
  python -m app.cli bootstrap-admin --email admin@in2it.com
```
It prompts for the password (not echoed or logged). Further users are created in the Admin Console.

To bring existing data from a SQLite database, see *Moving data from SQLite to PostgreSQL* in
[deployment.md](deployment.md).

## Rollback
Actions → **Deploy to Azure VM → Run workflow**, enter an earlier commit SHA in `image_tag`.
Images are not rebuilt. Migrations are not reversed automatically. If a migration has to be undone,
restore the backup that `deploy.sh` takes before every migration (`/opt/in2erp/backups`, 14 kept):
```bash
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  pg_restore -U erpuser -d in2it_erp --clean --if-exists < backups/<file>.dump
```

## Operations
```bash
cd /opt/in2erp
C="docker compose -f docker-compose.prod.yml --env-file .env"
IMAGE_PREFIX=ghcr.io/appdev-in2itebs/in2erp IMAGE_TAG=$(cat .deployed-tag) $C ps
IMAGE_PREFIX=ghcr.io/appdev-in2itebs/in2erp IMAGE_TAG=$(cat .deployed-tag) $C logs -f backend
```
Containers restart automatically after a VM reboot (`restart: unless-stopped`).

## Hardening (recommended)
- Restrict SSH in the VM's network security group. GitHub-hosted runner IPs change, so either allow
  SSH from anywhere with key-only login (the default here), or use a self-hosted runner on the VM.
- Enable Azure Backup for the VM disk and copy `/opt/in2erp/backups` off the VM.
- Once Entra ID is configured, set `LOCAL_AUTH_MODE=break_glass_only` in `/opt/in2erp/.env`.
