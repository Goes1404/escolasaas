# Fazer a recuperação de senha realmente funcionar

> Diagnóstico e plano, 2026-07-29. Os números vêm do banco de produção, não de estimativa.

## O problema, medido

A recuperação de senha existe, está implementada nas três fases do plano original
e **quase ninguém consegue usar**.

| Métrica | Valor |
|---|---|
| Tentativas de recuperação (27/jun – 25/jul) | **267** |
| Que falharam | **263**, de **126 alunos distintos** |
| Códigos SMS efetivamente gerados | **0** |

Zero. Em um mês inteiro, nenhum OTP chegou a ser criado. Como o código grava o
OTP no banco **antes** de disparar o SMS (`createAndSendOtp`), isso prova que o
fluxo trava *antes* do envio — não é problema de Twilio nem de crédito de SMS.

## A causa é o cadastro, não o código

O fluxo tem exatamente dois caminhos, e ambos exigem um dado que a maioria das
contas não tem:

| Caminho | Dado exigido | Alunos que têm | % |
|---|---|---|---|
| `lookup-phone` (principal) | `profiles.phone` | 224 de 1058 | 21% |
| `register-phone` (fallback) | `profiles.birth_date` | **39 de 1058** | **3,7%** |

**811 alunos (77%) não têm nenhum dos dois.** Para eles nenhum caminho pode
funcionar — não por bug, mas porque a prova de identidade que o sistema pede não
existe no cadastro. Os 126 que tentaram e falharam são exatamente essas pessoas.

## O que já foi feito

1. **Mensagem de erro honesta.** Antes dizia "os dados não conferem — confira
   nome e data de nascimento", o que culpa o aluno e o faz tentar de novo em vão.
   Como quase nenhum cadastro tem data de nascimento, na maioria das vezes ele
   digitou tudo certo. Agora a mensagem explica que o cadastro é que está
   incompleto e manda para o atendimento. A generalidade anti-takeover foi
   preservada: a resposta continua idêntica para "não achou" e para "achou mas
   já tem telefone".
2. **Botão de WhatsApp da secretaria** na tela de recuperação, sempre visível e
   em destaque quando há erro. Para 77% dos alunos o atendimento humano não é
   plano B — é o único caminho.
3. **Filtro "sem telefone"** no diretório da secretaria, para ela enxergar e
   atacar a fila dos 834.

## O plano

### Fase A — Parar de perder gente agora (feito)
Mensagem honesta + WhatsApp + filtro da secretaria. Não conserta o cadastro, mas
para de mandar 126 pessoas para uma parede.

### Fase B — Fechar a torneira
O `PhoneGate` já bloqueia o aluno sem telefone e resolve o caso de quem loga.
Falta o simétrico:

- **Cobrir quem não loga há meses.** O gate só alcança quem entra. Medir quantos
  dos 834 acessaram nos últimos 90 dias (`last_access`) dá o tamanho real da
  fila que precisa de mutirão.

> **Data de nascimento saiu do escopo** (decisão de 2026-07-29). O caminho que
> dependia dela — `register-phone` — foi removido: era a única prova de
> identidade daquele fluxo, só 39 dos 1058 alunos a têm cadastrada, e mantê-lo
> sem o campo transformaria o fluxo em tomada de conta (bastaria digitar o nome
> de um aluno e registrar o próprio telefone). Quem não tem telefone vai para a
> secretaria, que confere identidade presencialmente — o que num cursinho
> presencial é mais forte que qualquer prova digital.

### Fase C — Mutirão de cadastro
A secretaria usa o filtro novo para ligar/abordar presencialmente e preencher
telefone e data de nascimento. É trabalho manual, mas é finito e resolve de vez
— cursinho presencial tem contato com o aluno.

Meta útil: sair de 21% para 80% de cobertura de telefone. A partir daí a
recuperação automática passa a atender a maioria e o WhatsApp volta a ser
exceção.

### Fase D — Verificar o Twilio de ponta a ponta
Ainda **não há prova** de que o envio de SMS funciona em produção: como nenhum
OTP foi gerado, o `sendOtpSms` nunca chegou a ser exercitado com dado real. Antes
de anunciar a recuperação para os alunos, fazer um teste com uma conta de
verdade e confirmar que:

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_PHONE_NUMBER` estão
  configurados no ambiente de produção;
- o SMS chega de fato a um número brasileiro;
- o código validado permite trocar a senha.

Sem isso, corre-se o risco de arrumar o cadastro e descobrir que o próximo passo
também não funciona.

## Ordem sugerida

**D antes de C.** Não faz sentido gastar o esforço manual do mutirão para
descobrir depois que o SMS não sai. O teste de ponta a ponta é barato e elimina
essa dúvida.

Depois: B (campo de nascimento no gate), então C (mutirão).
