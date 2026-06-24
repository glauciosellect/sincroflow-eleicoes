# 6. Tutorial Completo do Sistema

> Este tutorial deve ser implementado como um módulo interativo dentro do sistema.
> Ao entrar pela primeira vez (logo após o pagamento), o candidato é guiado
> passo a passo antes de chegar ao Dashboard.

## Tutorial — Passo 1: Bem-vindo ao SyncroFlowEleições

**Tela de boas-vindas:**
- "Olá, [Nome do Candidato]! Seja bem-vindo ao SyncroFlowEleições."
- "Vamos configurar seu assistente em 5 passos simples. Leva cerca de 15 minutos."
- Barra de progresso: Passo 1 de 5
- Botão: COMEÇAR

## Tutorial — Passo 2: Sua História

**Objetivo:** preencher a aba "Minha História"

Instruções na tela:
- "Conte quem você é para seus eleitores. Sua trajetória, seus valores, por que você quer servir ao povo."
- "Seja autêntico. Esse conteúdo será usado pelo seu assistente para apresentar você de forma humanizada."
- Campo de texto grande com placeholder: "Nasci em [cidade], sou [profissão] há X anos. Ao longo da minha vida..."
- Dica: "Escreva na primeira pessoa. Fale sobre sua família, suas conquistas e o que te motivou a entrar na política."
- Mínimo sugerido: 200 caracteres. Sem máximo.
- Botão: SALVAR E CONTINUAR

## Tutorial — Passo 3: Suas Propostas (Plataforma Eleitoral)

**Objetivo:** preencher ao menos 3 temas da Plataforma Eleitoral

Instruções na tela:
- "Aqui você cadastra suas propostas para cada área. Seu assistente só vai responder sobre os temas que você preencher."
- "Você não precisa preencher todos agora — pode completar depois. Mas quanto mais você preencher, melhor será o atendimento."
- Exibe os 15 campos de temas
- Destaque visual nos campos preenchidos (borda verde)
- Contador: "X de 15 temas preenchidos"
- Dica: "Seja específico. Em vez de 'vou melhorar a saúde', escreva 'vou ampliar o horário das UBS para atendimento noturno e aos sábados'."
- Botão: SALVAR E CONTINUAR

## Tutorial — Passo 4: Mensagem de Apresentação (Disclaimer)

**Objetivo:** personalizar o disclaimer

Instruções na tela:
- "Esta é a primeira mensagem que seu assistente enviará para cada novo eleitor."
- "Ela é obrigatória pela Resolução TSE nº 23.755/2026."
- Exibe o modelo padrão já preenchido com os dados do candidato
- Campo editável
- Preview ao vivo: "É assim que o eleitor vai receber:"
- Balão de WhatsApp estilizado mostrando o preview
- Aviso: "Não remova a identificação como assistente virtual — isso é exigência legal."
- Botão: SALVAR E CONTINUAR

## Tutorial — Passo 5: Conectar o Primeiro Canal

**Objetivo:** conectar pelo menos o WhatsApp

Instruções na tela:
- "Agora vamos conectar seu WhatsApp para que os eleitores possam conversar com seu assistente."
- Opções de canal com ícones: WhatsApp | Instagram | Facebook | Telegram | E-mail
- Destaque no WhatsApp (canal mais importante)
- Instrução passo a passo para conexão do WhatsApp via QR Code ou API
- "Pode pular este passo e conectar depois em Configurações > Canais"
- Botão: CONECTAR WHATSAPP ou PULAR POR AGORA

## Tutorial — Passo 6: Pronto! Ative seu Assistente

**Tela de conclusão:**
- "Parabéns! Seu assistente está configurado."
- Resumo do que foi preenchido (checklist visual)
- Status do agente: PRONTO PARA ATIVAR
- "Revise tudo e quando estiver pronto, ative seu assistente."
- Botão grande: ATIVAR MEU ASSISTENTE → muda status para ATIVO
- Botão secundário: IR PARA O DASHBOARD (ativa depois)

## Tutorial — Dicas Contextuais (durante o uso)

Além do tutorial inicial, implementar dicas contextuais (tooltips ou banners informativos) nas telas:

| Tela | Dica exibida |
|---|---|
| Plataforma Eleitoral (campo vazio) | "Eleitores já perguntaram sobre este tema. Preencha para não perder oportunidades." |
| Chat (primeira mensagem recebida) | "Este é seu primeiro eleitor! Você pode acompanhar a conversa aqui em tempo real." |
| Relatórios | "Use estes dados para definir sua agenda de rua. Vá onde os eleitores estão pedindo." |
| Compliance TSE | "Faltam X dias para a eleição. Seu assistente será desativado automaticamente às 0h do dia [data]." |
| Equipe (vazia) | "Convide sua equipe para ajudar no atendimento. Cada colaborador tem seu próprio acesso." |

## Tutorial — Central de Ajuda (Help Center)

Implementar ícone "?" em todas as telas que abre um painel lateral com:

- Vídeo curto explicativo da tela atual (placeholder por ora)
- FAQ da tela
- Link para "Falar com suporte"

**FAQs por módulo:**

**Minha História:**
- Q: "Posso mudar minha história depois?"
- A: "Sim, a qualquer momento. As mudanças valem para conversas futuras."

**Plataforma Eleitoral:**
- Q: "E se o eleitor perguntar sobre um tema que não preenchi?"
- A: "O assistente informará que vai encaminhar a dúvida para sua equipe e registrará a pergunta no relatório de Gaps."

**Agenda:**
- Q: "O assistente pode agendar reuniões com eleitores?"
- A: "Não. Por segurança e conformidade, o assistente apenas informa compromissos existentes. Nunca cria compromissos novos."

**Compliance TSE:**
- Q: "O que acontece nas 72h antes da eleição?"
- A: "Seu assistente é desativado automaticamente às 0h de 72h antes do pleito, conforme a Resolução TSE nº 23.755/2026. Você receberá um aviso com antecedência."

**Equipe:**
- Q: "Um colaborador pode ver o histórico de conversas?"
- A: "Depende da função. Colaboradores de Atendimento têm acesso ao Chat. Colaboradores de Conteúdo não."

**Chat:**
- Q: "Como assumo uma conversa manualmente?"
- A: "Clique no botão 'Assumir Conversa' dentro de qualquer chat. O assistente para de responder e você assume o controle. Para devolver ao assistente, clique em 'Devolver para o Agente'."

---
Anterior: [05-landing-page.md](05-landing-page.md) · Próximo: [07-compliance-tse.md](07-compliance-tse.md)
