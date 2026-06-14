-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002 — delete_user() RPC + analytics_events RLS
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP IF EXISTS
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. analytics_events: enable RLS ──────────────────────────────────────────
-- This table was written to by the app but had no RLS, meaning any authenticated
-- user could SELECT all events from all users.

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;


-- ── 2. analytics_events: drop legacy policies (idempotent clean slate) ────────

DROP POLICY IF EXISTS "analytics_insert"   ON analytics_events;
DROP POLICY IF EXISTS "analytics_insert_auth" ON analytics_events;
DROP POLICY IF EXISTS "analytics_insert_anon" ON analytics_events;
DROP POLICY IF EXISTS "analytics_select"   ON analytics_events;
DROP POLICY IF EXISTS "analytics_update"   ON analytics_events;
DROP POLICY IF EXISTS "analytics_delete"   ON analytics_events;


-- ── 3. analytics_events: scoped INSERT policies ───────────────────────────────
-- Authenticated users may insert rows with their own user_id.
-- Anon users (pre-login events) may insert rows with a null user_id only.
-- Neither may insert a row claiming another user's user_id.

CREATE POLICY "analytics_insert_auth" ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analytics_insert_anon" ON analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);


-- ── 4. analytics_events: SELECT restricted to own rows ───────────────────────
-- Each authenticated user can only read their own events.
-- Anon users cannot read any events.

CREATE POLICY "analytics_select" ON analytics_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- No UPDATE or DELETE policies for analytics_events from the client —
-- deletion is handled exclusively by the delete_user() SECURITY DEFINER function.


-- ── 5. delete_user() RPC ─────────────────────────────────────────────────────
-- Called by the app via supabase.rpc('delete_user') when the user taps
-- "Delete Account". Removes all user-owned rows across every app table, then
-- deletes the auth.users record.
--
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS so
-- it can delete from all tables and from auth.users even though the calling
-- user's role (authenticated) cannot directly delete auth rows.
--
-- SET search_path = public: prevents search_path injection attacks.
--
-- REVOKE / GRANT: only authenticated users may call this — not anon.

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_id uuid;
BEGIN
  -- Capture the caller's UID before any deletions.
  calling_user_id := auth.uid();

  -- Guard: only allow authenticated callers.
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_user: caller is not authenticated';
  END IF;

  -- Delete all user-owned rows in application tables.
  -- Order: most expendable data first; auth record last.
  DELETE FROM analytics_events WHERE user_id = calling_user_id;
  DELETE FROM analyses          WHERE user_id = calling_user_id;
  DELETE FROM usage_counts      WHERE user_id = calling_user_id;
  DELETE FROM journey           WHERE user_id = calling_user_id;
  DELETE FROM vault             WHERE user_id = calling_user_id;

  -- Delete the auth record. This invalidates all existing JWTs for this user.
  DELETE FROM auth.users WHERE id = calling_user_id;
END;
$$;

-- Restrict execution: only authenticated users may call this function.
-- Revoke from public first (default grants), then grant explicitly.
REVOKE ALL ON FUNCTION delete_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION delete_user() TO authenticated;


-- ── 6. Verify RLS state ───────────────────────────────────────────────────────
-- Run this SELECT after applying to confirm all 5 tables have RLS enabled.
-- Expected: 5 rows, all with rowsecurity = true.

SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('vault', 'journey', 'usage_counts', 'analyses', 'analytics_events')
ORDER BY tablename;


-- ── 7. Verify analytics_events policies ──────────────────────────────────────
-- Expected: 3 rows (analytics_insert_auth, analytics_insert_anon, analytics_select).

SELECT
  policyname,
  roles,
  cmd,
  qual       AS using_expr,
  with_check AS check_expr
FROM pg_policies
WHERE tablename = 'analytics_events'
ORDER BY policyname;


-- ── 8. Verify delete_user function exists ────────────────────────────────────
-- Expected: 1 row with security_type = 'definer' and grantee = 'authenticated'.

SELECT
  p.proname,
  p.prosecdef AS security_definer,
  acl.grantee::regrole AS grantee,
  acl.privilege_type
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(p.proacl) AS acl
WHERE p.proname = 'delete_user'
  AND p.pronamespace = 'public'::regnamespace;
