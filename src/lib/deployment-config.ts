import { getGiftDataSource } from "../db/config";

type Environment = Record<string, string | undefined>;
export type DatabaseAccess = "public" | "editor";

export function isHostedDeployment(env: Environment = process.env) {
  const mode = env.APP_DEPLOYMENT ?? (env.NODE_ENV === "production" ? "production" : "local");
  if (!["local", "preview", "production"].includes(mode)) throw new Error("Invalid deployment mode.");
  if (mode === "local" && env.NODE_ENV === "production") {
    throw new Error("A production server requires preview or production deployment settings.");
  }
  return mode !== "local";
}

export function loopbackHost(host: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

export function configuredAdminOrigin(env: Environment = process.env) {
  const origin = env.ADMIN_ORIGIN;
  if (!origin) {
    if (isHostedDeployment(env)) throw new Error("ADMIN_ORIGIN is required.");
    return undefined;
  }
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password ||
      (url.protocol !== "https:" && !((env.APP_DEPLOYMENT === "preview" || !isHostedDeployment(env)) &&
        url.protocol === "http:" && loopbackHost(url.hostname)))) {
    throw new Error("ADMIN_ORIGIN must be an exact HTTPS origin (loopback HTTP is allowed for previews).");
  }
  return origin;
}

export function runtimeDatabaseUrl(access: DatabaseAccess, env: Environment = process.env) {
  if (!isHostedDeployment(env)) return access === "editor" ?
    env.ADMIN_DATABASE_URL ?? env.DATABASE_URL : env.DATABASE_URL;
  if (getGiftDataSource(env) !== "postgres") throw new Error("Hosted servers require PostgreSQL.");
  const publicUrl = env.DATABASE_URL;
  const editorUrl = env.ADMIN_DATABASE_URL;
  if (!publicUrl || !editorUrl) throw new Error("Separate public and editor connections are required.");
  const parsed = [publicUrl, editorUrl].map((value) => new URL(value));
  if (decodeURIComponent(parsed[0].username) === decodeURIComponent(parsed[1].username)) {
    throw new Error("Runtime database users must be different.");
  }
  for (const url of parsed) {
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.password) {
      throw new Error("Invalid runtime database connection.");
    }
    const allowedParameters = new Set(["sslmode"]);
    for (const key of url.searchParams.keys()) {
      if (!allowedParameters.has(key) || url.searchParams.getAll(key).length !== 1) {
        throw new Error("Ambiguous or unsupported database connection option.");
      }
    }
    if (!loopbackHost(url.hostname) || env.APP_DEPLOYMENT !== "preview") {
      if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) {
        throw new Error("Remote database connections require TLS.");
      }
    }
    if (url.hostname !== parsed[0].hostname || url.port !== parsed[0].port || url.pathname !== parsed[0].pathname) {
      throw new Error("Runtime roles must connect to the same database endpoint.");
    }
  }
  if (env.MIGRATION_DATABASE_URL) throw new Error("Migration credentials must not be available to the server.");
  return access === "editor" ? editorUrl : publicUrl;
}

export function assertOwnerDeployment(env: Environment = process.env) {
  if (!isHostedDeployment(env)) return;
  configuredAdminOrigin(env);
  runtimeDatabaseUrl("editor", env);
  if (!["x-real-ip", "cf-connecting-ip", "x-vercel-forwarded-for"].includes(env.ADMIN_CLIENT_IP_HEADER ?? "")) {
    throw new Error("Configure a trusted, ingress-overwritten client IP header.");
  }
}
