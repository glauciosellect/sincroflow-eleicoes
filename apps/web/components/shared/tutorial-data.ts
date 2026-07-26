// Conteúdo do Tutorial (menu dedicado, card flutuante) — separado do MascoteHelper
// (FAQ rápido) porque aqui o formato é mais longo: introdução de vendas +
// explicação do funcionamento do próprio tutorial + passos no formato
// Menu / Para que serve / Como configurar / Dica / Detalhes de uso.

export const TUTORIAL_INTRO = {
  title: 'Bem-vindo(a) ao SyncroFlowEleições',
  content: `Imagina sua campanha respondendo eleitores 24 horas por dia, todos os dias, sem que você precise estar no celular o tempo todo. Imagina sua equipe de campo sabendo exatamente onde estão seus apoiadores, seus indecisos e onde vale a pena bater na porta. Imagina nunca mais perder um pedido, uma reclamação ou uma oportunidade de voto porque a mensagem "ficou pra depois".

É exatamente isso que o **SyncroFlowEleições** faz. Não é só um chatbot — é um sistema completo de campanha: um assistente de IA que atende seus eleitores no WhatsApp (e em breve Instagram e Facebook), Telegram e e-mail; um CRM que organiza cada contato, cada conversa, cada pedido; ferramentas para sua equipe de campo registrar pesquisa de voto e mapear apoiadores em tempo real; relatórios que mostram exatamente o que está funcionando; e muito mais — tudo em um só lugar, sempre dentro das regras do TSE.

Você não precisa ser expert em tecnologia para usar. Este tutorial foi feito para pegar sua mão e te levar, passo a passo, por cada parte do sistema — desde cadastrar sua história até colocar sua equipe inteira trabalhando de forma organizada.

**Como funciona este tutorial:**
- Ele tem vários passos, na ordem que faz mais sentido configurar o sistema pela primeira vez.
- Você pode **arrastar esta janela** segurando no topo e movendo para o lado — assim dá para deixar o tutorial aberto de um lado da tela e ir fazendo as configurações no sistema do outro lado, sem uma tela cobrir a outra.
- Use o botão no canto superior direito para **aumentar ou diminuir** a janela, se precisar de mais espaço para ler.
- Use os botões **Anterior / Próximo** para navegar, ou clique direto nas bolinhas do rodapé para pular para qualquer passo.
- Pode fechar a qualquer momento e continuar depois de onde parou.
- Sempre que quiser rever algo rápido, o mascote no canto da tela também responde perguntas frequentes.

Vamos começar? Clique em **Próximo**.`,
}

export interface TutorialStep {
  step: number
  menu: string
  title: string
  whatIsItFor: string
  howToConfigure: string
  tip?: string
  moreDetails?: string
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    menu: 'Minha História e Propostas',
    title: 'Conte sua história ao assistente',
    whatIsItFor: 'É a base de tudo: o conteúdo que você cadastrar aqui é o que o assistente de IA vai usar para conversar com seus eleitores. Sem isso preenchido, o assistente não tem o que responder.',
    howToConfigure: 'No menu lateral, clique em **Minha História e Propostas**. Preencha sua trajetória (quem você é, sua carreira, sua motivação para a candidatura) e cadastre suas propostas por tema (Saúde, Educação, Segurança, etc.).',
    tip: 'Quanto mais detalhada a proposta (o quê, como vai ser feito, prazo), mais precisa é a resposta do assistente ao eleitor. Propostas vagas geram respostas vagas — e eleitor percebe.',
    moreDetails: 'O assistente **nunca inventa** informação que não está cadastrada aqui. Se um eleitor perguntar sobre um tema que você não cadastrou, ele vai dizer educadamente que vai encaminhar a dúvida para a equipe — em vez de arriscar uma resposta errada.',
  },
  {
    step: 2,
    menu: 'Minha História e Propostas → Disclaimer',
    title: 'Personalizar o disclaimer',
    whatIsItFor: 'É a mensagem de apresentação do seu assistente — a primeira coisa que o eleitor lê quando começa a conversar. Também é uma exigência legal do TSE.',
    howToConfigure: 'Na aba **Disclaimer**, dentro de Minha História e Propostas, edite a Parte B (o tom de voz e a saudação). A Parte A é fixa por exigência da Resolução TSE nº 23.755/2026 e não pode ser removida: o assistente sempre precisa se identificar como virtual na primeira interação.',
    tip: 'Use a Parte B para deixar sua marca — um cumprimento caloroso, algo que soe como a sua campanha.',
    moreDetails: 'Essa identificação protege você juridicamente: o eleitor sempre sabe que está falando com um assistente virtual, nunca com o candidato em pessoa, evitando qualquer questionamento sobre propaganda enganosa.',
  },
  {
    step: 3,
    menu: 'Minha História e Propostas → Plataforma Eleitoral',
    title: 'Montar sua Plataforma Eleitoral',
    whatIsItFor: 'É o documento oficial e completo do seu plano de governo — mais formal e detalhado que as propostas por tema, é o que dá consistência e profundidade às respostas do assistente sobre seu projeto político como um todo.',
    howToConfigure: 'Dentro de **Minha História e Propostas**, abra a aba **Plataforma Eleitoral**. Escreva (ou peça ajuda da IA para estruturar) seu plano de governo completo: diagnóstico, eixos de atuação e metas para o mandato.',
    tip: 'Pense nela como o documento que você entregaria a um jornalista que pedisse "me mostra seu plano de governo completo" — é esse nível de profundidade.',
    moreDetails: 'Ela complementa as propostas por tema: enquanto as propostas respondem perguntas pontuais do eleitor, a Plataforma Eleitoral dá ao assistente o contexto geral do seu projeto, para respostas mais coerentes entre si.',
  },
  {
    step: 4,
    menu: 'Minha História e Propostas → Configuração',
    title: 'Assistente por Voz — respostas em áudio',
    whatIsItFor: 'Deixa o atendimento mais próximo e acessível para eleitores que preferem ouvir a ler, ou que têm dificuldade de leitura.',
    howToConfigure: 'Em **Minha História e Propostas → Configuração**, ative a opção de responder por áudio.',
    tip: 'Com essa opção ativa, o formato de resposta passa a espelhar automaticamente o que o eleitor manda: se ele manda áudio, recebe áudio; se manda texto, recebe texto.',
    moreDetails: 'O eleitor também pode fixar manualmente sua preferência a qualquer momento, mandando a palavra **#texto** ou **#audio** na conversa.',
  },
  {
    step: 5,
    menu: 'Configurações → Perfil',
    title: 'Completar seu Perfil',
    whatIsItFor: 'São os seus dados básicos de candidato (nome, número, partido, cargo, foto, cidade/estado) — usados em vários lugares do sistema: no Portal do Eleitor, nos Criativos gerados pela IA e nas respostas do assistente.',
    howToConfigure: 'Vá em **Configurações → Perfil** e preencha nome de urna, número, partido, cargo pretendido, foto oficial e cidade/estado da candidatura.',
    tip: 'Capriche na foto — ela aparece automaticamente no Portal do Eleitor e é usada pelo Editor de Criativos para montar santinhos e artes.',
    moreDetails: 'Esse cadastro também define seu **cargo pretendido** (Vereador, Deputado, Senador, Governador...), que muda o comportamento de outras partes do sistema, como o agrupamento do Mapa de Apoiadores por bairro ou por cidade.',
  },
  {
    step: 6,
    menu: 'Configurações → Canais',
    title: 'Conectar seus canais de atendimento',
    whatIsItFor: 'É onde você liga o assistente aos canais reais por onde os eleitores vão falar com você: WhatsApp, e-mail, Telegram e (em breve) Instagram/Facebook. Sem conectar pelo menos um canal, o sistema não tem como enviar nem receber mensagens de verdade.',
    howToConfigure: `Vá em **Configurações → Canais**. Você vai encontrar duas formas de ativar o WhatsApp:

**Número próprio**: você já tem um WhatsApp Business e quer usar ele. Clique em "WhatsApp (número próprio)", faça login com a conta do Facebook vinculada, escolha o número e confirme com o código enviado por SMS. Esse número passa a ser gerenciado pela API oficial da Meta, o que libera o atendimento automático 24h.

**Número novo (Salvy)**: se você não tem (ou não quer usar) um número próprio, o sistema contrata uma linha nova para você automaticamente. Depois de solicitar, chega um código por SMS na tela — digite o código e a linha é ativada sozinha em poucos minutos.`,
    tip: 'Durante o período gratuito, que vai até **20/08/26**, só é possível ativar o **número próprio**. A linha nova (Salvy) só fica disponível para contratação depois que a licença de uso é paga. Depois do pagamento, você pode comprar quantas linhas quiser (próprias ou novas) para aumentar sua capacidade de atendimento — cada linha ativa conta para o seu limite de WhatsApp do plano.',
    moreDetails: `**E-mail**: conecte uma conta Gmail para o assistente responder e-mails de eleitores automaticamente, do mesmo jeito que responde no WhatsApp — inclusive anexando Criativos quando fizer sentido. É opcional.

**Telegram**: conecte um bot do Telegram para atender por lá também. Sem limite de mensagens em 24h, diferente do WhatsApp.

**Instagram e Facebook**: já estão prontos no sistema, mas dependem de uma aprovação da própria Meta (o dono do Instagram/Facebook) que ainda está em análise. Assim que for aprovado, esses dois canais serão liberados **sem nenhum custo extra** para você — é um bônus que já vem incluído na sua licença.`,
  },
  {
    step: 7,
    menu: 'Criativos',
    title: 'Cadastrar Criativos (Santinho Digital)',
    whatIsItFor: 'É o seu material de divulgação digital — imagens, vídeos e PDFs que o assistente envia automaticamente para eleitores interessados em temas específicos, e que você também pode disparar em massa.',
    howToConfigure: 'No menu **Criativos**, faça upload de imagens, vídeos ou PDFs e vincule cada um a um tema (ex: Saúde, Educação). Quando um eleitor perguntar sobre aquele tema, o assistente já anexa o material na resposta, sem você precisar enviar manualmente.',
    tip: 'Tenha pelo menos um criativo genérico (santinho com número e foto) além dos temáticos — ele serve para pedidos gerais, quando o eleitor só quer "o material da campanha".',
    moreDetails: 'Use o **Editor Visual de Criativos** (botão dentro do mesmo menu) para gerar santinhos, stories e banners profissionais em minutos, com a IA já preenchendo seu nome, número, partido e foto automaticamente — sem precisar de um designer.',
  },
  {
    step: 8,
    menu: 'Criativos → Disparo em massa',
    title: 'Disparar Criativos em massa (Broadcast)',
    whatIsItFor: 'Permite avisar vários eleitores de uma vez sobre uma novidade, evento ou material novo — sem precisar mandar mensagem um por um.',
    howToConfigure: 'Selecione um criativo na biblioteca, escolha o canal (WhatsApp, e-mail ou Telegram) e o público. Se você tem **mais de uma linha de WhatsApp ativa**, um segundo campo aparece perguntando qual linha específica deve enviar aquele disparo — ou você pode deixar em "distribuir automaticamente", e o sistema divide os envios entre todas as linhas disponíveis para reduzir o risco de bloqueio.',
    tip: 'Nunca importe listas externas ou compradas para broadcast — isso viola as políticas da Meta e pode banir seu número permanentemente. Use só sua base de contatos que já interagiu.',
    moreDetails: 'O envio é limitado por segurança (até 500 contatos por disparo, 250 por linha de WhatsApp a cada 24h). Escolher uma linha específica é útil, por exemplo, quando uma linha é dedicada a uma região ou público diferente da outra.',
  },
  {
    step: 9,
    menu: 'Configurações → Integrações',
    title: 'Conectar a Agenda (Google Calendar)',
    whatIsItFor: 'Permite que o assistente informe automaticamente seus compromissos públicos quando um eleitor perguntar sobre agenda de eventos — sem você precisar responder isso manualmente toda vez.',
    howToConfigure: 'Vá em **Configurações → Integrações** e conecte sua conta do **Google Calendar**.',
    tip: 'Mantenha só os compromissos públicos da campanha nessa agenda — tudo que estiver lá pode ser informado a qualquer eleitor que perguntar.',
    moreDetails: 'É uma integração só de **leitura**: o assistente nunca cria, altera ou cancela eventos por conta própria, nem tem permissão para isso. Ele apenas lê o que a sua equipe já cadastrou na agenda e usa essa informação para responder perguntas como "quando é o próximo evento?" ou "você vai estar no bairro X essa semana?".',
  },
  {
    step: 10,
    menu: 'Chat',
    title: 'Monitorar pelo Chat',
    whatIsItFor: 'É onde você acompanha, em tempo real, todas as conversas entre o assistente e os eleitores — e pode intervir pessoalmente quando quiser.',
    howToConfigure: 'Abra o menu **Chat** para ver a lista de conversas. Clique em qualquer uma para responder manualmente (o assistente para de responder aquele contato até você devolver o atendimento), marcar como **Urgente**, ou remover a urgência.',
    tip: 'O assistente já marca uma conversa como urgente sozinho quando detecta reclamação forte ou pedido explícito de contato humano — fique de olho nos alertas do Dashboard.',
    moreDetails: 'Alertas urgentes aparecem destacados no Dashboard, com um botão de X para você dispensar depois de tratados.',
  },
  {
    step: 11,
    menu: 'Solicitações',
    title: 'Acompanhar Solicitações',
    whatIsItFor: 'Garante que nenhum pedido ou reclamação de eleitor se perca — cada uma vira um protocolo rastreável para sua equipe resolver.',
    howToConfigure: 'No menu **Solicitações**, veja a lista de pedidos e reclamações que o assistente já registrou automaticamente durante as conversas. Atualize o status (Em análise, Resolvido, etc.) conforme sua equipe for tratando cada uma.',
    moreDetails: 'Cada solicitação recebe um número de protocolo único, que o eleitor pode usar para consultar o andamento diretamente pelo WhatsApp, só digitando o número.',
  },
  {
    step: 12,
    menu: 'Relatórios',
    title: 'Analisar Relatórios',
    whatIsItFor: 'Mostra os números da sua campanha em tempo real — quantas conversas, quais temas mais perguntados, como está a intenção de voto — para você tomar decisões com dados, não só intuição.',
    howToConfigure: 'No menu **Relatórios**, clique no ícone de expandir (⊠) em qualquer card para abrir o relatório detalhado, com um seletor de período próprio e botão **Gerar PDF**.',
    tip: 'São 10 relatórios ao todo — vale explorar todos pelo menos uma vez para saber o que cada um oferece.',
    moreDetails: 'Inclui desde volume de conversas e temas mais perguntados até a pesquisa de intenção de voto coletada pelos seus agentes de campo em tempo real.',
  },
  {
    step: 13,
    menu: 'Discurso de Palanque',
    title: 'Discurso de Palanque com IA',
    whatIsItFor: 'Gera discursos personalizados em minutos, prontos para eventos de campanha, com base no que você já cadastrou sobre si e suas propostas.',
    howToConfigure: 'No menu **Discurso de Palanque**, escolha o tema, o tom (entusiasta, técnico, emocional) e o público-alvo. A IA gera o discurso completo, que você pode editar e exportar como PDF.',
    tip: 'Você pode abrir discursos salvos anteriormente para reaproveitar e adaptar para um novo evento, sem começar do zero toda vez.',
    moreDetails: 'Como usa sua história e propostas já cadastradas, o discurso sai com a sua "voz" — não é um texto genérico.',
  },
  {
    step: 14,
    menu: 'Radar Político',
    title: 'Radar de Notícias',
    whatIsItFor: 'Mantém você por dentro do que está sendo falado sobre sua campanha e sua região, para nunca ser pego de surpresa.',
    howToConfigure: 'Abra o menu **Radar Político** para ver as notícias relevantes monitoradas pela IA, sobre sua campanha e sua área de atuação.',
    moreDetails: 'Use os temas em alta para antecipar perguntas difíceis dos eleitores e ajustar seus posicionamentos com mais segurança.',
  },
  {
    step: 15,
    menu: 'Portal do Eleitor',
    title: 'Portal do Eleitor — sua página pública',
    whatIsItFor: 'Cria uma vitrine pública e profissional da sua campanha na internet — um link único que você pode divulgar nas redes sociais, no WhatsApp e onde mais quiser, para captar novos apoiadores e recolher cadastros direto no seu funil de atendimento.',
    howToConfigure: 'No menu **Portal do Eleitor**, personalize sua página: foto de destaque, foto de fundo, número, trajetória (uma linha do tempo com ano e descrição de cada conquista) e depoimentos de apoiadores. Depois de salvar, você recebe um link público (formato `app.syncrofloweleicoes.com.br/eleitor/seu-nome`) pronto para divulgar.',
    tip: 'Se você ainda **não tem site próprio de campanha**, o Portal resolve isso: é gratuito, já vem pronto e profissional, e você pode colocar esse link como o "site oficial" da sua campanha em qualquer lugar — inclusive no seu perfil de Instagram e Facebook.',
    moreDetails: 'Para fazer uma página perfeita: use uma foto de rosto nítida e bem iluminada, preencha a trajetória com pelo menos 3 a 4 marcos importantes da sua história, e peça depoimentos curtos e específicos de apoiadores reais — isso gera muito mais confiança do que texto genérico. Todo cadastro feito por um visitante no Portal entra automaticamente na sua base de contatos, já dentro do funil de atendimento do assistente.',
  },
  {
    step: 16,
    menu: 'Meu Desempenho',
    title: 'Pesquisa de Intenção de Voto',
    whatIsItFor: 'Transforma sua equipe de rua em uma fonte de dados real sobre a intenção de voto — sem precisar contratar pesquisa cara e demorada.',
    howToConfigure: 'Agentes de campo acessam **Meu Desempenho** e registram cada eleitor pesquisado: nome, telefone, CEP (o sistema já preenche bairro e cidade sozinho) e a intenção de voto (Apoiador, Indeciso ou Crítico).',
    tip: 'Em chapas com coligação, também dá para registrar preferências por outros cargos (Vereador, Deputado, Senador, Governador, Presidente) na mesma pesquisa.',
    moreDetails: 'Todo esse dado alimenta o Mapa de Apoiadores e os relatórios — quanto mais pesquisa registrada, mais preciso fica o retrato da sua campanha.',
  },
  {
    step: 17,
    menu: 'Mapa de Apoiadores',
    title: 'Mapa de Apoiadores',
    whatIsItFor: 'Mostra visualmente, num mapa, onde estão concentrados seus apoiadores, indecisos e críticos — para você decidir onde investir esforço de campanha.',
    howToConfigure: 'Abra o menu **Mapa de Apoiadores**. Cada círculo no mapa representa um bairro ou cidade: o tamanho mostra o volume de pessoas e a cor mostra a intenção predominante.',
    tip: 'Para candidatos a Vereador, o mapa agrupa por bairro; para Deputados, Senadores, Governadores e Presidente, agrupa por cidade — a granularidade certa para cada escala de campanha.',
    moreDetails: 'Filtre por 7, 30, 60 ou 90 dias para acompanhar a evolução da sua base de apoio ao longo do tempo, não só a foto do momento.',
  },
  {
    step: 18,
    menu: 'Consultor de Fatos',
    title: 'Consultor de Fatos com IA',
    whatIsItFor: 'Ajuda sua equipe de campo a responder com segurança quando um eleitor traz um boato ou dúvida — sem espalhar desinformação nem ficar sem resposta.',
    howToConfigure: 'No menu **Consultor de Fatos**, cole a dúvida ou boato que o eleitor trouxe. A IA analisa com base em fontes públicas (TSE, IBGE, legislação, veículos reconhecidos) e devolve um veredicto (Verdadeiro, Falso, Parcialmente verdadeiro ou Inconclusivo), uma análise e uma resposta pronta para usar.',
    tip: 'Salve as respostas mais usadas na **Biblioteca** para reaproveitar rapidamente quando a mesma dúvida aparecer de novo — e ela sempre aparece de novo.',
    moreDetails: 'É uma ferramenta pensada para o agente em campo, no meio de uma conversa — resposta rápida, confiável e pronta para usar na hora.',
  },
  {
    step: 19,
    menu: 'Equipe',
    title: 'Adicionar Equipe',
    whatIsItFor: 'Permite trazer sua equipe de campanha para dentro do sistema, cada um com o nível de acesso adequado à sua função — sem que todo mundo tenha o mesmo acesso administrativo.',
    howToConfigure: 'No menu **Equipe**, convide colaboradores pelo e-mail deles e escolha o papel de cada um: **Administrador** (acesso total), **Atendimento** (Chat e Solicitações), **Conteúdo** (Criativos, Discurso, Portal), **Relatórios** (só visualização de números), ou **Agente de Campo** (acessa só Meu Desempenho e Consultor de Fatos, sem ver o painel administrativo).',
    tip: 'Use papéis restritos por padrão — dê acesso de Administrador só para quem realmente precisa gerenciar o sistema inteiro.',
    moreDetails: 'Esse controle de acesso (RBAC) protege a campanha: cada pessoa vê e faz só o que precisa, sem risco de mexer em algo que não deveria, mesmo em equipes grandes.',
  },
  {
    step: 20,
    menu: 'Equipe → Coordenadores',
    title: 'Coordenadores de Campo — por que importam',
    whatIsItFor: 'Coordenadores são a camada de supervisão entre você e os agentes de campo. Eles existem para que você não precise acompanhar cada agente individualmente — em campanhas com muitos agentes de rua, isso é o que mantém a operação organizada e escalável.',
    howToConfigure: 'Em **Equipe → Coordenadores**, cadastre os coordenadores que vão supervisionar grupos de agentes. Depois, vincule cada coordenador à equipe dele (quais agentes ele supervisiona) no painel administrativo.',
    tip: 'Cada coordenador acessa um painel próprio (em **Meu Desempenho**, com visão de supervisão), mostrando só o desempenho da equipe dele: check-ins, ranking semanal e atividade — sem acesso ao restante do sistema.',
    moreDetails: 'Na prática, o coordenador é quem cobra o agente que sumiu, elogia quem está indo bem e reporta a você um resumo, em vez de você precisar olhar dezenas de agentes um por um.',
  },
  {
    step: 21,
    menu: 'Equipe → Líderes',
    title: 'Gestor de Líderes — por que importa',
    whatIsItFor: 'Líderes de comunidade são pessoas influentes num bairro ou território que apoiam sua campanha e ajudam a mobilizar votos ali. O Gestor de Líderes é o CRM que organiza esse trabalho: quem são, onde atuam, que meta têm e o quanto estão realmente engajados — informação que, sem sistema, se perde em conversa de WhatsApp e planilha solta.',
    howToConfigure: 'Em **Equipe → Líderes**, cadastre cada líder, defina o território (bairro) em que ele atua e uma meta de votos. O sistema calcula sozinho um **score de atividade semanal**, somando pesquisas registradas, check-ins e contatos feitos por aquele líder.',
    tip: 'Líderes com mais de 7 dias sem atividade aparecem com alerta vermelho — use isso para saber exatamente quem precisa de um empurrão, uma ligação ou uma cobrança direta.',
    moreDetails: 'O ranking completo ajuda a identificar seus melhores líderes de campo com dados reais (não só impressão pessoal) — para decidir onde investir mais tempo, recursos e confiança dentro da estrutura da campanha.',
  },
  {
    step: 22,
    menu: 'E-mail (automático)',
    title: 'Relatórios Semanais Automáticos',
    whatIsItFor: 'Entrega um resumo da sua campanha direto na sua caixa de entrada, sem você precisar entrar no sistema toda semana para saber como está indo.',
    howToConfigure: 'Não precisa configurar nada — toda **segunda-feira às 8h**, o briefing semanal chega automaticamente por e-mail para você, coordenadores e líderes.',
    tip: 'Coordenadores recebem o resumo da equipe deles (ativos, inativos, cadastros, pesquisas); líderes recebem o desempenho individual, com posição no ranking e progresso da meta.',
    moreDetails: 'É uma forma de manter todo mundo engajado e informado, mesmo quem não tem o hábito de abrir o painel com frequência.',
  },
  {
    step: 23,
    menu: 'Configurações → Compliance TSE',
    title: 'Acompanhar Compliance TSE',
    whatIsItFor: 'Garante que sua campanha está sempre dentro das regras do TSE, sem você precisar decorar prazos e resoluções.',
    howToConfigure: 'Em **Configurações → Compliance TSE**, veja quando o assistente será desativado automaticamente — sempre 72h antes de cada turno de votação, conforme exige a Resolução TSE nº 23.755/2026.',
    moreDetails: 'Depois da eleição, o painel administrativo continua disponível normalmente para análises e fechamento financeiro — só o atendimento automático ao eleitor é suspenso no prazo legal.',
  },
  {
    step: 24,
    menu: 'Configurações → Financeiro',
    title: 'Prestação de Contas e Financeiro',
    whatIsItFor: 'É onde você controla o dinheiro da campanha para a prestação de contas ao TSE, e também onde você ativa/paga o seu plano no SyncroFlowEleições.',
    howToConfigure: 'Em **Configurações → Financeiro**, lance receitas e despesas usando as categorias TSE para garantir conformidade. Para ativar seu plano, escolha seu cargo (Deputado Estadual, Federal ou Senador/Governador) e pague via Pix ou cartão.',
    tip: 'Seu cadastro já libera acesso imediato ao sistema — mas os módulos completos (WhatsApp com IA, broadcasts, relatórios avançados) só ficam liberados de vez depois que o pagamento é confirmado, ou até o fim do período gratuito em 20/08/26.',
    moreDetails: 'A liberação após o pagamento é automática, geralmente em minutos — não precisa aguardar nenhuma aprovação manual.',
  },
  {
    step: 25,
    menu: 'Gabinete',
    title: 'Gabinete — depois da eleição',
    whatIsItFor: 'É a continuidade do sistema após a eleição, para quem se elege: organiza demandas de eleitores, agenda do mandato e acompanhamento pós-campanha, reaproveitando toda a base de contatos já construída.',
    howToConfigure: 'O menu **Gabinete** fica disponível para uso após o período eleitoral, dando sequência ao relacionamento com sua base de eleitores e apoiadores dentro das mesmas ferramentas que você já usou na campanha.',
    moreDetails: 'Todo o histórico de conversas, solicitações e contatos da campanha continua acessível — nada se perde na transição para o mandato.',
  },
  {
    step: 26,
    menu: 'Todo o sistema',
    title: 'Você está pronto para começar',
    whatIsItFor: 'Este é o resumo do que você acabou de aprender — e o convite para colocar tudo em prática.',
    howToConfigure: 'Revise os passos anteriores na ordem: história e propostas, disclaimer, plataforma eleitoral, canais conectados, criativos, e depois relatórios, discurso, equipe e ferramentas de campo. Cada peça que você configura deixa sua campanha mais forte e mais organizada.',
    tip: 'Não precisa fazer tudo em um dia só. Comece pelo essencial (passos 1 a 6) para o assistente já começar a atender, e vá voltando aqui para configurar o resto com calma.',
    moreDetails: 'Sempre que tiver dúvida, o mascote no canto da tela responde perguntas rápidas, e você pode reabrir este tutorial completo a qualquer momento pelo menu **Tutorial**. Boa campanha! 🇧🇷',
  },
]
