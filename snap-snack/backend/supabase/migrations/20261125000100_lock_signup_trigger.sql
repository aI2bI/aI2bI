-- The sign-up trigger function is only for the database itself, never callable through the API.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
comment on table public.wearable_tokens is 'OAuth tokens for wearable providers. No RLS policies on purpose: only server functions (service role) may read or write.';
