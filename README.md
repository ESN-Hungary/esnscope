# ESNscope

ESNscope is a small Cloudflare Worker that acts as an OAuth client for ESNaccount.

It allows a user to:

1. Start an OAuth authorization flow.
2. Authenticate with ESNaccount using PKCE.
3. Return to ESNscope through the OAuth callback.
4. Exchange the authorization code for tokens.
5. Request the `userinfo` endpoint.
6. Inspect the returned profile information.

## Configuration

The requested scope is fixed to `oauth2_access_to_profile_information`. Configure the
The Worker URL is optional. Leave `WORKER_URL` empty to derive it
from the incoming request host:

```jsonc
"vars": {
   "WORKER_URL": ""
}
```

### Client credentials

Both client credentials are read from Worker secrets. Do **not** commit them to Git.

For production, use a Cloudflare Worker secret:

```bash
npx wrangler secret put ESNACCOUNT_CLIENT_ID
npx wrangler secret put ESNACCOUNT_CLIENT_SECRET
```

## Install

```bash
npm install
```

## Local development

```bash
npm run dev
```

The default local URL is usually:

```text
http://localhost:8787
```

The OAuth provider must have the callback URI for the deployed Worker registered.
It is generated dynamically as:

```text
<worker-origin>/oauth/callback
```

## Deploy

```bash
npx wrangler login
npm run deploy
```

After deployment, register the deployed callback URI with ESN Account.

## OAuth flow

```text
Browser
   |
   | /login
   v
ESNscope
   |
   | authorization request
   v
ESN Account
   |
   | authorization code
   v
/oauth/callback
   |
   | code -> token endpoint
   v
ESN Account
   |
   | access token
   v
/userinfo
   |
   v
ESNscope UI
```

## Security notes

This initial version is intentionally simple and is primarily an OAuth exploration/debugging client.

Before exposing it publicly, consider adding:

- Encrypted/secure session storage rather than putting tokens in browser-accessible state.
- Cloudflare Workers KV or Durable Objects for session storage.
- A production Worker secret for the client secret.
- Explicit token expiry handling.
- Logout/revocation.
- CSP and other security headers.
- Restricting displayed token information so raw tokens are never rendered.

The UI does **not** display the raw access token or client secret.
