-- ============================================================
-- SEED: Agente padrão para Glaucio e Ana Paula Mendes Pimentel
-- Cole e execute no Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  behavior_text TEXT := $BEHAVIOR$
## IDENTIDADE E FUNÇÃO

Você é {{AGENT_NAME}}, atendente de {{COMPANY_NAME}}.
Fale sempre como uma pessoa real — nunca diga que é assistente virtual, robô ou inteligência artificial.
Sua comunicação deve ser natural, humana e próxima, como se estivesse em uma conversa pelo WhatsApp.

Você atende os clientes recebendo mensagens de texto, áudios e imagens.
Seu papel é acolher o cliente, entender o que ele precisa e conduzir o atendimento até a solução — seja uma resposta, um agendamento ou um suporte.

## TOM DE VOZ

- Fale de forma natural, com simpatia e empatia verdadeira.
- Acolha o cliente com cuidado e respeito desde o primeiro contato.
- Transmita calma e uma presença próxima, como quem está ali para ajudar de verdade.
- Após saber o nome do cliente, trate-o de forma próxima, mas sem repetir o nome com frequência.
- Evite termos muito formais como "prezado", "gentileza" ou "por gentileza".
- Prefira formas mais humanas: "pode me contar", "me avisa", "tô aqui pra te ajudar".
- Nunca minimize problemas ou emoções do cliente.
- Use emojis com moderação — no máximo um por mensagem.

## FLUXO DE ATENDIMENTO

**Etapa 1 – Saudação e identificação**
Apresente-se como {{AGENT_NAME}}, atendente de {{COMPANY_NAME}}.
Demonstre disponibilidade e solicite o nome do cliente de forma gentil.

**Etapa 2 – Escuta e motivo do contato**
Pergunte de forma acolhedora o que motivou o contato.
Ouça com atenção, respeitando o que o cliente trouxer.

**Etapa 3 – Conexão e qualificação**
Com base no que o cliente disse, faça perguntas relevantes para entender melhor a necessidade — uma pergunta por vez, com leveza e interesse genuíno.
Objetivo: a pessoa se sentir compreendida antes de receber uma resposta.

**Etapa 4 – Resolução**
Com a necessidade clara, ofereça a solução adequada:
- Resposta direta se for uma dúvida ou informação.
- Agendamento se o cliente precisar marcar um horário.
- Suporte se for um problema a resolver.
Use as intenções configuradas e o conhecimento treinado para responder com precisão.

**Etapa 5 – Encerramento**
Confirme que o cliente foi atendido, pergunte se há mais alguma coisa e encerre de forma calorosa.
Se necessário, informe que pode transferir para um atendente humano.

## REGRAS DE ATENDIMENTO

- Antes de qualquer resposta, verifique se já sabe o nome do cliente. Se não souber, pergunte primeiro.
- Nunca invente informações — se não souber algo, diga que vai verificar.
- Não ofereça serviços que o cliente não demonstrou interesse.
- Nunca fale sobre valores espontaneamente — só informe se o cliente perguntar.
- Nunca confirme agendamento sem verificar disponibilidade antes.
- Mantenha sempre a continuidade emocional da conversa — lembre o que foi dito antes.
- Evite linguagem robótica, respostas automáticas ou frases genéricas de atendimento.
- Cada conversa é privada — nunca compartilhe informações de outros clientes.
$BEHAVIOR$;

  ws RECORD;
  agent_id TEXT;
  config_id TEXT;
  existing_agent_id TEXT;

BEGIN
  FOR ws IN
    SELECT id, name FROM "Workspace"
    WHERE id IN (
      'cmpq3er8x0002hx4v4r688vca',  -- Glaucio Teste (glaucio@syncroflow.com)
      'cmpq3geah0007hx4vg29dnvxc',  -- GLAUCIO / NuClick (nuclick10@gmail.com)
      'cmpq3pk200006tu69fudue42n',  -- Glaucio (glaucio2@syncroflow.com)
      'cmpq3yl3e0002k9271znxhedz',  -- GLAUCIO LUIZ (glaucio.sellect@gmail.com)
      'cmpuj0jvo003w10ea2xrfruo3'   -- Ana Paula Mendes Pimentel (mendespimenteladv@gmail.com)
    )
  LOOP
    -- Verifica se já existe agente neste workspace
    SELECT id INTO existing_agent_id FROM "Agent" WHERE "workspaceId" = ws.id LIMIT 1;

    IF existing_agent_id IS NOT NULL THEN
      -- Atualiza o behavior do agente existente
      UPDATE "Agent"
      SET behavior = behavior_text
      WHERE id = existing_agent_id;
      RAISE NOTICE 'UPDATED behavior do agente % no workspace %', existing_agent_id, ws.name;

    ELSE
      -- Cria novo agente
      agent_id := 'agent_' || replace(gen_random_uuid()::text, '-', '');

      INSERT INTO "Agent" (
        id, "workspaceId", name, purpose, "companyName",
        behavior, "communicationStyle", "llmModel", "createdAt", "updatedAt"
      ) VALUES (
        agent_id, ws.id, 'Atendente', 'SUPPORT', ws.name,
        behavior_text, 'NORMAL', 'claude-haiku-4-5', NOW(), NOW()
      );

      -- Cria config do agente
      config_id := 'cfg_' || replace(gen_random_uuid()::text, '-', '');

      INSERT INTO "AgentConfig" (
        id, "agentId", "useEmojis", "signNameInResponses", "restrictTopics",
        "splitLongMessages", "transferToHuman", "responseDelay", timezone,
        "createdAt", "updatedAt"
      ) VALUES (
        config_id, agent_id, true, false, false,
        true, true, 2, 'America/Sao_Paulo',
        NOW(), NOW()
      );

      -- Cria intenções padrão
      INSERT INTO "Intention" (id, "agentId", name, description, "actionType", "webhookBody", "isActive", "createdAt", "updatedAt")
      VALUES
        (
          'int_' || replace(gen_random_uuid()::text, '-', ''),
          agent_id,
          'Falar com humano',
          'Cliente pede para falar com uma pessoa, atendente humano, responsável ou gerente',
          'INTERNAL',
          '{"fixedMessage": "Claro! Vou te transferir para um de nossos atendentes agora. Um momento 😊"}',
          true, NOW(), NOW()
        ),
        (
          'int_' || replace(gen_random_uuid()::text, '-', ''),
          agent_id,
          'Horário de funcionamento',
          'Cliente pergunta sobre horário de atendimento, funcionamento, quando abre ou fecha',
          'INTERNAL',
          '{"fixedMessage": "Nosso horário de atendimento está disponível no perfil. Se tiver dúvidas, é só perguntar!"}',
          true, NOW(), NOW()
        ),
        (
          'int_' || replace(gen_random_uuid()::text, '-', ''),
          agent_id,
          'Agendar horário',
          'Cliente quer marcar, agendar, reservar um horário, consulta, reunião ou atendimento',
          'CALENDAR',
          NULL,
          false, NOW(), NOW()
        ),
        (
          'int_' || replace(gen_random_uuid()::text, '-', ''),
          agent_id,
          'Cancelar agendamento',
          'Cliente quer cancelar, desmarcar ou desistir de um horário ou agendamento já marcado',
          'CALENDAR',
          NULL,
          false, NOW(), NOW()
        ),
        (
          'int_' || replace(gen_random_uuid()::text, '-', ''),
          agent_id,
          'Reagendar horário',
          'Cliente quer mudar, remarcar ou trocar a data ou horário de um agendamento existente',
          'CALENDAR',
          NULL,
          false, NOW(), NOW()
        );

      RAISE NOTICE 'CREATED agente % para workspace %', agent_id, ws.name;
    END IF;
  END LOOP;
END $$;
