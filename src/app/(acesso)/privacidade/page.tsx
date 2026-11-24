import { Cartao } from '@/components/ui';

export const metadata = { title: 'Política de Privacidade' };

export default function Privacidade() {
  return (
    <Cartao>
      <h1 className="mb-3 font-display text-2xl font-bold">Política de Privacidade</h1>
      <p className="mb-3 text-sm text-ambar">Rascunho — texto definitivo pendente de revisão jurídica.</p>
      <div className="space-y-3 text-sm text-tinta-2">
        <p><strong>Dados coletados:</strong> nome, e-mail, telefone, dados profissionais, currículo, respostas e notas das avaliações.</p>
        <p><strong>Finalidades:</strong> avaliação técnica, indicação a empresas, envio de ofertas de treinamento (com consentimento) e estatísticas anônimas de competências.</p>
        <p><strong>Compartilhamento:</strong> empresas veem apenas o perfil técnico anonimizado; nome e contato só após seu aceite para aquela oportunidade.</p>
        <p><strong>Seus direitos (LGPD):</strong> acesso, correção, exportação, exclusão e revogação de consentimentos a qualquer momento.</p>
        <p><strong>Segurança:</strong> dados armazenados com criptografia, acesso restrito por perfil e registro de auditoria.</p>
      </div>
    </Cartao>
  );
}
