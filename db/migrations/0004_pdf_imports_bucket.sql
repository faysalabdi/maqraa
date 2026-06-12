-- Migration 0004 — direct-to-storage PDF uploads.
--
-- Vercel serverless functions reject request bodies over ~4.5 MB, so PDFs
-- can't travel through a server action. The browser now uploads straight to
-- this private Supabase Storage bucket, then hands the server just the path.
-- The server downloads with the service role, splits the PDF into chunks, and
-- deletes the object — uploads only live in the bucket for a few seconds.
--
-- Idempotent: safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdf_imports', 'pdf_imports', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Users may only touch objects inside their own uid/ folder.
drop policy if exists "pdf_imports_upload_own" on storage.objects;
create policy "pdf_imports_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pdf_imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pdf_imports_read_own" on storage.objects;
create policy "pdf_imports_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pdf_imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pdf_imports_delete_own" on storage.objects;
create policy "pdf_imports_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pdf_imports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
