import { SCOPE } from "./config";
import { extractRoles, formatRoleSource } from "./roles";
import { styles } from "./styles";
import type { RoleEntry, TokenResponse, UserInfo } from "./types";

export function homePage(): string {
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

export function loginPage(): string {
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

export function explorerPage(data: {
  userInfo: UserInfo;
  tokenResponse: TokenResponse;
}): string {
  const roles = extractRoles(data.userInfo);
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

export function errorPage(status: number, message: string): string {
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

export function html(body: string, status = 200): Response {
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

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
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

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}