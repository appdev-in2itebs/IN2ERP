import {
  AccountInfo,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import { EntraClientConfig } from '@/types';

/**
 * Microsoft Entra sign-in for the SPA (authorization code flow with PKCE via MSAL).
 * MSAL keeps its token cache in sessionStorage, scoped to the browser tab session.
 * The API receives Entra access tokens for the In2ERP API scope; ID tokens are never sent.
 */
let msal: PublicClientApplication | null = null;
let scope = '';

export const entraAuth = {
  async init(config: EntraClientConfig): Promise<AccountInfo | null> {
    scope = config.api_scope;
    msal = new PublicClientApplication({
      auth: {
        clientId: config.client_id,
        authority: config.authority,
        redirectUri: `${window.location.origin}/login`,
        postLogoutRedirectUri: `${window.location.origin}/login`,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await msal.initialize();
    const result = await msal.handleRedirectPromise();
    const account = result?.account ?? msal.getAllAccounts()[0] ?? null;
    if (account) msal.setActiveAccount(account);
    return account;
  },

  isReady(): boolean {
    return msal !== null;
  },

  async signIn(): Promise<void> {
    if (!msal) throw new Error('Microsoft sign-in is not configured');
    await msal.loginRedirect({ scopes: [scope], prompt: 'select_account' });
  },

  /** An access token for the In2ERP API, renewed silently by MSAL when possible. */
  async getAccessToken(): Promise<string | null> {
    const account = msal?.getActiveAccount();
    if (!msal || !account) return null;
    try {
      const result = await msal.acquireTokenSilent({ scopes: [scope], account });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await msal.acquireTokenRedirect({ scopes: [scope], account });
      }
      return null;
    }
  },

  async signOut(): Promise<void> {
    const account = msal?.getActiveAccount();
    if (msal && account) {
      await msal.logoutRedirect({ account });
    }
  },
};
