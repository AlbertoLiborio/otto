import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AREAS_PROTEGIDAS = ['/profissional', '/empresa', '/avaliador', '/admin', '/conta', '/seguranca'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return NextResponse.next(); // ambiente sem Supabase: só páginas públicas

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Renova a sessão e confirma o usuário com o servidor de autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  if (!user && AREAS_PROTEGIDAS.some((a) => caminho.startsWith(a))) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/entrar';
    destino.search = `?voltar=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(destino);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
