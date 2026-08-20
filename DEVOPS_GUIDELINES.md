# Diretrizes de DevOps e Vercel CLI

Este documento contém as regras obrigatórias para a manutenção e operação dos ambientes deste projeto. **Qualquer IA ou desenvolvedor deve ler estas instruções antes de executar comandos de deploy ou configuração.**

## 1. Ambiente Local (Desenvolvimento)
- **Sincronização:** Antes de qualquer tarefa de desenvolvimento local, é OBRIGATÓRIO sincronizar as variáveis de ambiente.
- **Comando:** `vercel env pull .env.local --yes`
- **Objetivo:** Garantir que o arquivo `.env.local` esteja sempre atualizado com as configurações do dashboard da Vercel.

## 2. Ambientes de Preview (Validação)
- **Geração Automática:** Deploys ocorrem automaticamente em qualquer branch que não seja a `main`.
- **URLs de Commit:** URLs fixas geradas para cada push específico (ex: `projeto-git-hash.vercel.app`).
- **URLs de Branch:** URLs que apontam sempre para o código mais recente daquela branch (ex: `projeto-git-branch-name.vercel.app`).

## 3. Ambientes Customizados (Staging / QA)
- **Uso:** Apenas se houver necessidade de um ambiente de homologação fixo e isolado.
- **Comando:** `vercel deploy --target=[nome_do_ambiente]` (ex: `vercel deploy --target=staging`).
- **Requisito:** Este comando exige plano **Pro** ou **Enterprise** da Vercel.

## 4. Ambiente de Produção (Live)
- **Via Git (Preferencial):** Realizar o merge da branch de trabalho para a branch `main`.
- **Via CLI (Emergência):** Executar o comando `vercel --prod`.

---
*Configuração atual:*
- **CLI:** Vercel CLI 53.1.0 instalada.
- **Status:** Projeto conectado (Linked) à conta da Vercel.
