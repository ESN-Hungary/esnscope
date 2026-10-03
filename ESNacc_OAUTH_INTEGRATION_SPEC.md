# ESN Account OAuth Integration Specification

This document is a language-neutral implementation contract for integrating with
ESN Account. It is written so that a human developer or an AI code generator can
implement the flow in any language or framework.

The integration authenticates a user, obtains an access token using OAuth 2.0
Authorization Code with PKCE, fetches the user's profile, and extracts every
role from the returned data.

## 1. Implementation Checklist

Before writing code, provide these inputs:

| Input | Required | Description |
| --- | --- | --- |
| `client_id` | Yes | OAuth client identifier issued by ESN Account |
| `client_secret` | Usually yes | OAuth client secret; keep it server-side |
| `worker_url` | Optional | Canonical public origin, for example `https://app.example.org`; if empty, derive it from the incoming request |
| `authorization_endpoint` | Yes | `https://accounts.esn.org/oauth/authorize` |
| `token_endpoint` | Yes | `https://accounts.esn.org/oauth/token` |
| `userinfo_endpoint` | Yes | `https://accounts.esn.org/oauth/v1/userinfo` |
| `scope` | Yes | `oauth2_access_to_profile_information` |
| `redirect_path` | Yes | `/oauth/callback` |

The final redirect URI is:

```text
redirect_uri = trimTrailingSlashes(worker_url) + "/oauth/callback"
```

If `worker_url` is empty, use the origin of the request that started the flow.
Never derive the callback from an untrusted forwarded host header unless the
application has an explicit trusted-proxy policy.

## 2. OAuth Contract

### 2.1 Authorization endpoint

```text
GET https://accounts.esn.org/oauth/authorize
```

Send these query parameters:

| Parameter | Value |
| --- | --- |
| `response_type` | `code` |
| `client_id` | Configured client ID |
| `redirect_uri` | Registered callback URI |
| `scope` | `oauth2_access_to_profile_information` |
| `state` | Cryptographically random value |
| `code_challenge` | Base64url-encoded SHA-256 digest of `code_verifier` |
| `code_challenge_method` | `S256` |

Example authorization URL shape:

```text
https://accounts.esn.org/oauth/authorize?
  response_type=code&
  client_id=CLIENT_ID&
  redirect_uri=https%3A%2F%2Fapp.example.org%2Foauth%2Fcallback&
  scope=oauth2_access_to_profile_information&
  state=RANDOM_STATE&
  code_challenge=PKCE_CHALLENGE&
  code_challenge_method=S256
```

The values must be URL encoded by the implementation. Do not concatenate raw
user-controlled values into the URL.

A successful provider redirect looks like:

```text
GET /oauth/callback?code=AUTHORIZATION_CODE&state=RANDOM_STATE
```

An unsuccessful provider redirect may look like:

```text
GET /oauth/callback?error=access_denied&error_description=User%20cancelled
```

### 2.2 Token endpoint

```text
POST https://accounts.esn.org/oauth/token
Content-Type: application/x-www-form-urlencoded
Accept: application/json
```

Send this form body:

```text
grant_type=authorization_code
code=AUTHORIZATION_CODE
redirect_uri=REGISTERED_CALLBACK_URI
client_id=CLIENT_ID
client_secret=CLIENT_SECRET
code_verifier=ORIGINAL_CODE_VERIFIER
```

The `redirect_uri` must be byte-for-byte equivalent to the URI used in the
authorization request and registered with the provider.

Expected successful response shape:

```json
{
  "access_token": "ACCESS_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "REFRESH_TOKEN",
  "scope": "oauth2_access_to_profile_information"
}
```

Only `access_token` is required by this integration. Other properties are
provider-specific and may be absent.

Required error behavior:

- Non-2xx responses must be treated as token exchange failures.
- Invalid JSON must be treated as a token exchange failure.
- A JSON response without `access_token` must be treated as a token exchange failure.
- Never display `client_secret`, `access_token`, `refresh_token`, or `id_token`.

### 2.3 Userinfo endpoint

```text
GET https://accounts.esn.org/oauth/v1/userinfo
Authorization: Bearer ACCESS_TOKEN
Accept: application/json
```

Expected response: a JSON object containing profile claims and, when available,
group and role claims.

Required error behavior:

- Non-2xx responses must be treated as userinfo failures.
- Invalid JSON must be treated as a userinfo failure.
- Missing optional profile fields must not make the whole response invalid.
- Unknown fields should be preserved because the provider may add claims.

## 3. Required OAuth State

The implementation must keep these values between the authorization request and
callback:

```text
state
code_verifier
```

Recommended server-side browser state:

```text
Cookie name: esn_oauth
Max-Age: 600 seconds
Path: /oauth/callback
HttpOnly: true
Secure: true in production
SameSite: Lax
```

The cookie can contain a serialized object such as:

```json
{
  "state": "RANDOM_STATE",
  "codeVerifier": "ORIGINAL_CODE_VERIFIER"
}
```

A production implementation should preferably store only an opaque state ID in
the cookie and keep the verifier server-side. If the verifier is stored in the
cookie, protect the cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, a short
expiration, and integrity protection where possible.

Callback validation order:

1. Read the saved state and verifier.
2. Read the returned `state`.
3. Compare them using a constant-time comparison where available.
4. Reject the request if the cookie is missing, the query state is missing, or
   the values differ.
5. Reject the request if the authorization code is missing.
6. Use the saved verifier in the token request.
7. Delete or expire the saved state after one callback attempt.

## 4. PKCE Algorithm

Generate a cryptographically random verifier. A verifier of 32 to 64 random
bytes encoded as base64url is suitable.

```text
verifier_bytes = secureRandomBytes(64)
code_verifier = base64url(verifier_bytes)
code_challenge = base64url(SHA256(UTF8(code_verifier)))
```

The authorization request sends `code_challenge`; the token request sends the
original `code_verifier`.

Do not generate PKCE values with timestamps, predictable counters, ordinary
random functions, or user input.

## 5. Userinfo Data Model

All fields are optional unless the provider explicitly guarantees them. The
following TypeScript model represents the expected shape and can be translated
to a language-specific schema.

```ts
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
  sm_ln?: string; // LinkedIn
  sm_ig?: string; // Instagram
  sm_tw?: string; // Twitter/X
  sm_fb?: string; // Facebook
}
// Deprecated CAS
interface ESNDetailedRole {
  role: string;
  label: string;
}
// Deprecated CAS
interface ESNDetailedGroup {
  label: string;
  type: string;
  scope: string;
  // The provider may return one object or an array.
  roles: ESNDetailedRole[] | ESNDetailedRole;
}

interface ESNUserInfo {
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
  detailed_groups?: ESNDetailedGroup[]; // Deprecated CAS
  groups?: Record<string, string>; // OAuth2 roles
  [providerClaim: string]: unknown;
}
```

## 6. Where Each Data Item Is Located

| Information | JSON path | Notes |
| --- | --- | --- |
| Stable user ID | `sub` | Provider subject identifier |
| Full name | `name` | Display name |
| First name | `given_name` | Optional |
| Last name | `family_name` | Optional |
| Primary email | `email` | Optional |
| ESN email | `esn_email` | Optional |
| Verified email flag | `email_verified` | Boolean |
| Avatar | `picture` | URL string |
| Nickname | `nickname` | Optional |
| Preferred username | `preferred_username` | Optional |
| Gender | `gender` | Optional |
| Birth date | `birthdate` | Optional; preserve provider format |
| Address | `address` | Nested object |
| Social links | `other.sm_ln`, `other.sm_ig`, `other.sm_tw`, `other.sm_fb` | Optional |
| Last update | `updated_at` | Numeric timestamp |
| Flat / OAuth roles | `groups[*]` | Values are role strings |
| Detailed (deprecated CAS) groups | `detailed_groups[*]` | Group metadata and role objects |
| Future provider claims | Any unknown top-level key | Preserve without assuming meaning |

## 7. Role Extraction Contract

Roles can be present in two different representations.

### 7.1 Flat / OAuth2 `groups` representation

Input:

```json
{
  "groups": {
    "8": "COMMITTEE:itcom-chair",
    "42": "NATIONAL_ORGANISATION:president"
  }
}
```

Interpretation:

- The object key is the group identifier.
- The object value is the role string.
- Each key-value pair produces one role entry.

Normalized output:

```json
{
  "role": "COMMITTEE:itcom-chair",
  "source": "groups",
  "group": "8"
}
```

### 7.2 Structured (deprecated) CAS `detailed_groups` representation

Input can contain an array of roles:

```json
{
  "detailed_groups": [
    {
      "label": "IT Committee",
      "type": "committee",
      "scope": "international",
      "roles": [
        {
          "role": "COMMITTEE:itcom-chair",
          "label": "IT Committee Chair"
        }
      ]
    }
  ]
}
```

It can also contain one role object:

```json
{
  "detailed_groups": [
    {
      "label": "IT Committee",
      "type": "committee",
      "scope": "international",
      "roles": {
        "role": "COMMITTEE:itcom-chair",
        "label": "IT Committee Chair"
      }
    }
  ]
}
```

Both forms produce the same normalized output:

```json
{
  "role": "COMMITTEE:itcom-chair",
  "label": "IT Committee Chair",
  "source": "detailed_groups",
  "group": "IT Committee",
  "scope": "international"
}
```

### 7.3 Language-neutral normalization pseudocode

```text
function extractRoles(userInfo): list of RoleEntry
    result = empty list

    for each (groupId, roleValue) in userInfo.groups or empty object:
        append to result:
            role: roleValue
            source: "groups"
            group: groupId

    for each group in userInfo.detailed_groups or empty list:
        if group.roles is an array:
            detailedRoles = group.roles
        else if group.roles is an object:
            detailedRoles = [group.roles]
        else:
            detailedRoles = []

        for each detailedRole in detailedRoles:
            if detailedRole.role is not a string:
                continue

            append to result:
                role: detailedRole.role
                label: detailedRole.label
                source: "detailed_groups"
                group: group.label
                scope: group.scope

    return result
```

Do not deduplicate by role string unless the application explicitly wants a
unique-role view. The same role can legitimately appear in multiple groups or
scopes. Keep the source and group metadata so callers can distinguish them.

## 8. Complete Integration Pseudocode

```text
function startLogin(request): response
    clientId = requiredConfig("client_id")
    redirectUri = getRedirectUri(request)
    state = secureRandomBase64Url(32)
    verifier = secureRandomBase64Url(64)
    challenge = base64url(sha256(utf8(verifier)))

    setHttpOnlyCookie(
        name = "esn_oauth",
        value = { state, codeVerifier: verifier },
        maxAge = 600,
        path = "/oauth/callback",
        sameSite = "Lax",
        secure = true
    )

    authorizationUrl = urlWithQuery(
        "https://accounts.esn.org/oauth/authorize",
        {
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: "oauth2_access_to_profile_information",
            state: state,
            code_challenge: challenge,
            code_challenge_method: "S256"
        }
    )

    return redirect(authorizationUrl)

function handleCallback(request): response
    oauthState = readOAuthCookie(request)
    error = query(request, "error")

    if error exists:
        expireOAuthCookie()
        return clientError(error, query(request, "error_description"))

    code = requiredQuery(request, "code")
    returnedState = requiredQuery(request, "state")

    if oauthState is missing:
        return clientError("Missing OAuth state")
    if not constantTimeEqual(returnedState, oauthState.state):
        return clientError("Invalid OAuth state")

    redirectUri = getRedirectUri(request)
    tokens = POST_FORM(
        "https://accounts.esn.org/oauth/token",
        {
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
            client_id: requiredConfig("client_id"),
            client_secret: requiredConfig("client_secret"),
            code_verifier: oauthState.codeVerifier
        }
    )

    if tokens.access_token is missing:
        return serverError("Token response has no access_token")

    userInfo = GET_JSON(
        "https://accounts.esn.org/oauth/v1/userinfo",
        headers = { Authorization: "Bearer " + tokens.access_token }
    )

    roles = extractRoles(userInfo)
    expireOAuthCookie()
    return render({ userInfo, roles, safeTokenMetadata(tokens) })
```

## 9. Error and HTTP Handling

A compatible implementation should return or surface these conditions clearly:

| Condition | Suggested status | Meaning |
| --- | --- | --- |
| Missing authorization code | `400` | Provider callback is incomplete |
| Missing or invalid state | `400` | Possible expired or forged flow |
| Provider authorization error | `400` | User denied access or provider rejected request |
| Token endpoint non-2xx | `502` | Upstream token service failure |
| Invalid token JSON | `502` | Provider response is malformed |
| Missing access token | `502` | Provider did not grant usable access |
| Userinfo endpoint non-2xx | `502` | Upstream profile request failed |
| Invalid userinfo JSON | `502` | Provider response is malformed |

Do not include client secrets or access tokens in error pages, logs, browser
URLs, or analytics.

## 10. Acceptance Tests

An implementation is compatible when these cases work:

1. Opening `/login` shows a login action.
2. Starting login sends the browser to the authorization endpoint with `scope`,
   `state`, `code_challenge`, and `code_challenge_method=S256`.
3. The callback rejects a missing state cookie.
4. The callback rejects a mismatched state.
5. The token request includes the same redirect URI used in authorization and the
   original PKCE verifier.
6. A token response without `access_token` fails safely.
7. Userinfo is requested with `Authorization: Bearer <access_token>`.
8. A profile with only `groups` produces flat role entries.
9. A profile with only `detailed_groups` produces structured role entries.
10. A `detailed_groups[].roles` object and array produce equivalent normalized
    entries.
11. Missing optional profile fields do not crash the integration.
12. Raw access and refresh tokens are not rendered.
13. Unknown userinfo claims remain available to the application.

## 11. Current ESNscope Module Map

The reference implementation separates responsibilities as follows:

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Worker routing |
| `src/config.ts` | Endpoints, scope, bindings, redirect URI |
| `src/types.ts` | ESN Account entities and shared types |
| `src/esnaccount.ts` | Token exchange and userinfo calls |
| `src/oauth.ts` | PKCE, state cookie, and callback handling |
| `src/roles.ts` | Role normalization |
| `src/html.ts` | HTML responses and rendering |
| `src/styles.ts` | Page styles |
| `wrangler.jsonc` | Worker deployment and environment configuration |
