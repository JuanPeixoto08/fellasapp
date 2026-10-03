-- Exemplo: emails convidados (grupo fechado). Troque pelos emails reais.
-- Sempre em minusculas.
insert into public.allowed_emails (email) values
  ('amigo@example.com')
on conflict (email) do nothing;
