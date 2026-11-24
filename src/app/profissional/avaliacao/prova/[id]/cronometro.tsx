'use client';

import { useEffect, useState } from 'react';

/** Contagem regressiva; ao zerar, envia o formulário da prova. */
export function Cronometro({ expiraEm, formId }: { expiraEm: string; formId: string }) {
  const fim = new Date(expiraEm).getTime();
  const [restante, setRestante] = useState(() => Math.max(0, fim - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, fim - Date.now());
      setRestante(r);
      if (r === 0) {
        clearInterval(t);
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fim, formId]);

  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  const alerta = restante < 5 * 60000;
  return (
    <span
      role="timer"
      aria-live="off"
      className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${alerta ? 'bg-vermelho-claro text-vermelho' : 'bg-black/5'}`}
    >
      {String(min).padStart(2, '0')}:{String(seg).padStart(2, '0')}
    </span>
  );
}
