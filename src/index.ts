import { handleCallback, startAuthorization } from "./oauth";
import { errorPage, homePage, html, json, loginPage } from "./html";
import type { Env } from "./types";

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
