import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { rotaInicial } from '@/lib/auth';
import type { Papel } from '@/lib/tipos';

const TIPOS: EmailOtpType[] = ['email', 'signup', 'magiclink', 'invite', 'recovery', 'email_change'];

/**
 * Links dos e-mails (confirmação, convite, link mágico, nova senha).
 * Funciona mesmo se o e-mail for aberto em outro aparelho/navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const tipo = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error && data.user) {
      if (tipo === 'recovery' || tipo === 'invite') return NextResponse.redirect(`${origin}/seguranca/senha`);
      const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).single();
      return NextResponse.redirect(`${origin}${rotaInicial((perfil?.papel ?? 'profissional') as Papel)}`);
    }
  }
  return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent('Link inválido ou expirado. Solicite um novo.')}`);
}
