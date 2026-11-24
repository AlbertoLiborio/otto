import type { Nivel } from './tipos';

/** RN05 — pesos da nota final. */
export const PESOS = { prova: 0.3, caso: 0.3, entrevista: 0.4 };

/** RN06 — nível pela nota (0 a 100). */
export function nivelPorNota(nota: number): Nivel {
  if (nota >= 90) return 'especialista';
  if (nota >= 75) return 'senior';
  if (nota >= 60) return 'pleno';
  return 'junior';
}

export function notaFinal(prova: number, caso: number, entrevista: number) {
  return Math.round((prova * PESOS.prova + caso * PESOS.caso + entrevista * PESOS.entrevista) * 100) / 100;
}

const ORDEM: Record<Nivel, number> = { junior: 0, pleno: 1, senior: 2, especialista: 3 };
export function nivelAtende(nivel: Nivel | null | undefined, minimo: Nivel) {
  return nivel ? ORDEM[nivel] >= ORDEM[minimo] : false;
}

/** RN10 — validade do selo. */
export const MESES_VALIDADE_SELO = 12;

/** Valida CNPJ (dígitos verificadores). Retorna só os números ou null. */
export function validarCnpj(valor: string): string | null {
  const c = valor.replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return null;
  const digito = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const n of base) {
      soma += Number(n) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digito(c.slice(0, 12));
  const d2 = digito(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`) ? c : null;
}

export function formatarCnpj(c: string) {
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function reais(centavos: number | null | undefined) {
  if (centavos == null) return '—';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "R$ 1.234,56" ou "1234,56" -> centavos */
export function paraCentavos(valor: FormDataEntryValue | null): number | null {
  if (valor == null) return null;
  const limpo = String(valor).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function dataBR(iso: string | null | undefined, comHora = false) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', comHora
    ? { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }
    : { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

/** Embaralha uma cópia do array (Fisher–Yates com crypto). */
export function embaralhar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
