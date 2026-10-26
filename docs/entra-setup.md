# Microsoft Entra ID (Azure AD) SSO Integration Guide

This guide details how to transition In2IT ERP from standard email/password authentication to enterprise Single Sign-On (SSO) with **Microsoft Entra ID (formerly Azure Active Directory)**.

---

## 1. Azure Portal App Registration

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** > **App registrations** > **New registration**.
3. Fill in the application details:
   - **Name**: `In2IT-ERP`
   - **Supported account types**: *Accounts in this organizational directory only (Single tenant)*
   - **Redirect URI (SPA)**:
     - Local: `http://localhost:5173`
     - Production: `https://<your-azure-app>.azurewebsites.net`
4. Click **Register**.

---

## 2. Record Credentials

Note down the following values from the **Overview** blade:
- **Application (client) ID**: (e.g. `11111111-2222-3333-4444-555555555555`)
- **Directory (tenant) ID**: (e.g. `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`)

Under **Certificates & secrets**:
1. Click **New client secret**.
2. Set a description (e.g. `In2IT-ERP-Backend-Secret`) and expiration.
3. Copy the **Value** immediately (this will only be shown once).

---

## 3. Configure API Permissions

In the App Registration:
1. Navigate to **API permissions** > **Add a permission** > **Microsoft Graph**.
2. Select **Delegated permissions**:
   - `User.Read` (Sign in and read user profile)
   - `email` (View users' email address)
   - `profile` (View users' basic profile)
3. Click **Grant admin consent for <Your Organization>**.

---

## 4. Backend Configuration (`.env`)

Update your environment variables in `.env`:

```env
ENTRA_TENANT_ID=your-tenant-id-here
ENTRA_CLIENT_ID=your-client-id-here
ENTRA_CLIENT_SECRET=your-client-secret-here
ENTRA_AUTHORITY=https://login.microsoftonline.com/your-tenant-id-here
```

### Backend JWKS Token Verification Flow

The `User` model already includes the `entra_id` column:
```python
entra_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
```

When Entra ID is enabled:
1. The frontend authenticates via MSAL (`@azure/msal-react`).
2. The frontend sends the Entra `id_token` or `access_token` to `/api/v1/auth/entra-callback`.
3. The backend fetches the public keys from `https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys` to verify token authenticity.
4. If the user doesn't exist locally, they are automatically provisioned with the default **Employee** role.

---

## 5. Frontend MSAL Configuration

When ready to enable in the frontend:
1. Install MSAL packages:
   ```bash
   npm install @azure/msal-browser @azure/msal-react
   ```
2. Initialize `PublicClientApplication` with your client and tenant IDs.
3. Add a "Sign in with Microsoft 365" button on `LoginView.tsx`.
