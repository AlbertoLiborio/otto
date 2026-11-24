export type Papel = 'profissional' | 'empresa' | 'avaliador' | 'admin';
export type Vinculo = 'clt' | 'pj' | 'freelance';
export type Nivel = 'junior' | 'pleno' | 'senior' | 'especialista';
export type Modalidade = 'remoto' | 'presencial' | 'hibrido';

export type Perfil = {
  id: string;
  papel: Papel;
  nome: string;
  email: string;
  telefone: string | null;
};

export const NIVEIS: Nivel[] = ['junior', 'pleno', 'senior', 'especialista'];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  especialista: 'Especialista',
};

export const ROTULO_VINCULO: Record<Vinculo, string> = {
  clt: 'CLT',
  pj: 'PJ / Consultoria',
  freelance: 'Freelance',
};

export const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  remoto: 'Remoto',
  presencial: 'Presencial',
  hibrido: 'Híbrido',
};

export const ROTULO_STATUS_INDICACAO: Record<string, string> = {
  sugerido: 'Sugerido (interno)',
  enviado_empresa: 'Enviado à empresa',
  contato_solicitado: 'Contato solicitado',
  aceito_profissional: 'Contato liberado',
  recusado_profissional: 'Profissional recusou',
  contratado: 'Contratado',
  nao_selecionado: 'Não selecionado',
};

export const ROTULO_STATUS_DEMANDA: Record<string, string> = {
  aberta: 'Aberta',
  em_curadoria: 'Em curadoria',
  shortlist_enviada: 'Shortlist enviada',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

export const ROTULO_STATUS_AVALIACAO: Record<string, string> = {
  aguardando_caso: 'Aguardando caso prático',
  aguardando_avaliador: 'Aguardando avaliador',
  agendada: 'Entrevista agendada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export const VERSAO_TERMOS = '2026-11';
