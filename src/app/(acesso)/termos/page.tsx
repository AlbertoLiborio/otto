import { Cartao } from '@/components/ui';

export const metadata = { title: 'Termos de Uso' };

export default function Termos() {
  return (
    <Cartao>
      <h1 className="mb-3 font-display text-2xl font-bold">Termos de Uso</h1>
      <p className="mb-3 text-sm text-ambar">Rascunho — texto definitivo pendente de revisão jurídica.</p>
      <div className="space-y-3 text-sm text-tinta-2">
        <p>O Otto conecta profissionais avaliados tecnicamente a empresas que buscam contratar.</p>
        <p>
          <strong>Profissionais:</strong> o cadastro e a avaliação são gratuitos. O profissional declara que as informações
          fornecidas são verdadeiras e autoriza o Otto a apresentar seu perfil técnico, de forma anonimizada, a empresas
          clientes. Dados de contato só são compartilhados após aceite expresso para cada oportunidade.
        </p>
        <p>
          <strong>Empresas:</strong> pagam pelo serviço de curadoria conforme o plano contratado (assinatura, créditos ou
          percentual na contratação) e se comprometem a usar os dados recebidos apenas para o processo seletivo.
        </p>
        <p>O Otto apenas indica; a contratação é feita diretamente entre empresa e profissional.</p>
      </div>
    </Cartao>
  );
}
