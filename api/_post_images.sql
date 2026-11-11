-- Public bucket for images used in blog posts (run once in the Supabase SQL editor).
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Anyone with the anon key can upload images (the write page is behind the gate, not auth).
create policy "post images upload" on storage.objects
  for insert to anon with check (bucket_id = 'post-images');
