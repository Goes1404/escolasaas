import { GuiaInstalacao } from './GuiaInstalacao';

/**
 * Página pública de instalação do app.
 *
 * Endereço curto de propósito (`/instalar`): é o que o professor escreve na
 * lousa ou manda no grupo. Fica fora do painel porque quem mais precisa dela é
 * justamente quem ainda não entrou.
 */
export const metadata = {
  title: 'Instalar o app | Plataforma',
  description: 'Como instalar o app na tela de início do seu celular e receber os lembretes de estudo.',
};

export default function InstalarPage() {
  return <GuiaInstalacao />;
}
