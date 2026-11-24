import { NextResponse, type NextRequest } from 'next/server';
import { criarClienteServidor } from '@/lib/supabase/server';
import { rotaInicial } from '@/lib/auth';
import type { Papel } from '@/lib/tipos';

const PROXIMOS_PERMITIDOS = ['/seguranca/senha'];

/** Retorno do LinkedIn e dos links de e-mail no formato padrão (?code=). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const proximo = searchParams.get('proximo');
  if (code) {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (proximo && PROXIMOS_PERMITIDOS.includes(proximo)) return NextResponse.redirect(`${origin}${proximo}`);
      const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', data.user.id).single();
      return NextResponse.redirect(`${origin}${rotaInicial((perfil?.papel ?? 'profissional') as Papel)}`);
    }
  }
  return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent('Link inválido ou expirado. Tente novamente.')}`);
}
