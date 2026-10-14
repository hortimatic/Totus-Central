-- Totus Central · STAGING ONLY · 2026-10-14
-- Migration: restrict_business_document_storage_overwrites_20261014
-- Supabase project: awmojepsasikxocoeqtu
-- Preflight: no storage.objects rows in business-documents or business-assets.
-- A RESTRICTIVE UPDATE policy is AND-ed with existing permissive policies;
-- it limits overwrites of business documents to their uploader or management.
-- Updates to other buckets are not restricted by this condition.
CREATE POLICY totus_business_docs_owner_update_restrict
 ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (
   bucket_id <> 'business-documents' OR private.is_manager()
   OR (private.is_team_member() AND owner_id = (select auth.uid())::text)
 )
 WITH CHECK (
   bucket_id <> 'business-documents' OR private.is_manager()
   OR (private.is_team_member() AND owner_id = (select auth.uid())::text)
 );
-- Verified through pg_policies: permissive='RESTRICTIVE', cmd='UPDATE'.
-- Remaining work: authenticated upload/edit E2E tests for all three roles.
