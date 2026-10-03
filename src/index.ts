/**
 * ESNscope
 *
 * OAuth client / identity explorer for ESN Account.
 *
 * ---------------------------------------------------------------------------
 * PROJECT CONFIGURATION
 * ---------------------------------------------------------------------------
 * Put the ESN Account OAuth configuration here.
 *
 * IMPORTANT:
 * - Keep client credentials in Cloudflare Worker secrets.
 */

// The only profile scope requested from ESN Account.
const SCOPE = "oauth2_access_to_profile_information";

// ESN Account OAuth endpoints.
const ENDPOINT_USERINFO = "https://accounts.esn.org/oauth/v1/userinfo";
const ENDPOINT_TOKEN = "https://accounts.esn.org/oauth/token";
const ENDPOINT_AUTHORIZATION = "https://accounts.esn.org/oauth/authorize";

// OAuth client credentials.
// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  [key: string]: unknown;
}

interface ESNUserAddress {
  street_address?: string;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  postal_code?: string;
  cc?: string;
  country?: string;
}

interface ESNSocialMedia {
  sm_ln?: string;
  sm_ig?: string;
  sm_tw?: string;
  sm_fb?: string;
}

interface ESNDetailedRole {
  role: string;
  label: string;
}

interface ESNDetailedGroup {
  label: string;
  type: string;
  scope: string;
  roles: ESNDetailedRole[] | ESNDetailedRole;
}

interface UserInfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  esn_email?: string;
  nickname?: string;
  preferred_username?: string;
  gender?: string;
  birthdate?: string;
  address?: ESNUserAddress;
  other?: ESNSocialMedia;
  updated_at?: number;
  detailed_groups?: ESNDetailedGroup[];
  groups?: Record<string, string>;
  [key: string]: unknown;
}

interface RoleEntry {
  role: string;
  label?: string;
  source: "groups" | "detailed_groups";
  group?: string;
  scope?: string;
}

interface Env {
  ESNACCOUNT_CLIENT_ID?: string;
  ESNACCOUNT_CLIENT_SECRET?: string;
  ESNACCOUNT_WORKER_URL?: string;
}

interface OAuthRequestCookie {
  state: string;
  codeVerifier: string;
}

// ---------------------------------------------------------------------------
// WORKER
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return html(homePage());
    }

    if (url.pathname === "/login") {
      return html(loginPage());
    }

    if (url.pathname === "/oauth/authorize") {
      return startAuthorization(request, env);
    }

    if (url.pathname === "/oauth/callback") {
      return handleCallback(request, url, env);
    }

    if (url.pathname === "/health") {
      return json({
        status: "ok",
        service: "esnscope"
      });
    }

    return html(errorPage(404, "Page not found."));
  }
};

// ---------------------------------------------------------------------------
// OAUTH
// ---------------------------------------------------------------------------

async function startAuthorization(request: Request, env: Env): Promise<Response> {
  const clientId = requireConfig(env.ESNACCOUNT_CLIENT_ID, "ESNACCOUNT_CLIENT_ID");
  const redirectUri = getRedirectUri(request, env);
  const state = randomValue();
  const codeVerifier = randomValue(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const cookie: OAuthRequestCookie = { state, codeVerifier };
  const authorizationUrl = new URL(ENDPOINT_AUTHORIZATION);

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", SCOPE);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl.toString(),
      "Set-Cookie": serializeOAuthCookie(cookie)
    }
  });
}

async function handleCallback(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  const oauthCookie = parseOAuthCookie(request);
  const error = url.searchParams.get("error");

  if (error) {
    const description =
      url.searchParams.get("error_description") ??
      "The authorization server returned an error.";

    return withExpiredOAuthCookie(html(
      errorPage(
        400,
        `${escapeHtml(error)}: ${escapeHtml(description)}`
      )
    ));
  }

  const code = url.searchParams.get("code");

  if (!code) {
    return withExpiredOAuthCookie(html(errorPage(400, "No authorization code was returned.")));
  }

  const state = url.searchParams.get("state");

  if (!oauthCookie || !state || !timingSafeEqual(state, oauthCookie.state)) {
    return withExpiredOAuthCookie(
      html(errorPage(400, "The OAuth state could not be verified."))
    );
  }

  const clientId = requireConfig(env.ESNACCOUNT_CLIENT_ID, "ESNACCOUNT_CLIENT_ID");
  const clientSecret = requireConfig(
    env.ESNACCOUNT_CLIENT_SECRET,
    "ESNACCOUNT_CLIENT_SECRET"
  );
  const redirectUri = getRedirectUri(request, env);

  try {
    const tokenResponse = await exchangeCodeForToken(
      code,
      clientId,
      clientSecret,
      oauthCookie.codeVerifier,
      redirectUri
    );

    if (!tokenResponse.access_token) {
      return withExpiredOAuthCookie(html(
        errorPage(
          502,
          "The token endpoint did not return an access token."
        )
      ));
    }

    const userInfo = await getUserInfo(tokenResponse.access_token);

    return withExpiredOAuthCookie(html(
      explorerPage({
        userInfo,
        tokenResponse
      })
    ));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OAuth error.";

    return withExpiredOAuthCookie(html(errorPage(502, escapeHtml(message))));
  }
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const body = new URLSearchParams();

  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("code_verifier", codeVerifier);

  const response = await fetch(ENDPOINT_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Token endpoint returned HTTP ${response.status}: ${responseText}`
    );
  }

  try {
    return JSON.parse(responseText) as TokenResponse;
  } catch {
    throw new Error("Token endpoint returned invalid JSON.");
  }
}

function getRedirectUri(request: Request, env: Env): string {
  const configuredWorkerUrl = env.ESNACCOUNT_WORKER_URL?.trim();
  const workerUrl = configuredWorkerUrl || new URL(request.url).origin;

  return `${workerUrl.replace(/\/+$/, "")}/oauth/callback`;
}

async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(ENDPOINT_USERINFO, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Userinfo endpoint returned HTTP ${response.status}: ${responseText}`
    );
  }

  try {
    return JSON.parse(responseText) as UserInfo;
  } catch {
    throw new Error("Userinfo endpoint returned invalid JSON.");
  }
}

function requireConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing Worker binding: ${name}`);
  }

  return value;
}

function randomValue(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const encodedVerifier = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", encodedVerifier);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function serializeOAuthCookie(cookie: OAuthRequestCookie): string {
  const value = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(cookie))
  );

  return `esnscope_oauth=${value}; Max-Age=600; Path=/oauth/callback; HttpOnly; Secure; SameSite=Lax`;
}

function parseOAuthCookie(request: Request): OAuthRequestCookie | null {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("esnscope_oauth="));

  if (!cookie) {
    return null;
  }

  try {
    const encodedValue = cookie.slice("esnscope_oauth=".length);
    const binary = atob(encodedValue.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as OAuthRequestCookie;

    if (typeof parsed.state !== "string" || typeof parsed.codeVerifier !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function withExpiredOAuthCookie(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    "esnscope_oauth=; Max-Age=0; Path=/oauth/callback; HttpOnly; Secure; SameSite=Lax"
  );

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

// ---------------------------------------------------------------------------
// ROLE EXPLORATION
// ---------------------------------------------------------------------------

function extractRoles(userInfo: UserInfo): RoleEntry[] {
  const roles: RoleEntry[] = [];

  for (const [groupId, role] of Object.entries(userInfo.groups ?? {})) {
    roles.push({
      role,
      source: "groups",
      group: groupId
    });
  }

  for (const group of userInfo.detailed_groups ?? []) {
    const detailedRoles = Array.isArray(group.roles)
      ? group.roles
      : [group.roles];

    for (const detailedRole of detailedRoles) {
      roles.push({
        role: detailedRole.role,
        label: detailedRole.label,
        source: "detailed_groups",
        group: group.label,
        scope: group.scope
      });
    }
  }

  return roles;
}

function renderRoleList(roles: RoleEntry[]): string {
  if (roles.length === 0) {
    return "<p>No roles were returned by the userinfo endpoint.</p>";
  }

  return `
    <p>${roles.length} role${roles.length === 1 ? "" : "s"} found.</p>
    <ul class="role-list">
      ${roles.map((entry) => `
        <li>
          <strong>${escapeHtml(entry.label ?? entry.role)}</strong>
          ${entry.label ? `<code>${escapeHtml(entry.role)}</code>` : ""}
          <span>${escapeHtml(formatRoleSource(entry))}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function formatRoleSource(entry: RoleEntry): string {
  if (entry.source === "groups") {
    return `groups[${entry.group ?? ""}]`;
  }

  return [entry.group, entry.scope].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function homePage(): string {
  return page(
    "ESNscope",
    `
      <main class="container">
        <h1>ESNscope</h1>
        <p class="lead">
          Explore the identity data and roles returned by ESN Account.
        </p>

        <div class="card">
          <h2>OAuth client</h2>
          <p>
            ESNscope will redirect you to ESN Account for authentication,
            then inspect the data returned through the OAuth flow.
          </p>

          <a class="button" href="/login">Log in with ESN Account</a>
        </div>

        <div class="card">
          <h2>Configured scopes</h2>
          <pre>${escapeHtml(JSON.stringify([SCOPE], null, 2))}</pre>
        </div>
      </main>
    `
  );
}

function loginPage(): string {
  return page(
    "Log in with ESNaccount",
    `
      <main class="login-shell">
        <section class="login-panel">
          <p class="eyebrow">ESNscope</p>
          <h1>Access your profile</h1>
          <p class="lead">
            Continue securely with your ESNaccount to view your profile
            information.
          </p>
          <a class="button login-button" href="/oauth/authorize">
            Login with ESNaccount
          </a>
        </section>
      </main>
    `
  );
}

function explorerPage(data: {
  userInfo: UserInfo;
  tokenResponse: TokenResponse;
}): string {
  const roles = extractRoles(data.userInfo);

  // Never render access_token, refresh_token, client_secret or id_token.
  const safeTokenInfo = { ...data.tokenResponse };
  delete safeTokenInfo.access_token;
  delete safeTokenInfo.refresh_token;
  delete safeTokenInfo.client_secret;
  delete safeTokenInfo.id_token;

  return page(
    "ESNscope — Account Explorer",
    `
      <main class="container">
        <div class="topbar">
          <div>
            <h1>ESNscope</h1>
            <p class="lead">ESN Account identity explorer</p>
          </div>
          <a class="button secondary" href="/">Home</a>
        </div>

        <section class="card">
          <h2>Userinfo</h2>
          <p>
            This is the JSON object returned by the configured
            <code>userinfo</code> endpoint.
          </p>
          <pre>${escapeHtml(JSON.stringify(data.userInfo, null, 2))}</pre>
        </section>

        <section class="card">
          <h2>All roles</h2>
          <p>
            Roles are collected from both the flat <code>groups</code> claim and
            the structured <code>detailed_groups</code> claim.
          </p>
          ${renderRoleList(roles)}
          <details>
            <summary>Role data as JSON</summary>
            <pre>${escapeHtml(JSON.stringify(roles, null, 2))}</pre>
          </details>
        </section>

        <section class="card">
          <h2>Token response metadata</h2>
          <p>
            Sensitive token values are deliberately omitted from the page.
          </p>
          <pre>${escapeHtml(JSON.stringify(safeTokenInfo, null, 2))}</pre>
        </section>

        <section class="card">
          <h2>Requested scopes</h2>
          <pre>${escapeHtml(JSON.stringify([SCOPE], null, 2))}</pre>
        </section>
      </main>
    `
  );
}

function errorPage(status: number, message: string): string {
  return page(
    `ESNscope — Error ${status}`,
    `
      <main class="container">
        <div class="card">
          <h1>OAuth error</h1>
          <p>${message}</p>
          <a class="button" href="/">Back to ESNscope</a>
        </div>
      </main>
    `
  );
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: system-ui, sans-serif;
    }

    body {
      margin: 0;
      background: #111827;
      color: #f3f4f6;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 48px 24px;
    }

    .login-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: radial-gradient(circle at top left, #334155, #111827 60%);
    }

    .login-panel {
      width: min(100%, 440px);
      background: #f8fafc;
      color: #172033;
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 24px 80px rgb(0 0 0 / 30%);
    }

    .eyebrow {
      color: #c2410c;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .login-panel .lead {
      color: #475569;
    }

    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 42px;
    }

    h2 {
      margin-top: 0;
    }

    .lead {
      color: #9ca3af;
      font-size: 18px;
    }

    .card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 24px;
      margin-top: 24px;
      overflow: hidden;
    }

    pre {
      overflow-x: auto;
      background: #111827;
      border-radius: 8px;
      padding: 16px;
      line-height: 1.5;
    }

    .role-list {
      display: grid;
      gap: 10px;
      padding: 0;
      list-style: none;
    }

    .role-list li {
      display: grid;
      gap: 4px;
      padding: 12px 14px;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 8px;
    }

    .role-list code,
    .role-list span {
      color: #9ca3af;
      font-size: 14px;
    }

    code {
      color: #d1d5db;
    }

    .button {
      display: inline-block;
      background: #f3f4f6;
      color: #111827;
      text-decoration: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
    }

    .button.secondary {
      background: #374151;
      color: #f3f4f6;
    }

    .login-button {
      background: #c2410c;
      color: #fff;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
