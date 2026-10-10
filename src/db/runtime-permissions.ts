import { sql } from "drizzle-orm";
import { queryRows, type GiftDatabase } from "./connection";
import type { DatabaseAccess } from "../lib/deployment-config";

export async function verifyRuntimePermissions(db: GiftDatabase, access: DatabaseAccess) {
  const result = await db.execute(sql`
    select
      current_user = session_user as actual_login,
      not exists (select 1 from pg_roles r where pg_has_role(session_user, r.oid, 'MEMBER')
        and r.rolname not in (session_user, ${access === "public" ? "mft_public" : "mft_editor"})) as isolated_role,
      not exists (
        select 1 from pg_roles r where pg_has_role(current_user, r.oid, 'MEMBER') and
          (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolreplication)
      ) as unprivileged,
      not has_schema_privilege(current_user, 'public', 'CREATE') as no_ddl,
      not has_schema_privilege(current_user, 'app_private', 'CREATE') as no_private_ddl,
      (select not has_table_privilege(current_user, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        from pg_class c join pg_namespace n on c.relnamespace = n.oid
        where n.nspname = 'app_private' and c.relname = 'owner_login_attempts') as private_counter,
      pg_has_role(current_user, ${access === "public" ? "mft_public" : "mft_editor"}, 'USAGE') as correct_group,
      pg_has_role(current_user, 'mft_editor', 'MEMBER') as editor_member,
      not exists (
        select 1 from pg_class c join pg_namespace n on c.relnamespace = n.oid
        where n.nspname in ('public', 'app_private') and c.relname in
          ('gift_ideas', 'gift_crafts', 'gift_items', 'owner_login_attempts') and
          (not c.relrowsecurity or pg_has_role(current_user, c.relowner, 'MEMBER'))
      ) as rls_enforced,
      not has_table_privilege(current_user, 'public.gift_ideas', 'DELETE,TRUNCATE,REFERENCES,TRIGGER') as no_parent_delete,
      (select has_function_privilege(current_user, p.oid, 'EXECUTE') from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'app_private'
        and p.proname = 'take_login_attempt' and p.pronargs = 1) as can_limit,
      (select has_function_privilege(current_user, p.oid, 'EXECUTE') from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'app_private'
        and p.proname = 'reset_login_attempts' and p.pronargs = 1) as can_reset
  `);
  const row = queryRows<Record<string, boolean>>(result)[0];
  if (!row || !row.actual_login || !row.isolated_role || !row.unprivileged || !row.no_ddl || !row.no_private_ddl || !row.private_counter || !row.correct_group || !row.rls_enforced ||
      !row.no_parent_delete || (access === "public" ? row.editor_member || row.can_limit || row.can_reset :
        !row.can_limit || !row.can_reset)) {
    throw new Error("Runtime database permissions are unsafe or incomplete.");
  }
  for (const table of ["gift_ideas", "gift_crafts", "gift_items"]) {
    const permissions = await db.execute(sql`
      select has_table_privilege(current_user, ${`public.${table}`}, 'SELECT') as readable,
        has_table_privilege(current_user, ${`public.${table}`}, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as writable,
        has_table_privilege(current_user, ${`public.${table}`}, 'INSERT') and
        has_table_privilege(current_user, ${`public.${table}`}, 'UPDATE') as editable,
        has_table_privilege(current_user, ${`public.${table}`}, 'DELETE') as can_delete
    `);
    const permission = queryRows<Record<string, boolean>>(permissions)[0];
    if (!permission?.readable || (access === "public" ? permission.writable :
      !permission.editable || (table !== "gift_ideas" && !permission.can_delete))) {
      throw new Error("Runtime database permissions are unsafe or incomplete.");
    }
  }
  const policies = queryRows<{ table: string; name: string; expression: string; roles: string[]; restrictive: boolean }>(await db.execute(sql`
    select c.relname as table, p.polname as name, pg_get_expr(p.polqual, p.polrelid) as expression,
      array(select r.rolname::text from pg_roles r where r.oid = any(p.polroles)) as roles,
      not p.polpermissive as restrictive
    from pg_policy p join pg_class c on p.polrelid = c.oid join pg_namespace n on c.relnamespace = n.oid
    where n.nspname = 'public' and c.relname in ('gift_ideas', 'gift_crafts', 'gift_items') and p.polcmd = 'r'
  `));
  for (const [table, name] of [["gift_ideas", "gift_public_guard"], ["gift_crafts", "crafts_public_guard"],
    ["gift_items", "items_public_guard"]]) {
    const guard = policies.find((policy) => policy.table === table && policy.name === name);
    const expression = table === "gift_ideas" ? "published" :
      `(EXISTS ( SELECT 1 FROM gift_ideas g WHERE ((g.id = ${table}.gift_id) AND g.published)))`;
    if (!guard?.restrictive || guard.roles.length !== 1 || guard.roles[0] !== "mft_public" ||
        guard.expression.replace(/\s+/g, " ").trim() !== expression) {
      throw new Error("Published-only database policies are missing or changed.");
    }
  }
}
