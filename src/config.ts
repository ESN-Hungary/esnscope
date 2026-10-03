import type { Env } from "./types";

export const SCOPE = "oauth2_access_to_profile_information";
export const ENDPOINT_USERINFO = "https://accounts.esn.org/oauth/v2/userinfo";
export const ENDPOINT_TOKEN = "https://accounts.esn.org/oauth/token";
export const ENDPOINT_AUTHORIZATION = "https://accounts.esn.org/oauth/authorize";

export function requireConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing Worker binding: ${name}`);
  }

  return value;
}

export function getRedirectUri(request: Request, env: Env): string {
  const configuredWorkerUrl = env.WORKER_URL?.trim();
  const workerUrl = configuredWorkerUrl || new URL(request.url).origin;

  return `${workerUrl.replace(/\/+$/, "")}/oauth/callback`;
}