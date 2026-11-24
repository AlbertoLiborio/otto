import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a chave de serviço: IGNORA o RLS.
 * Use somente em Server Actions/rotas, sempre DEPOIS de verificar
 * quem é o usuário e se ele pode executar a operação.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
