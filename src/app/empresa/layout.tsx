import { AreaLogada } from '@/components/area-logada';
import { exigirPapel } from '@/lib/auth';

export default async function LayoutEmpresa({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirPapel('empresa');
  return <AreaLogada perfil={perfil}>{children}</AreaLogada>;
}
