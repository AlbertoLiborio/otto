import { AreaLogada } from '@/components/area-logada';
import { exigirPapel } from '@/lib/auth';

export default async function LayoutAvaliador({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirPapel('avaliador', 'admin');
  return <AreaLogada perfil={perfil}>{children}</AreaLogada>;
}
