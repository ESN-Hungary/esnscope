export const styles = `
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
  `;