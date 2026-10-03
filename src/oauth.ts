import {
  ENDPOINT_AUTHORIZATION,
  getRedirectUri,
  requireConfig,
  SCOPE
} from "./config";
import { exchangeCodeForToken, getUserInfo } from "./esnaccount";
import { errorPage, escapeHtml, explorerPage, html } from "./html";
import type { Env, OAuthRequestCookie } from "./types";

export async function startAuthorization(
  request: Request,
  env: Env
): Promise<Response> {
  const clientId = requireConfig(env.ESNACCOUNT_CLIENT_ID, "ESNACCOUNT_CLIENT_ID");
  const redirectUri = getRedirectUri(request, env);
  const state = randomValue();
  const codeVerifier = randomValue(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);
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
      "Set-Cookie": serializeOAuthCookie({ state, codeVerifier })
    }
  });
}

export async function handleCallback(
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

    return expireOAuthCookie(html(
      errorPage(400, `${escapeHtml(error)}: ${escapeHtml(description)}`)
    ));
  }

  const code = url.searchParams.get("code");

  if (!code) {
    return expireOAuthCookie(html(errorPage(400, "No authorization code was returned.")));
  }

  const state = url.searchParams.get("state");

  if (!oauthCookie || !state || !timingSafeEqual(state, oauthCookie.state)) {
    return expireOAuthCookie(
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
      return expireOAuthCookie(html(
        errorPage(502, "The token endpoint did not return an access token.")
      ));
    }

    const userInfo = await getUserInfo(tokenResponse.access_token);

    return expireOAuthCookie(html(explorerPage({ userInfo, tokenResponse })));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OAuth error.";

    return expireOAuthCookie(html(errorPage(502, escapeHtml(message))));
  }
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

function expireOAuthCookie(response: Response): Response {
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

