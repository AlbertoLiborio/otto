'use client';

import { useActionState } from 'react';
import { confirmarCadastroMfa, iniciarCadastroMfa, type EstadoCadastroMfa } from '../acoes';

const botao = 'inline-flex w-full items-center justify-center rounded-lg bg-tinta px-4 py-2 text-sm font-semibold text-white hover:bg-tinta-2 disabled:opacity-50';

export function CadastroMfa() {
  const [estado, gerar, gerando] = useActionState<EstadoCadastroMfa>(iniciarCadastroMfa, {});

  if (!estado.fatorId) {
    return (
      <form action={gerar} className="space-y-3">
        {estado.erro && <p className="rounded-lg bg-vermelho-claro px-4 py-3 text-sm text-vermelho">{estado.erro}</p>}
        <button className={botao} disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar QR Code'}</button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-tinta-2">
        <li>Abra o app autenticador no celular (Google Authenticator, Microsoft Authenticator ou Authy).</li>
        <li>Toque em adicionar e escaneie o QR Code abaixo.</li>
        <li>Digite o código de 6 dígitos que aparecer no app.</li>
      </ol>
      <div className="flex justify-center rounded-xl border border-linha bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={estado.qr} alt="QR Code para o app autenticador" width={200} height={200} />
      </div>
      <details className="text-xs text-suave">
        <summary className="cursor-pointer">Não consegue escanear? Digite a chave manualmente</summary>
        <code className="mt-2 block break-all rounded bg-papel p-2">{estado.segredo}</code>
      </details>
      <form action={confirmarCadastroMfa} className="space-y-3">
        <input type="hidden" name="fator_id" value={estado.fatorId} />
        <label className="block">
          <span className="rotulo">Código de 6 dígitos</span>
          <input
            name="codigo"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className="campo text-center font-mono text-xl tracking-[0.4em]"
          />
        </label>
        <button className={botao}>Ativar</button>
      </form>
    </div>
  );
}
