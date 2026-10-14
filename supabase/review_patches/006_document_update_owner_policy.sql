-- Totus Central / STAGING ONLY, 2026-10-14.
-- Applied to project awmojepsasikxocoeqtu using migration
-- scope_document_updates_to_uploader_20261014.
-- Previously, any team member could modify every document.
-- Now admins/managers can edit documents; team users can edit only their own uploads.
-- SELECT / INSERT / DELETE policies are unchanged; zero documents at migration time.
ALTER POLICY ops_documents_update ON public.ops_documents
 USING (private.is_manager() OR (private.is_team_member() AND uploaded_by = (select auth.uid())))
 WITH CHECK (private.is_manager() OR (private.is_team_member() AND uploaded_by = (select auth.uid())));
-- Verified by read-only pg_policies after applying migration.
-- NOTE: full per-module, configurable RBAC remains a separate requirement.
