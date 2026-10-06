-- fellasapp: admin e link de convite de uso único. Idempotente.
-- 1) profiles.is_admin: quem gera convite. Fica fora do grant de update por coluna, então ninguém
--    se promove pelo app; o @oliveira já sai admin. Outro admin: só pelo SQL editor.
-- 2) invite_links: o admin gera um link (create_invite_link); quem abre digita o email
--    (redeem_invite, sem login): o email entra em allowed_emails e o link fica preso a ele.
--    Os triggers da 0001 fazem o resto: a conta nasce membro quando a pessoa pede o código.
-- (0012 e não 0011: a 0011 está reservada para os stories, ainda na branch feat/stories.)

alter table public.profiles add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true where username = 'oliveira';

-- security definer pelo mesmo motivo do is_member(): evita recursão de RLS em profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin and p.is_member from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Rascunho anterior desta migration (admin digitava o email): sai, se tiver sido aplicado.
drop policy if exists "allowed_emails_insert_admin" on public.allowed_emails;
drop function if exists public.list_invites();

-- ---------------------------------------------------------------- links

create table if not exists public.invite_links (
  token      text primary key,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_email text check (used_email = lower(used_email))
);

create index if not exists invite_links_created_at_idx on public.invite_links (created_at desc);

alter table public.invite_links enable row level security;

-- Só admin lê; escrita só pelas funções abaixo.
drop policy if exists "invite_links_select_admin" on public.invite_links;
create policy "invite_links_select_admin" on public.invite_links
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.invite_links from anon, authenticated;

-- Token de 32 caracteres hex (122 bits aleatórios): não dá pra chutar.
create or replace function public.create_invite_link()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  insert into public.invite_links (token, created_by) values (v_token, auth.uid());
  return v_token;
end;
$$;

revoke all on function public.create_invite_link() from public;
grant execute on function public.create_invite_link() to authenticated;

-- Chamada por quem abriu o link, ainda sem conta (anon). Erros pelo texto: invalid_email,
-- invite_not_found, invite_used, invite_expired. `for update` trava o link: dois envios ao mesmo
-- tempo não gastam o mesmo convite duas vezes.
create or replace function public.redeem_invite(p_token text, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_link  public.invite_links%rowtype;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  select * into v_link from public.invite_links where token = p_token for update;
  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_link.used_at is not null then
    -- a mesma pessoa abrindo o link de novo (fechou a aba antes do código): segue
    if v_link.used_email = v_email then
      return;
    end if;
    raise exception 'invite_used';
  end if;

  if v_link.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  -- já era convidado: só segue para o código, sem gastar o link
  if exists (select 1 from public.allowed_emails where email = v_email) then
    return;
  end if;

  insert into public.allowed_emails (email, invited_by) values (v_email, v_link.created_by);
  update public.invite_links set used_at = now(), used_email = v_email where token = p_token;
end;
$$;

revoke all on function public.redeem_invite(text, text) from public;
grant execute on function public.redeem_invite(text, text) to anon, authenticated;
