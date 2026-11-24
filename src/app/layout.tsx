import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';

const texto = Inter({ subsets: ['latin'], variable: '--fonte-texto' });
const titulo = Fraunces({ subsets: ['latin'], variable: '--fonte-titulo', weight: ['500', '700'] });

export const metadata: Metadata = {
  title: { default: 'Otto — Profissionais avaliados tecnicamente', template: '%s · Otto' },
  description:
    'O Otto indica profissionais já avaliados tecnicamente. Empresas recebem uma shortlist curada; profissionais ganham um selo de competência.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${texto.variable} ${titulo.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
