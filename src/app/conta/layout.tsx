import { AreaLogada } from '@/components/area-logada';
import { exigirPapel, TODOS_PAPEIS } from '@/lib/auth';

export default async function LayoutConta({ children }: { children: React.ReactNode }) {
  const { perfil } = await exigirPapel(...TODOS_PAPEIS);
  return <AreaLogada perfil={perfil}>{children}</AreaLogada>;
}
