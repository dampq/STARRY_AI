/** Codespaces is same-origin: only its frontend port is exposed to the browser. */
export function codespacesHostname(env: Record<string, string | undefined>) {
  if (!env.CODESPACE_NAME) return undefined;
  const name = env.CODESPACE_NAME;
  const domain =
    env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
  if (!/^[a-z0-9-]+$/.test(name) || !/^[a-z0-9.-]+$/.test(domain)) {
    throw new Error("Invalid Codespaces forwarding hostname.");
  }
  return `${name}-5173.${domain}`;
}
export function readAppOrigin(env: Record<string, string | undefined>) {
  // An inherited/local .env APP_ORIGIN must not override this Codespace's
  // exact forwarded address. Only this instance's port 5173 is trusted.
  const hostname = codespacesHostname(env);
  if (hostname) return `https://${hostname}`;
  if (!env.APP_ORIGIN) return "http://localhost:5173";
  const configured = new URL(env.APP_ORIGIN);
  if (
    !["https:", "http:"].includes(configured.protocol) ||
    configured.username ||
    configured.password
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) application URL without credentials.",
    );
  }
  return configured.origin;
}

/** A Codespaces tunnel can rewrite the browser Origin to the local Vite URL.
 * Only accept those exact local origins on the actual loopback proxy socket.
 * X-Forwarded-For is deliberately not used to establish this trust.
 */
export function acceptsRequestOrigin(
  received: string,
  expected: string,
  trustLocalProxy: boolean,
  remoteAddress: string | undefined,
) {
  if (received === expected) return true;
  const loopbackSocket = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
    remoteAddress || "",
  );
  return (
    trustLocalProxy &&
    loopbackSocket &&
    ["http://localhost:5173", "http://127.0.0.1:5173"].includes(received)
  );
}
