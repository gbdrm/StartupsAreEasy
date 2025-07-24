-- fix-startup-members-rls.sql

BEGIN;

-- Helper function to check if a user is a founder or co‑founder of a startup
CREATE OR REPLACE FUNCTION is_startup_founder(p_startup_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
      FROM startup_members
     WHERE startup_id = p_startup_id
       AND user_id    = p_user_id
       AND is_active  = true
       AND role IN ('founder', 'co-founder')
  );
$$;

-- Allow policies to call the function
GRANT EXECUTE ON FUNCTION is_startup_founder(uuid, uuid) TO PUBLIC;

-- Replace the original policy that caused recursion
DROP POLICY IF EXISTS "Startup founders can manage members" ON startup_members;

CREATE POLICY "Startup founders can manage members" ON startup_members
  FOR ALL USING (
    is_startup_founder(startup_members.startup_id, auth.uid())
  );

COMMIT;
