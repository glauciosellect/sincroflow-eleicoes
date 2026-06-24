# 11. Notas Finais para o Desenvolvedor

- Nunca usar o banco Supabase do SyncroFlow original. Usar somente o projeto `syncroflow-eleicoes`.
- Nunca compartilhar tokens ou chaves entre os dois sistemas.
- Todo texto voltado ao usuário final deve usar linguagem eleitoral (candidato, eleitor, proposta, mandato) — nunca linguagem comercial (empresa, cliente, produto, lead).
- O agente nunca gera conteúdo por iniciativa própria. Responde APENAS com base no que o candidato cadastrou.
- Manter o código limpo e comentado para facilitar manutenção pós-eleição.
- Implementar rate limiting nas rotas de API para evitar spam de eleitores.
- Todas as datas de desativação TSE devem ser configuráveis via painel admin, não hardcoded.

---
Anterior: [10-cronograma.md](10-cronograma.md) · [Voltar ao índice](00-INDICE.md)
