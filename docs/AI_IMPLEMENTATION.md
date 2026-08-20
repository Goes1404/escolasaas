# 🏛️ Documentação Técnica: Aurora IA (Google Gemini)

Esta documentação descreve a implementação da **Aurora IA**, o motor de inteligência artificial da Plataforma Compromisso 360, utilizando o **Google Gemini** via framework **Genkit**.

## 🚀 Arquitetura de Inteligência

O sistema utiliza uma abordagem de **IA Gerativa de Nível Industrial**, focada em baixa latência e alta precisão pedagógica.

### 1. Motor Principal (Genkit)
O arquivo central de configuração é o `src/ai/genkit.ts`. Ele inicializa o SDK do Genkit com o plugin oficial do Google AI.

- **Modelo Padrão**: `googleai/gemini-2.0-flash` (Sintonizado para velocidade e raciocínio acadêmico).
- **Segurança**: Filtros configurados como `BLOCK_ONLY_HIGH` para permitir explicações de temas complexos (biologia, história) sem censura indevida.

### 2. Fluxos Pedagógicos (Flows)
As capacidades da Aurora são divididas em **Flows** (Fluxos) isolados em `src/ai/flows/`:

| Fluxo | Descrição | Modelo |
|-------|-----------|--------|
| `conceptExplanationAssistant` | Assistente de chat para dúvidas gerais e suporte. | Gemini 2.0 Flash |
| `essayTopicGenerator` | Gerador de propostas de redação estilo ENEM com textos motivadores. | Gemini 1.5 Flash |
| `essayEvaluator` | Auditor de redações baseado nas 5 competências do INEP. | Gemini 1.5 Flash |
| `bulkQuestionParser` | Extrator de questões de textos brutos de PDFs/Provas. | Gemini 1.5 Flash |
| `audioSimple` | Conversão de texto em fala (TTS) para acessibilidade. | Gemini 2.5 Flash TTS |

### 3. Gateway de API (Server-Side)
Todas as chamadas à IA ocorrem via Server Actions ou pela rota de API `src/app/api/genkit/route.ts`. 

- **Segurança**: A chave de API (`GEMINI_API_KEY`) nunca é exposta ao navegador.
- **Timeout**: Configurado para 120 segundos para suportar gerações complexas em ambiente Netlify.

---

## 🛠️ Configuração de Ambiente

Para que a Engine funcione corretamente, a seguinte variável deve estar presente:

```env
GEMINI_API_KEY=sua_chave_aqui
```

### Diagnóstico de Saúde
Você pode verificar se o sinal da IA está chegando ao servidor acessando:
`https://seu-dominio.com/api/health`

---

## 🎨 Limpeza de Resposta (Anti-Markdown)
Devido à necessidade de integrar a IA em componentes React puros, implementamos uma função de limpeza no `concept-explanation-assistant.ts` que remove:
- Blocos de código Markdown (`` ```json ``, `` ```text ``).
- Artefatos de formatação que poderiam quebrar o JSON de transporte.

---

## ♿ Acessibilidade (TTS)
A Aurora possui integração nativa com o modelo `gemini-2.5-flash-preview-tts`. Ela é capaz de gerar arquivos de áudio `.wav` em tempo real para alunos com deficiência visual ou dificuldades de leitura, seguindo o padrão de acessibilidade de Santana de Parnaíba.

---
© 2024 Rede Educacional Santana de Parnaíba • Tecnologia Industrial