# 8. Banco de Dados — Tabelas Principais

```sql
-- Candidatos (conta principal)
candidates (
  id, name, cpf, email, whatsapp, candidate_number,
  party, position, state, city, photo_url,
  stripe_customer_id, stripe_subscription_id,
  status (active|suspended|cancelled),
  plan (campaign|mandate),
  created_at
)

-- Membros da equipe
team_members (
  id, candidate_id, user_id, name, email, role,
  invited_at, accepted_at, status
)

-- Configuração do agente
agent_config (
  id, candidate_id, agent_name, agent_role, agent_style,
  story (text), disclaimer (text), candidate_site,
  voice_enabled, is_active, deactivated_at, deactivation_reason
)

-- Plataforma eleitoral (propostas)
platform_topics (
  id, candidate_id, topic_name, topic_key, content (text),
  updated_at
)

-- Contatos (eleitores)
contacts (
  id, candidate_id, channel_type, channel_id,
  name, phone, email, first_contact_at, last_contact_at,
  total_interactions, notes
)

-- Conversas
conversations (
  id, candidate_id, contact_id, channel_type,
  started_at, last_message_at, status (active|closed|urgent),
  assigned_to (null = agente, user_id = humano)
)

-- Mensagens
messages (
  id, conversation_id, sender_type (voter|agent|human),
  content (text), media_url, media_type,
  audio_transcript, created_at, is_read
)

-- Solicitações
requests (
  id, candidate_id, contact_id, conversation_id,
  protocol_number, subject, description, region, neighborhood,
  status (received|analyzing|forwarded|resolved),
  created_at, updated_at, resolved_by, resolved_at
)

-- Agenda
events (
  id, candidate_id, title, description, event_type,
  location, neighborhood, city, link,
  starts_at, ends_at, is_public,
  google_event_id, created_at
)

-- Log de auditoria (imutável)
audit_log (
  id, candidate_id, conversation_id, message_id,
  event_type, content, metadata (jsonb),
  created_at
)
```

---
Anterior: [07-compliance-tse.md](07-compliance-tse.md) · Próximo: [09-variaveis-ambiente.md](09-variaveis-ambiente.md)
