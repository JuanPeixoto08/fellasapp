// Só no `npm run dev`: a mesa roda em outra porta (5173), fora da origem do app, então não herda a sessão.
// Um formulário mínimo entra com e-mail e senha de um fella. Nunca entra no build de produção.
import { supabase } from './supabase';

export async function devLogin(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const form = document.createElement('form');
  form.style.cssText =
    'position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;background:#08100b;color:#F4F1EA;font:16px system-ui';
  form.innerHTML = `<b>Login de teste (dev)</b>
    <input name="email" type="email" placeholder="e-mail" required style="padding:10px;width:260px">
    <input name="password" type="password" placeholder="senha" required style="padding:10px;width:260px">
    <button style="padding:10px 24px">Entrar</button><small></small>`;
  document.body.append(form);
  await new Promise<void>((done) => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      const { error } = await supabase.auth.signInWithPassword({
        email: String(f.get('email')),
        password: String(f.get('password')),
      });
      if (error) {
        form.querySelector('small')!.textContent = error.message;
        return;
      }
      form.remove();
      done();
    });
  });
}
