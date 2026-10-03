import {
  ENDPOINT_TOKEN,
  ENDPOINT_USERINFO
} from "./config";
import type { TokenResponse, UserInfo } from "./types";

export async function exchangeCodeForToken(
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

export async function getUserInfo(accessToken: string): Promise<UserInfo> {
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