# Microsoft Entra ID setup

In2ERP uses two app registrations in your tenant, plus an optional third for provisioning.
All values below are placeholders; nothing in this repository contains real tenant data.

| Registration | Purpose | Secret? |
|---|---|---|
| **In2ERP API** | The resource the SPA requests tokens for; defines the `access_as_user` scope and the `ERP.Admin` app role | No |
| **In2ERP Portal (SPA)** | Signs employees in with MSAL (authorization code + PKCE) | No (public client) |
| **In2ERP Provisioning** *(optional)* | Used by the Entra app-role connector to assign/remove app roles via Microsoft Graph | Yes |

## 1. API registration
1. Entra admin center → **App registrations** → **New registration** → name `In2ERP API`,
   single tenant.
2. **Expose an API** → set the Application ID URI to `api://<api-client-id>` → add scope
   `access_as_user` (admins and users can consent).
3. **App roles** → create role `ERP.Admin`, allowed member types **Users/Groups**. This is the
   only way an Entra session can exercise ERP administration permissions.
4. **Manifest** → set `"accessTokenAcceptedVersion": 2`.
5. Enterprise applications → *In2ERP API* → **Properties** → *Assignment required* = **Yes**,
   then **Users and groups** → assign the `ERP.Admin` role to the designated ERP administrator(s)
   (a group is recommended).

## 2. SPA registration
1. **New registration** → `In2ERP Portal`, single tenant.
2. **Authentication** → add platform **Single-page application** with redirect URIs
   `http://localhost:5173/login` (development) and `https://<frontend-host>/login`.
   Do **not** enable implicit grant.
3. **API permissions** → *My APIs* → In2ERP API → `access_as_user` → **Grant admin consent**.
4. Enterprise applications → *In2ERP Portal* → *Assignment required* = **Yes** and assign the
   employee group(s) allowed to use the portal.

## 3. Backend configuration
```env
ENTRA_TENANT_ID=<tenant GUID>
ENTRA_SPA_CLIENT_ID=<SPA client ID>
ENTRA_API_CLIENT_ID=<API client ID>
# ENTRA_API_AUDIENCE=api://<API client ID>     (default)
# ENTRA_API_SCOPE=access_as_user               (default)
# ENTRA_ADMIN_APP_ROLE=ERP.Admin               (default)
LOCAL_AUTH_MODE=break_glass_only
BREAK_GLASS_EMAILS=["<break-glass admin email>"]
```
When these are set, the login page shows **Sign in with Microsoft** and the API accepts Entra
access tokens. What the API checks: RS256 signature against the tenant's keys, audience
(the API, never the SPA client — ID tokens are rejected), issuer and `tid` in the allowed
tenants, expiry, and the `access_as_user` scope. Employees are identified by tenant ID + object ID.

## 4. Linking employees
- An existing employee record is linked automatically at first Microsoft sign-in when the email
  matches and the record is not linked yet (`ENTRA_LINK_BY_EMAIL`). A record already linked to a
  different object ID is never relinked.
- Administrators can link explicitly in the Admin Console (object ID + tenant ID).
- Unknown identities are refused and audited. `ENTRA_AUTO_PROVISION=true` would create them with
  only the Employee role; it is off by default.
- Signing in never grants administration rights.

## 5. Optional: provisioning registration (Entra app-role connector)
Only for applications whose roles are enforced from Entra app roles.
1. **New registration** → `In2ERP Provisioning` → **Certificates & secrets** → new client secret.
2. **API permissions** → Microsoft Graph → *Application* → `AppRoleAssignment.ReadWrite.All`
   → **Grant admin consent**. This is a high-privilege permission: restrict who can manage this
   registration and rotate the secret regularly.
3. Backend: `GRAPH_CLIENT_ID=<client ID>` and the secret in `GRAPH_CLIENT_SECRET`
   (Key Vault reference in Azure). In the Admin Console set the application's integration to
   *Microsoft Entra app roles* with its enterprise application (service principal) object ID.

## 6. MFA and Conditional Access
Configure in Entra (not in In2ERP): require MFA for the In2ERP Portal and In2ERP API enterprise
applications, and stricter policies (compliant device, sign-in risk) for the `ERP.Admin` group.

## 7. Break-glass account
Keep one local administrator listed in `BREAK_GLASS_EMAILS` with a long random password stored
offline (e.g. sealed envelope / password vault with dual control). Review its audit entries
(`login`, `login_failed`) regularly and rotate its password after every use.
