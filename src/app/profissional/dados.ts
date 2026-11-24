import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Especialidade ativa do MVP (TOTVS RM). */
export async function especialidadePadrao(supabase: SupabaseClient) {
  const { data } = await supabase.from('especialidades').select('id, nome, caso_pratico_padrao').eq('slug', 'totvs-rm').single();
  return data as { id: number; nome: string; caso_pratico_padrao: string | null };
}

export async function resumoProfissional(supabase: SupabaseClient, userId: string) {
  const [{ data: prof }, { count: nComp }, { data: tentativas }, { data: avaliacoes }, { data: selos }, { count: nConvites }] =
    await Promise.all([
      supabase.from('profissionais').select('*').eq('id', userId).maybeSingle(),
      supabase.from('competencias_profissional').select('*', { count: 'exact', head: true }).eq('profissional_id', userId),
      supabase.from('tentativas_prova').select('id, status, nota, iniciada_em, expira_em, finalizada_em, prova_id').eq('profissional_id', userId).order('iniciada_em', { ascending: false }),
      supabase.from('avaliacoes').select('*').eq('profissional_id', userId).order('created_at', { ascending: false }),
      supabase.from('selos').select('*').eq('profissional_id', userId).order('emitido_em', { ascending: false }),
      supabase.from('indicacoes').select('*', { count: 'exact', head: true }).eq('profissional_id', userId).eq('status', 'contato_solicitado'),
    ]);
  return {
    prof,
    nComp: nComp ?? 0,
    tentativas: tentativas ?? [],
    avaliacao: avaliacoes?.[0] ?? null,
    selo: selos?.find((s) => new Date(s.valido_ate) > new Date()) ?? null,
    convitesPendentes: nConvites ?? 0,
  };
}
