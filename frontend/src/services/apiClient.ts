const BASE_URL = '/api/v1';

/** Sent on every request; the refresh endpoint requires it as CSRF protection. */
const CSRF_HEADER = { 'X-Requested-With': 'In2ERP' };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = () => Promise<string | null>;

/**
 * HTTP client for the In2ERP API.
 *
 * Tokens are never written to localStorage:
 * - Local sign-in: the access token is held in memory; the refresh token is an HttpOnly
 *   cookie the browser sends only to /api/v1/auth. On a 401 the client rotates it once.
 * - Entra sign-in: a token provider backed by MSAL supplies access tokens.
 */
class ApiClient {
  private accessToken: string | null = null;
  private tokenProvider: TokenProvider | null = null;
  private refreshing: Promise<string | null> | null = null;

  public setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  public setTokenProvider(provider: TokenProvider | null) {
    this.tokenProvider = provider;
  }

  public clear() {
    this.accessToken = null;
    this.tokenProvider = null;
  }

  /** Exchange the refresh cookie for a new access token (single flight). */
  public refreshLocalSession(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: CSRF_HEADER,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const data = await res.json();
          this.accessToken = data.access_token;
          return data.access_token as string;
        })
        .catch(() => null)
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  private async currentToken(): Promise<string | null> {
    if (this.tokenProvider) return this.tokenProvider();
    return this.accessToken;
  }

  public async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const send = async (token: string | null) =>
      fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...CSRF_HEADER,
          ...(options.headers as Record<string, string>),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

    let response = await send(await this.currentToken());

    const isAuthCall = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/refresh');
    if (response.status === 401 && !isAuthCall) {
      const renewed = this.tokenProvider ? await this.tokenProvider() : await this.refreshLocalSession();
      if (renewed) {
        response = await send(renewed);
      }
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    if (!response.ok) {
      let message = response.statusText || 'An unexpected error occurred';
      try {
        const body = await response.json();
        if (typeof body.detail === 'string') message = body.detail;
        else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join('; ');
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
      return null as T;
    }
    return response.json() as Promise<T>;
  }

  public get<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = unknown>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T = unknown>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

/** Message to show for any thrown value. */
export const errorMessage = (err: unknown, fallback = 'Something went wrong'): string =>
  err instanceof Error && err.message ? err.message : fallback;
