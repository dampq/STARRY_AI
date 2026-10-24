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
  if (env.APP_ORIGIN) return env.APP_ORIGIN;
  const hostname = codespacesHostname(env);
  return hostname ? `https://${hostname}` : "http://localhost:5173";
}
