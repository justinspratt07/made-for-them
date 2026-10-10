DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mft_public') THEN
    CREATE ROLE mft_public NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mft_editor') THEN
    CREATE ROLE mft_editor NOLOGIN;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('mft_public', 'mft_editor') AND
      (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
    RAISE EXCEPTION 'Runtime permission groups must be unprivileged NOLOGIN roles';
  END IF;
END $$;
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO mft_public, mft_editor;
--> statement-breakpoint
REVOKE ALL ON public.gift_ideas, public.gift_crafts, public.gift_items FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT ON public.gift_ideas, public.gift_crafts, public.gift_items TO mft_public, mft_editor;
--> statement-breakpoint
GRANT INSERT, UPDATE ON public.gift_ideas TO mft_editor;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.gift_crafts, public.gift_items TO mft_editor;
--> statement-breakpoint
CREATE POLICY gift_public_read ON public.gift_ideas FOR SELECT TO mft_public USING (published);
--> statement-breakpoint
CREATE POLICY gift_editor_access ON public.gift_ideas FOR ALL TO mft_editor USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY crafts_public_read ON public.gift_crafts FOR SELECT TO mft_public USING (
  EXISTS (SELECT 1 FROM public.gift_ideas g WHERE g.id = gift_id AND g.published)
);
--> statement-breakpoint
CREATE POLICY crafts_editor_access ON public.gift_crafts FOR ALL TO mft_editor USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY items_public_read ON public.gift_items FOR SELECT TO mft_public USING (
  EXISTS (SELECT 1 FROM public.gift_ideas g WHERE g.id = gift_id AND g.published)
);
--> statement-breakpoint
CREATE POLICY items_editor_access ON public.gift_items FOR ALL TO mft_editor USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY gift_public_guard ON public.gift_ideas AS RESTRICTIVE FOR SELECT TO mft_public USING (published);
--> statement-breakpoint
CREATE POLICY crafts_public_guard ON public.gift_crafts AS RESTRICTIVE FOR SELECT TO mft_public USING (
  EXISTS (SELECT 1 FROM public.gift_ideas g WHERE g.id = gift_id AND g.published)
);
--> statement-breakpoint
CREATE POLICY items_public_guard ON public.gift_items AS RESTRICTIVE FOR SELECT TO mft_public USING (
  EXISTS (SELECT 1 FROM public.gift_ideas g WHERE g.id = gift_id AND g.published)
);
--> statement-breakpoint
CREATE SCHEMA app_private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO mft_editor;
--> statement-breakpoint
CREATE TABLE app_private.owner_login_attempts (
  client_key text PRIMARY KEY CHECK (client_key ~ '^[a-f0-9]{64}$'),
  attempted_at timestamptz[] NOT NULL CHECK (cardinality(attempted_at) <= 10),
  expires_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX owner_login_expiry ON app_private.owner_login_attempts (expires_at);
--> statement-breakpoint
ALTER TABLE app_private.owner_login_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON app_private.owner_login_attempts FROM PUBLIC, mft_public, mft_editor;
--> statement-breakpoint
CREATE FUNCTION app_private.take_login_attempt(key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  current_time_value timestamptz := clock_timestamp();
  attempts timestamptz[];
BEGIN
  IF key IS NULL OR key !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid login client key';
  END IF;
  -- Bounded cleanup does not evict active counters or store raw IP addresses.
  DELETE FROM app_private.owner_login_attempts WHERE client_key IN (
    SELECT client_key FROM app_private.owner_login_attempts
    WHERE expires_at <= current_time_value ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
  );
  INSERT INTO app_private.owner_login_attempts (client_key, attempted_at, expires_at)
    VALUES (key, ARRAY[]::timestamptz[], current_time_value + interval '15 minutes')
    ON CONFLICT (client_key) DO NOTHING;
  SELECT attempted_at INTO attempts FROM app_private.owner_login_attempts WHERE client_key = key FOR UPDATE;
  current_time_value := clock_timestamp();
  SELECT coalesce(array_agg(value ORDER BY value), ARRAY[]::timestamptz[]) INTO attempts
    FROM unnest(attempts) value WHERE value > current_time_value - interval '15 minutes';
  IF cardinality(attempts) >= 10 THEN RETURN false; END IF;
  UPDATE app_private.owner_login_attempts SET attempted_at = array_append(attempts, current_time_value),
    expires_at = current_time_value + interval '15 minutes' WHERE client_key = key;
  RETURN true;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.take_login_attempt(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.take_login_attempt(text) TO mft_editor;
--> statement-breakpoint
CREATE FUNCTION app_private.reset_login_attempts(key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF key IS NULL OR key !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid login client key';
  END IF;
  DELETE FROM app_private.owner_login_attempts WHERE client_key = key;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.reset_login_attempts(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.reset_login_attempts(text) TO mft_editor;
