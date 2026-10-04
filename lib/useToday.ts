import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "Hoje" que vira sozinho à meia-noite (aniversários com a aba aberta de um dia para o outro).
 * Ao voltar para o app também confere: o navegador segura timers de abas em segundo plano.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setToday(new Date()), nextMidnight.getTime() - now.getTime() + 1000);
    return () => clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setToday((cur) => {
        const now = new Date();
        return sameDay(cur, now) ? cur : now;
      });
    });
    return () => sub.remove();
  }, []);

  return today;
}
