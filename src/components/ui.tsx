import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ROTULO_NIVEL, type Nivel } from '@/lib/tipos';

export function Marca({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-bold tracking-tight text-tinta ${className}`}>
      otto<span className="text-ambar">.</span>
    </span>
  );
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
const estilos: Record<Variante, string> = {
  primario: 'bg-tinta text-white hover:bg-tinta-2',
  secundario: 'border border-linha bg-white text-tinta hover:border-tinta-2',
  perigo: 'bg-vermelho text-white hover:opacity-90',
  fantasma: 'text-tinta-2 hover:bg-black/5',
};
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50';

export function Botao({ variante = 'primario', className = '', ...props }: ComponentProps<'button'> & { variante?: Variante }) {
  return <button className={`${base} ${estilos[variante]} ${className}`} {...props} />;
}

export function BotaoLink({
  variante = 'primario',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={`${base} ${estilos[variante]} ${className}`} {...props} />;
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-linha bg-cartao p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-bold text-tinta">{children}</h1>
      {sub && <p className="mt-1 text-suave">{sub}</p>}
    </header>
  );
}

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-suave">{dica}</span>}
    </label>
  );
}

export function Aviso({ erro, ok }: { erro?: string; ok?: string }) {
  if (!erro && !ok) return null;
  return (
    <div
      role={erro ? 'alert' : 'status'}
      className={`mb-5 rounded-lg px-4 py-3 text-sm ${erro ? 'bg-vermelho-claro text-vermelho' : 'bg-verde-claro text-verde'}`}
    >
      {erro ?? ok}
    </div>
  );
}

export function Etiqueta({ children, cor = 'neutra' }: { children: ReactNode; cor?: 'neutra' | 'ambar' | 'verde' | 'vermelha' }) {
  const c = {
    neutra: 'bg-black/5 text-tinta-2',
    ambar: 'bg-ambar-claro text-ambar',
    verde: 'bg-verde-claro text-verde',
    vermelha: 'bg-vermelho-claro text-vermelho',
  }[cor];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

export function SeloNivel({ nivel, nota }: { nivel: Nivel; nota?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ambar/40 bg-ambar-claro px-3 py-1 text-xs font-bold text-ambar">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
        <path d="M10 1l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 13.4 5.2 15.9l.9-5.4L2.2 6.7l5.4-.8z" />
      </svg>
      {ROTULO_NIVEL[nivel]}
      {nota != null && <span className="font-medium text-tinta-2">· {Number(nota).toFixed(0)}</span>}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-linha p-6 text-center text-sm text-suave">{children}</p>;
}

/** Lê ?erro= e ?ok= das searchParams do Next 15 */
export async function lerAviso(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const sp = await searchParams;
  const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return { erro: s(sp.erro), ok: s(sp.ok), sp };
}
