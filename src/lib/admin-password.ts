import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashOwnerPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyOwnerPassword(password: string, hash: string) {
  if (!password || password.length > 256 || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) return false;
  const [, salt, storedKey] = hash.split(":");
  const key = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(storedKey, "hex"));
}

export function ownerCredentialVersion(hash: string) {
  return createHash("sha256").update(hash).digest("hex");
}
