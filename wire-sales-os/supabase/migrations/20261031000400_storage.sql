-- WIRE Sales OS — private document storage.
--
-- Files live under `<workspace_id>/<company_id>/<file>` in the private
-- `documents` bucket; access is limited to members of that workspace.
-- Guarded so the migration is a no-op on Postgres instances without Supabase
-- Storage (e.g. plain Postgres used for CI).

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then

    insert into storage.buckets (id, name, public, file_size_limit)
    values ('documents', 'documents', false, 20971520)
    on conflict (id) do nothing;

    execute $p$
      create policy "documents_member_select" on storage.objects
        for select to authenticated
        using (bucket_id = 'documents' and public.is_workspace_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "documents_member_insert" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'documents' and public.is_workspace_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "documents_member_delete" on storage.objects
        for delete to authenticated
        using (bucket_id = 'documents' and public.is_workspace_member(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end;
$$;
