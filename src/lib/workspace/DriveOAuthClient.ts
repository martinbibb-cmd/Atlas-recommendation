/**
 * DriveOAuthClient.ts
 *
 * Shared PKCE-based OAuth 2.0 helper used by the Google Drive and OneDrive
 * workspace adapters.
 *
 * The implementation follows the Authorization Code + PKCE flow
 * (RFC 7636) so no client secret is embedded in the application bundle.
 *
 * Responsibilities
 * ────────────────
 * 1. Generate a code-verifier / code-challenge pair.
 * 2. Redirect the browser to the provider's authorisation endpoint.
 * 3. On the redirect-back URL, exchange the authorisation code for an
 *    access token (and optional refresh token).
 * 4. Persist the token set in sessionStorage so the tab stays logged in
 *    across soft navigations.
 * 5. Silently refresh the access token when it is close to expiry.
 *
 * Security notes
 * ──────────────
 * - The code-verifier is generated using the Web Crypto API (CSPRNG).
 * - State is stored in sessionStorage (not localStorage) so it is never
 *   accessible to other tabs or persisted between browser sessions.
 * - The provider redirect URI must be an exact match for the URI
 *   registered with the OAuth app; callers pass it in at construction time.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OAuthConfig {
  /** OAuth client ID registered with the cloud provider. */
  clientId: string;
  /** Authorisation endpoint URL (provider-specific). */
  authEndpoint: string;
  /** Token endpoint URL (provider-specific). */
  tokenEndpoint: string;
  /** URI the provider will redirect back to after authorisation. */
  redirectUri: string;
  /** Space-separated OAuth scopes required by the adapter. */
  scopes: string;
}

export interface TokenSet {
  accessToken: string;
  /** Unix epoch seconds at which the access token expires. */
  expiresAt: number;
  /** May be absent if the provider does not return a refresh token. */
  refreshToken?: string;
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

/** Generate a cryptographically random code-verifier (43-128 chars, Base64URL). */
async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Derive the S256 code-challenge from a verifier. */
async function deriveCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── State storage keys ───────────────────────────────────────────────────────

const VERIFIER_KEY = 'atlas_oauth_verifier';
const STATE_KEY    = 'atlas_oauth_state';
const TOKEN_KEY    = 'atlas_oauth_token';

// ─── DriveOAuthClient ─────────────────────────────────────────────────────────

/**
 * Lightweight PKCE OAuth client.
 *
 * Typical usage:
 *
 * ```ts
 * const client = new DriveOAuthClient(config);
 *
 * // 1. Kick off the login flow (redirects the page).
 * await client.beginLogin();
 *
 * // 2. On the redirect-back page, exchange the code:
 * if (client.isRedirectBack(window.location.href)) {
 *   const token = await client.handleRedirect(window.location.href);
 * }
 *
 * // 3. Get a (possibly refreshed) access token for API calls:
 * const token = await client.getAccessToken();
 * ```
 */
export class DriveOAuthClient {
  private readonly config: OAuthConfig;
  private _token: TokenSet | null = null;

  constructor(config: OAuthConfig) {
    this.config = config;
    this._token = this._loadToken();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns true when the current URL is the OAuth redirect-back URI
   * and contains the expected `code` and `state` parameters.
   */
  isRedirectBack(url: string): boolean {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has('code') &&
      parsed.searchParams.has('state')
    );
  }

  /**
   * Begin the PKCE login flow.
   *
   * Generates a verifier / challenge, saves the verifier in sessionStorage,
   * then redirects the page to the provider's authorisation endpoint.
   */
  async beginLogin(): Promise<void> {
    const verifier   = await generateCodeVerifier();
    const challenge  = await deriveCodeChallenge(verifier);
    const state      = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY,    state);

    const params = new URLSearchParams({
      client_id:             this.config.clientId,
      response_type:         'code',
      redirect_uri:          this.config.redirectUri,
      scope:                 this.config.scopes,
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${this.config.authEndpoint}?${params.toString()}`;
  }

  /**
   * Handle the OAuth redirect-back URL.
   *
   * Validates the `state` parameter, exchanges the authorisation code for
   * a token, persists the token, and returns the TokenSet.
   *
   * Throws if the state does not match or the token exchange fails.
   */
  async handleRedirect(url: string): Promise<TokenSet> {
    const parsed  = new URL(url);
    const code    = parsed.searchParams.get('code');
    const state   = parsed.searchParams.get('state');
    const error   = parsed.searchParams.get('error');

    if (error) throw new Error(`OAuth error: ${error}`);
    if (!code)  throw new Error('OAuth redirect missing code parameter');

    const savedState = sessionStorage.getItem(STATE_KEY);
    if (state !== savedState) throw new Error('OAuth state mismatch — possible CSRF');

    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!verifier) throw new Error('OAuth code-verifier not found in session');

    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);

    const token = await this._exchangeCode(code, verifier);
    this._saveToken(token);
    return token;
  }

  /**
   * Return a valid access token, refreshing it if it is within 60 seconds
   * of expiry.  Throws if no token is available (user not logged in).
   */
  async getAccessToken(): Promise<string> {
    if (!this._token) throw new Error('Not authenticated — call beginLogin() first');

    const expiresIn = this._token.expiresAt - Date.now() / 1000;
    if (expiresIn < 60 && this._token.refreshToken) {
      this._token = await this._refreshToken(this._token.refreshToken);
      this._saveToken(this._token);
    }

    return this._token.accessToken;
  }

  /** True when the client holds a (possibly expired) token. */
  get isAuthenticated(): boolean {
    return this._token !== null;
  }

  /** Remove the stored token (log out). */
  signOut(): void {
    this._token = null;
    sessionStorage.removeItem(TOKEN_KEY);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _exchangeCode(code: string, verifier: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     this.config.clientId,
      code,
      redirect_uri:  this.config.redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    return this._parseTokenResponse(await response.json() as Record<string, unknown>);
  }

  private async _refreshToken(refreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     this.config.clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${text}`);
    }

    const json = await response.json() as Record<string, unknown>;
    // Some providers omit refresh_token in the refresh response — keep old one.
    if (!json['refresh_token']) json['refresh_token'] = refreshToken;
    return this._parseTokenResponse(json);
  }

  private _parseTokenResponse(json: Record<string, unknown>): TokenSet {
    const accessToken  = json['access_token'] as string | undefined;
    const expiresIn    = (json['expires_in']   as number | undefined) ?? 3600;
    const refreshToken = json['refresh_token'] as string | undefined;

    if (!accessToken) throw new Error('Token response missing access_token');

    return {
      accessToken,
      expiresAt: Date.now() / 1000 + expiresIn,
      refreshToken,
    };
  }

  private _saveToken(token: TokenSet): void {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  }

  private _loadToken(): TokenSet | null {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }
}
