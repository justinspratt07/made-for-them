import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { assertOwnerDeployment, isHostedDeployment, loopbackHost } from "./deployment-config";

export class ClientIdentityUnavailable extends Error {}

export function ownerClientKey(request: Request, env: Record<string, string | undefined> = process.env) {
  let identity: string;
  if (isHostedDeployment(env)) {
    assertOwnerDeployment(env);
    const header = env.ADMIN_CLIENT_IP_HEADER;
    const raw = header ? request.headers.get(header) : null;
    if (!raw || isIP(raw) === 0 || raw.includes("%")) {
      throw new ClientIdentityUnavailable("Trusted client identity is unavailable.");
    }
    const address = ipaddr.parse(raw);
    identity = address.kind() === "ipv6" && (address as ipaddr.IPv6).isIPv4MappedAddress() ?
      (address as ipaddr.IPv6).toIPv4Address().toString() : address.toString();
  } else {
    const url = new URL(request.url);
    let host: URL;
    try { host = new URL(`${url.protocol}//${request.headers.get("host") ?? url.host}`); }
    catch { throw new ClientIdentityUnavailable("Local owner access requires loopback."); }
    if (!loopbackHost(url.hostname) || !loopbackHost(host.hostname)) {
      throw new ClientIdentityUnavailable("Local owner access requires loopback.");
    }
    // The local server is bound to loopback; arbitrary forwarded headers are ignored.
    identity = "local-loopback";
  }
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new ClientIdentityUnavailable("Owner access is not configured.");
  return createHmac("sha256", secret).update(`owner-login:${identity}`).digest("hex");
}
