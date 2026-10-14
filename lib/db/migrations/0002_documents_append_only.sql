-- documents is append-only (SPEC §5.1 audit trail): a regeneration inserts a new version,
-- nothing edits or removes an old one. Any future erasure must be a deliberate migration
-- that drops these triggers first (CLAUDE.md §0 rule 3 — hard to undo, goes to Esteban).
CREATE FUNCTION documents_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'documents is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER documents_no_update_delete
  BEFORE UPDATE OR DELETE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION documents_append_only();--> statement-breakpoint
CREATE TRIGGER documents_no_truncate
  BEFORE TRUNCATE ON "documents"
  FOR EACH STATEMENT EXECUTE FUNCTION documents_append_only();
