export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  [key: string]: unknown;
}

export interface ESNUserAddress {
  street_address?: string;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  postal_code?: string;
  cc?: string;
  country?: string;
}

export interface ESNSocialMedia {
  sm_ln?: string;
  sm_ig?: string;
  sm_tw?: string;
  sm_fb?: string;
}

export interface ESNDetailedRole {
  role: string;
  label: string;
}

export interface ESNDetailedGroup {
  label: string;
  type: string;
  scope: string;
  roles: ESNDetailedRole[] | ESNDetailedRole;
}

export interface UserInfo {
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

export interface RoleEntry {
  role: string;
  label?: string;
  source: "groups" | "detailed_groups";
  group?: string;
  scope?: string;
}

export interface Env {
  ESNACCOUNT_CLIENT_ID?: string;
  ESNACCOUNT_CLIENT_SECRET?: string;
  WORKER_URL?: string;
}

export interface OAuthRequestCookie {
  state: string;
  codeVerifier: string;
}