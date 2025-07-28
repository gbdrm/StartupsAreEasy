-- ===================================================================
-- PRODUCTION DATABASE RECREATION SCRIPT
-- ===================================================================
-- Run this directly in your Supabase SQL Editor
-- WARNING: This will delete ALL data in your production database!

-- First, backup any important data before running this script

-- ===================================================================
-- 1. DROP ALL TABLES (in reverse dependency order)
-- ===================================================================

-- Drop views first
DROP VIEW IF EXISTS user_startup_summary CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS startups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop any remaining functions
DROP FUNCTION IF EXISTS get_posts_with_details(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_slug_from_name() CASCADE;

-- Continue with the rest of the script from 00-recreate-database.sql...
-- (Copy the entire content from "CREATE TABLES FROM SCRATCH" section onwards)
