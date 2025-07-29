-- ===================================
-- REPLACE THE PROBLEMATIC TRIGGER FUNCTION
-- ===================================
-- This will replace the simple handle_new_user function with a robust one

-- Drop the existing function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a new, robust handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'handle_new_user trigger called for user: %', NEW.id;
  
  -- Insert into profiles with proper default values and conflict handling
  INSERT INTO public.profiles (
    id, 
    username, 
    first_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    -- Generate username from metadata or create a default one
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'first_name',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    -- Extract first_name from metadata if available
    NEW.raw_user_meta_data->>'first_name',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If profile already exists, update it with new metadata
    username = COALESCE(
      EXCLUDED.username,
      public.profiles.username
    ),
    first_name = COALESCE(
      EXCLUDED.first_name,
      public.profiles.first_name
    ),
    updated_at = NOW();
  
  RAISE LOG 'handle_new_user completed successfully for user: %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'handle_new_user failed for user %, error: %, detail: %', 
      NEW.id, SQLERRM, SQLSTATE;
    
    -- Try a minimal insert as fallback
    BEGIN
      INSERT INTO public.profiles (id, username, created_at, updated_at)
      VALUES (NEW.id, 'user_' || substr(NEW.id::text, 1, 8), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
      
      RAISE LOG 'handle_new_user fallback insert succeeded for user: %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'handle_new_user fallback also failed for user %: %', NEW.id, SQLERRM;
    END;
    
    -- Always return NEW to allow user creation to succeed
    RETURN NEW;
END;
$$;

-- Grant necessary permissions for the function to work
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================================
-- GRANT PROPER PERMISSIONS
-- ===================================

-- Ensure the trigger can insert into profiles table
-- This is crucial for the trigger to work properly
GRANT INSERT, UPDATE, SELECT ON public.profiles TO service_role;

-- ===================================
-- VERIFICATION
-- ===================================

-- Check if the new trigger is properly created
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check the new function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';
