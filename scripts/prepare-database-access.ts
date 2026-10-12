import { loadEnvConfig } from "@next/env";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, openSync, writeFileSync } from "node:fs";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDatabaseConnection, queryRows, type GiftDatabase } from "../src/db/connection";
import { readGiftRecords } from "../src/db/gift-repository";
import { verifyRuntimePermissions } from "../src/db/runtime-permissions";

loadEnvConfig(process.cwd(), true);

function run(executable: string, args: string[], env: NodeJS.ProcessEnv, input?: string) {
  // pg_ctl's detached Windows server can retain pipe handles after pg_ctl exits.
  const detached = path.basename(executable) === "pg_ctl.exe" && args.includes("start");
  const descriptor = detached ? openSync(path.join(process.env.DATABASE_PREPARATION_DIRECTORY!, "local-control.log"), "a", 0o600) : undefined;
  const result = spawnSync(executable, args, { env, input, encoding: "utf8", windowsHide: true, timeout: 120_000,
    ...(descriptor === undefined ? {} : { stdio: ["ignore", descriptor, descriptor] as const }) });
  if (descriptor !== undefined) closeSync(descriptor);
  if (result.error || result.status !== 0) {
    if (process.env.DATABASE_PREPARATION_DIRECTORY) {
      writeFileSync(path.join(process.env.DATABASE_PREPARATION_DIRECTORY, "maintenance-error.private.json"),
        JSON.stringify({ tool: path.basename(executable), status: result.status, stderr: result.stderr,
          error: (result.error as NodeJS.ErrnoException | undefined)?.code }), { mode: 0o600 });
    }
    throw new Error(`Maintenance tool failed: ${path.basename(executable)}`);
  }
  return result.stdout ?? "";
}

function connectionEnvironment(url: URL): NodeJS.ProcessEnv {
  const base = { ...process.env };
  for (const key of Object.keys(base)) if (key.startsWith("PG")) delete base[key];
  return { ...base,
    PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require", PGCONNECT_TIMEOUT: "15" };
}

async function fingerprint(db: GiftDatabase) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local time zone 'UTC'`);
    const queries = [
      sql`select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as data from public.gift_ideas t`,
      sql`select coalesce(jsonb_agg(to_jsonb(t) order by t.gift_id, t.position), '[]'::jsonb) as data from public.gift_crafts t`,
      sql`select coalesce(jsonb_agg(to_jsonb(t) order by t.gift_id, t.kind, t.position), '[]'::jsonb) as data from public.gift_items t`,
    ];
    const rows = [];
    for (const query of queries) rows.push(queryRows<{ data: unknown }>(await tx.execute(query))[0].data);
    return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }, { accessMode: "read only", isolationLevel: "repeatable read" });
}

async function main() {
  if (process.platform !== "win32" || !process.argv.includes("--apply")) {
    throw new Error("Explicit Windows maintenance approval is required.");
  }
  const bin = process.env.POSTGRES_TOOL_DIRECTORY;
  const destination = process.env.DATABASE_PREPARATION_DIRECTORY;
  const source = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!bin || !destination || !source || process.env.GIFT_DATA_SOURCE !== "postgres") throw new Error("Maintenance settings missing.");
  const origin = new URL(source);
  if (!origin.hostname.endsWith(".supabase.com") && !origin.hostname.endsWith(".supabase.co")) throw new Error("Expected Supabase target.");
  if (!["require", "verify-ca", "verify-full"].includes(origin.searchParams.get("sslmode") ?? "")) throw new Error("TLS required.");
  if (origin.hostname.endsWith(".pooler.supabase.com") && origin.port !== "5432") throw new Error("Use the session pooler for maintenance.");
  await mkdir(destination, { mode: 0o700 });
  const folder = await realpath(destination);
  const repository = await realpath(process.cwd());
  const relative = path.relative(repository, folder);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error("Keep private backups outside the repository.");
  const currentSid = run("powershell.exe", ["-NoProfile", "-Command", "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"], process.env).trim();
  run("icacls.exe", [folder, "/inheritance:r", "/grant:r", `*${currentSid}:(OI)(CI)F`, "/grant:r", "*S-1-5-18:(OI)(CI)F"], process.env);
  const file = (name: string) => path.join(folder, name);
  const tool = (name: string) => path.join(bin, `${name}.exe`);
  const localPassword = randomBytes(32).toString("hex");
  const localUrl = new URL(`postgresql://postgres:${localPassword}@127.0.0.1:15432/mft_backup_rehearsal?sslmode=disable`);
  const localEnv = connectionEnvironment(localUrl);
  const live = await createDatabaseConnection("postgres", { url: source });
  let local: Awaited<ReturnType<typeof createDatabaseConnection>> | undefined;
  let serverStarted = false;
  let phase = "preflight";
  try {
    const tables = queryRows<{ tablename: string }>(await live.db.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`));
    if (JSON.stringify(tables.map((table) => table.tablename)) !== JSON.stringify(["gift_crafts", "gift_ideas", "gift_items"])) throw new Error("Unexpected application tables.");
    const existing = queryRows(await live.db.execute(sql`select rolname from pg_roles where rolname in ('mft_public', 'mft_editor', 'mft_reader', 'mft_owner_editor')`));
    if (existing.length) throw new Error("Existing roles require separate verification, not password replacement.");
    const before = await fingerprint(live.db);
    const recordsBefore = await readGiftRecords(live.db, true);
    const target = createHash("sha256").update(`${origin.hostname}:${origin.port}${origin.pathname}`).digest("hex");
    console.log(`Confirmed dedicated application target with ${recordsBefore.length} gift records.`);

    phase = "backup";
    run(tool("pg_dump"), ["--format=custom", "--schema=public", "--schema=drizzle", "--no-password", `--file=${file("application.dump")}`], connectionEnvironment(origin));
    run(tool("pg_restore"), ["--list", file("application.dump")], localEnv);
    const backup = await readFile(file("application.dump"));
    const backupHash = createHash("sha256").update(backup).digest("hex");

    phase = "restore rehearsal";
    await writeFile(file("local-password.txt"), `${localPassword}\n`, { flag: "wx", mode: 0o600 });
    run(tool("initdb"), ["-D", file("local-cluster"), "-U", "postgres", "--auth=scram-sha-256", `--pwfile=${file("local-password.txt")}`, "--encoding=UTF8", "--no-locale"], localEnv);
    run(tool("pg_ctl"), ["-D", file("local-cluster"), "-l", file("local-server.log"), "-o", "-h 127.0.0.1 -p 15432", "-w", "start"], localEnv);
    serverStarted = true;
    run(tool("createdb"), ["--no-password", "--maintenance-db=postgres", "mft_backup_rehearsal"], { ...localEnv, PGDATABASE: "postgres" });
    run(tool("pg_restore"), ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", "--no-password", "--dbname=mft_backup_rehearsal", file("application.dump")], localEnv);
    local = await createDatabaseConnection("postgres", { url: localUrl.href });
    if (await fingerprint(local.db) !== before || await fingerprint(live.db) !== before) throw new Error("Backup fingerprint mismatch or live library changed.");
    console.log("Application backup restored successfully; all rows, timestamps, and ordered content match.");

    phase = "protect backup";
    const protectedBackup = run("powershell.exe", ["-NoProfile", "-Command",
      "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Convert]::FromBase64String([Console]::In.ReadToEnd()), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))"], process.env, backup.toString("base64")).trim();
    await writeFile(file("application.dump.dpapi"), Buffer.from(protectedBackup, "base64"), { flag: "wx", mode: 0o600 });
    const decryptedBackup = run("powershell.exe", ["-NoProfile", "-Command",
      "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String([Console]::In.ReadToEnd()), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))"], process.env, protectedBackup).trim();
    if (createHash("sha256").update(Buffer.from(decryptedBackup, "base64")).digest("hex") !== backupHash) {
      throw new Error("Encrypted backup recovery did not match.");
    }
    await writeFile(file("backup-receipt.json"), JSON.stringify({ createdAt: new Date().toISOString(), target, backupHash, dataFingerprint: before,
      giftCount: recordsBefore.length, schemas: ["public", "drizzle"], restoredDataVerified: true, originalOwnerAclRestorationVerified: false,
      protection: "Windows CurrentUser DPAPI; requires this Windows account for recovery", state: "backup-verified" }, null, 2), { flag: "wx", mode: 0o600 });

    phase = "local migration and account validation";
    await local.migrate();
    const readerPassword = randomBytes(32).toString("hex"), editorPassword = randomBytes(32).toString("hex");
    await local.db.execute(sql`create role mft_reader login`);
    await local.db.execute(sql`create role mft_owner_editor login`);
    await local.db.execute(sql`grant mft_public to mft_reader`);
    await local.db.execute(sql`grant mft_editor to mft_owner_editor`);
    // Local PostgreSQL creates SCRAM verifiers; plaintext passwords never enter live DDL.
    for (const [role, password] of [["mft_reader", readerPassword], ["mft_owner_editor", editorPassword]]) {
      if (!/^[a-f0-9]{64}$/.test(password)) throw new Error("Invalid generated password.");
      await local.db.execute(sql.raw(`ALTER ROLE ${role} PASSWORD '${password}'`));
    }
    const verifiers = queryRows<{ rolname: string; rolpassword: string }>(await local.db.execute(sql`select rolname, rolpassword from pg_authid where rolname in ('mft_reader', 'mft_owner_editor')`));
    if (verifiers.length !== 2 || verifiers.some((role) => !/^SCRAM-SHA-256\$[0-9]+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(role.rolpassword))) throw new Error("SCRAM preparation failed.");
    for (const [access, user, password] of [["public", "mft_reader", readerPassword], ["editor", "mft_owner_editor", editorPassword]] as const) {
      const url = new URL(localUrl); url.username = user; url.password = password;
      const connection = await createDatabaseConnection("postgres", { url: url.href });
      try { await verifyRuntimePermissions(connection.db, access); } finally { await connection.close(); }
    }
    if (await fingerprint(local.db) !== before) throw new Error("Local migration changed library content.");

    phase = "save pending private settings";
    const runtimeUrl = (user: string, password: string) => {
      const url = new URL(origin);
      const oldUser = decodeURIComponent(url.username);
      const suffix = origin.hostname.endsWith(".pooler.supabase.com") ? oldUser.slice(oldUser.indexOf(".")) : "";
      if (suffix && !/^\.[a-z0-9]{10,32}$/.test(suffix)) throw new Error("Invalid pooler project identifier.");
      url.username = `${user}${suffix}`; url.password = password;
      return url.href;
    };
    const readerUrl = runtimeUrl("mft_reader", readerPassword), editorUrl = runtimeUrl("mft_owner_editor", editorPassword);
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash ?? "")) throw new Error("Owner password configuration missing.");
    const privateSettings = `DATABASE_URL=${readerUrl}\nADMIN_DATABASE_URL=${editorUrl}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_SESSION_SECRET=${randomBytes(48).toString("hex")}\n`;
    await writeFile(file("render-runtime.pending.env"), privateSettings, { flag: "wx", mode: 0o600 });

    phase = "live permission migration";
    if (await fingerprint(live.db) !== before) throw new Error("Live library changed; take a new backup.");
    await live.migrate();
    phase = "live account provisioning";
    await live.db.transaction(async (tx) => {
      for (const role of verifiers) {
        if (!["mft_reader", "mft_owner_editor"].includes(role.rolname)) throw new Error("Invalid role.");
        await tx.execute(sql.raw(`CREATE ROLE ${role.rolname} LOGIN PASSWORD '${role.rolpassword}'`));
      }
      await tx.execute(sql`grant mft_public to mft_reader`);
      await tx.execute(sql`grant mft_editor to mft_owner_editor`);
    });

    phase = "live restricted-account verification";
    for (const [access, url] of [["public", readerUrl], ["editor", editorUrl]] as const) {
      const connection = await createDatabaseConnection("postgres", { url });
      try {
        await verifyRuntimePermissions(connection.db, access);
        const records = await readGiftRecords(connection.db, access === "editor");
        const expected = access === "public" ? recordsBefore.filter((record) => record.published).length : recordsBefore.length;
        if (records.length !== expected) throw new Error("Runtime library count mismatch.");
      } finally { await connection.close(); }
    }
    if (await fingerprint(live.db) !== before) throw new Error("Live library content changed.");
    await writeFile(file("render-runtime.env"), privateSettings, { flag: "wx", mode: 0o600 });
    await unlink(file("render-runtime.pending.env"));
    await unlink(file("application.dump"));
    await writeFile(file("preparation-result.json"), JSON.stringify({ completedAt: new Date().toISOString(), target,
      dataPreserved: true, giftCount: recordsBefore.length, verifiedRuntimeAccounts: ["mft_reader", "mft_owner_editor"],
      settingsFile: "render-runtime.env", backupFile: "application.dump.dpapi" }, null, 2), { flag: "wx", mode: 0o600 });
    console.log(`Prepared and verified separate reader/editor accounts; ${recordsBefore.length} gifts preserved.`);
    console.log(`Private settings file: ${file("render-runtime.env")}`);
  } catch {
    console.error(`Database preparation stopped during ${phase}. No private values were logged; do not use pending settings.`);
    process.exitCode = 1;
  } finally {
    await local?.close();
    if (serverStarted) run(tool("pg_ctl"), ["-D", file("local-cluster"), "-m", "fast", "-w", "stop"], localEnv);
    await live.close();
  }
}
main().catch(() => { console.error("Database preparation could not start. Check the private maintenance paths and settings."); process.exitCode = 1; });
