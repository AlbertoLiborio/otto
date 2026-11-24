import { AreaLogada } from '@/components/area-logada';
import { exigirPapel } from '@/lib/auth';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirPapel('admin');
  return <AreaLogada perfil={perfil}>{children}</AreaLogada>;
}
