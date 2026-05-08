-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 001 — RLS policies + analyses.updated_at
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run: all statements are idempotent
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix analyses schema ────────────────────────────────────────────────────
-- pushAnalysis() sends updated_at; this column was missing, causing silent 400s.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Reload PostgREST schema cache so the new column is immediately visible.
NOTIFY pgrst, 'reload schema';


-- ── 2. Ensure RLS is enabled on all four tables ───────────────────────────────

ALTER TABLE vault         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses      ENABLE ROW LEVEL SECURITY;


-- ── 3. Drop all existing policies (clean slate) ───────────────────────────────
-- Prevents duplicate-policy errors and replaces any overly-broad legacy policies.

DROP POLICY IF EXISTS "vault_select"       ON vault;
DROP POLICY IF EXISTS "vault_insert"       ON vault;
DROP POLICY IF EXISTS "vault_update"       ON vault;
DROP POLICY IF EXISTS "vault_delete"       ON vault;

DROP POLICY IF EXISTS "journey_select"     ON journey;
DROP POLICY IF EXISTS "journey_insert"     ON journey;
DROP POLICY IF EXISTS "journey_update"     ON journey;
DROP POLICY IF EXISTS "journey_delete"     ON journey;

DROP POLICY IF EXISTS "usage_select"       ON usage_counts;
DROP POLICY IF EXISTS "usage_insert"       ON usage_counts;
DROP POLICY IF EXISTS "usage_update"       ON usage_counts;
DROP POLICY IF EXISTS "usage_delete"       ON usage_counts;

DROP POLICY IF EXISTS "analyses_select"    ON analyses;
DROP POLICY IF EXISTS "analyses_insert"    ON analyses;
DROP POLICY IF EXISTS "analyses_update"    ON analyses;
DROP POLICY IF EXISTS "analyses_delete"    ON analyses;


-- ── 4. Create scoped policies ─────────────────────────────────────────────────
-- Rules:
--   • Only the `authenticated` role — anon users get nothing.
--   • USING (user_id = auth.uid()) — rows filtered server-side on read/update/delete.
--   • WITH CHECK (user_id = auth.uid()) on INSERT/UPDATE — prevents a user from
--     inserting a row claiming to belong to another user_id.

-- ▸ vault ─────────────────────────────────────────────────────────────────────

CREATE POLICY "vault_select" ON vault
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "vault_insert" ON vault
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vault_update" ON vault
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vault_delete" ON vault
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ▸ journey ───────────────────────────────────────────────────────────────────

CREATE POLICY "journey_select" ON journey
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "journey_insert" ON journey
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "journey_update" ON journey
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "journey_delete" ON journey
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ▸ usage_counts ──────────────────────────────────────────────────────────────

CREATE POLICY "usage_select" ON usage_counts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usage_insert" ON usage_counts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usage_update" ON usage_counts
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usage_delete" ON usage_counts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ▸ analyses ──────────────────────────────────────────────────────────────────

CREATE POLICY "analyses_select" ON analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "analyses_insert" ON analyses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_update" ON analyses
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_delete" ON analyses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ── 5. Verify — run this SELECT after applying to confirm 16 rows ────────────

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual       AS using_expr,
  with_check AS check_expr
FROM pg_policies
WHERE tablename IN ('vault', 'journey', 'usage_counts', 'analyses')
ORDER BY tablename, cmd;

-- Expected: 16 rows.
-- Every row must have:
--   roles       = {authenticated}
--   using_expr  = (user_id = auth.uid())   [for SELECT / UPDATE / DELETE]
--   check_expr  = (user_id = auth.uid())   [for INSERT / UPDATE]
