// Parte A do disclaimer de boas-vindas (seção 4.2 da spec) — fixo, idêntico para todo
// contratante, nunca editável pelo painel nem persistido por candidato. Exigência da
// Resolução TSE 23.755/2026: identificação obrigatória de IA na primeira mensagem.
export const TSE_AI_DISCLAIMER = '⚠️ Você está sendo atendido por uma assistente virtual com inteligência artificial. Não sou um ser humano. Suas mensagens são registradas e analisadas para melhorar o atendimento. Para encerrar, responda SAIR.'

// Concatena a Parte A (fixa) com a Parte B (editável pelo contratante — o campo
// `disclaimer` do AgentConfig). Usar sempre esta função ao enviar/exibir a mensagem
// de boas-vindas; nunca enviar `agentConfig.disclaimer` isolado.
export function buildWelcomeMessage(editableWelcome: string): string {
  return `${TSE_AI_DISCLAIMER}\n\n${editableWelcome}`.trim()
}
