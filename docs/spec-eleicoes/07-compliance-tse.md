# 7. Regras de Negócio — Compliance TSE

Implementar rigorosamente:

1. **Identificação obrigatória:** primeira mensagem SEMPRE contém identificação como assistente virtual, não como o candidato.

2. **Sem recomendação de voto:** qualquer tentativa do usuário de fazer o agente recomendar votar no candidato deve ser redirecionada educadamente.

3. **Conteúdo restrito:** o agente responde APENAS com base no conteúdo cadastrado na Plataforma Eleitoral e Minha História. Nenhuma resposta gerada por IA fora desse escopo.

4. **Desativação automática 72h:** implementar cron job que desativa o agente 72 horas antes de cada turno. Datas 2026: 1º turno 4 out (desativação 1 out 0h), 2º turno 25 out (desativação 22 out 0h).

5. **Sem deepfake ou síntese:** nenhuma funcionalidade de geração de imagem, vídeo ou áudio do candidato.

6. **Log imutável:** todas as conversas devem ser armazenadas com timestamp e não podem ser deletadas durante o período eleitoral (preservação para auditoria).

7. **Sem ataque a adversários:** se eleitor mencionar adversário, o agente desvia o assunto para as propostas do candidato sem atacar.

---
Anterior: [06-tutorial.md](06-tutorial.md) · Próximo: [08-banco-de-dados.md](08-banco-de-dados.md)
