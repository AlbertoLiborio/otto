import { AreaLogada } from '@/components/area-logada';
import { exigirPapel } from '@/lib/auth';

export default async function LayoutProfissional({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirPapel('profissional');
  return <AreaLogada perfil={perfil}>{children}</AreaLogada>;
}
