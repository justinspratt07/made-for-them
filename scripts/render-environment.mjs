/** @param {Record<string, string | undefined>} input */
export function renderEnvironment(input) {
  if (input.RENDER !== "true") throw new Error("Render startup requires Render environment settings.");
  if (input.GIFT_DATA_SOURCE && input.GIFT_DATA_SOURCE !== "postgres") {
    throw new Error("Render requires PostgreSQL storage.");
  }
  if ([input.STATIC_EXPORT, input.GITHUB_PAGES].includes("true")) {
    throw new Error("Render server builds cannot use static export mode.");
  }
  if (input.MIGRATION_DATABASE_URL) throw new Error("Do not provide migration credentials to Render.");
  if (input.ADMIN_CLIENT_IP_HEADER && input.ADMIN_CLIENT_IP_HEADER !== "cf-connecting-ip") {
    throw new Error("Render requires the ingress-overwritten CF-Connecting-IP header.");
  }
  const mode = input.APP_DEPLOYMENT ?? "preview";
  if (!["preview", "production"].includes(mode)) throw new Error("Invalid Render deployment mode.");
  let origin = input.ADMIN_ORIGIN;
  if (!origin) {
    const external = new URL(input.RENDER_EXTERNAL_URL ?? "");
    if (external.protocol !== "https:" || !external.hostname.endsWith(".onrender.com") ||
        external.username || external.password || external.port || external.pathname !== "/" ||
        external.search || external.hash) {
      throw new Error("A valid Render external URL is required.");
    }
    origin = external.origin;
  }
  return {
    ...input, NODE_ENV: "production", APP_DEPLOYMENT: mode, GIFT_DATA_SOURCE: "postgres",
    ADMIN_ORIGIN: origin, ADMIN_CLIENT_IP_HEADER: "cf-connecting-ip",
    STATIC_EXPORT: "false", GITHUB_PAGES: "false",
    ISOLATED_PREVIEW: input.ISOLATED_PREVIEW ?? "false",
  };
}

/** @param {Record<string, string | undefined>} env */
export function renderStartArguments(env) {
  const value = env.PORT ?? "10000";
  const port = Number(value);
  if (!/^[1-9][0-9]{0,4}$/.test(value) || port > 65535 || [18012, 18013, 19099].includes(port)) {
    throw new Error("Invalid Render server port.");
  }
  return ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", value];
}
