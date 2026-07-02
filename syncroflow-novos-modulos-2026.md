# SyncroFlow Eleições — Plano de Implementação: Novos Módulos 2026

**Versão:** 1.0  
**Data:** 02/07/2026  
**Metodologia:** Um módulo por vez → commit → push → deploy Vercel → próximo módulo  
**Prazo:** Implantação completa antes do período eleitoral 2026

---

## Contexto e Stack

Este documento é a especificação técnica para o Claude Code implementar 8 novos módulos no SyncroFlow Eleições. Leia os arquivos existentes antes de iniciar cada módulo para entender o padrão atual do projeto.

**Stack assumida:**
- Next.js 14+ com App Router, TypeScript
- Prisma ORM + PostgreSQL (Supabase ou Neon)
- shadcn/ui + Tailwind CSS
- Vercel (deploy)
- Stripe (pagamentos)
- OpenAI GPT-4o (IA)
- Autenticação: NextAuth ou sistema próprio JWT

**Antes de iniciar:** Ler e mapear:
- `/prisma/schema.prisma` — entender todas as tabelas existentes
- `/src/app/` — estrutura de rotas e layouts
- `/src/components/` — componentes reutilizáveis
- `/src/lib/` — utilitários, helpers, integrações existentes
- Variáveis de ambiente: `.env.example` ou `.env.local`

---

## Ordem de Execução

| # | Módulo | Prioridade | Complexidade |
|---|--------|-----------|--------------|
| M1 | Portal do Eleitor | 🔴 Crítico | Média |
| M2 | Área do Coordenador | 🔴 Crítico | Média |
| M3 | Resultados Eleitorais TSE | 🟠 Alto | Média |
| M4 | Criação de Conteúdo com IA | 🟠 Alto | Baixa |
| M5 | Radar Político + Social | 🟡 Médio | Alta |
| M6 | Controle Financeiro | 🟡 Médio | Média |
| M7 | Gabinete 360 (Mandato) | 🟢 Mandato | Alta |
| M8 | Pricing + Stripe | 🔵 Final | Baixa |

---

## MÓDULO 1 — Portal do Eleitor

### Objetivo
Página pública personalizada por candidato onde eleitores se cadastram, enviam mensagens e expressam apoio — sem precisar do WhatsApp. Funciona como landing page de captação de leads eleitorais.

### URL
`/eleitor/[slug]` — completamente pública, sem autenticação

### Prisma Schema (adicionar ao schema.prisma existente)

```prisma
model PortalEleitor {
  id             String    @id @default(cuid())
  contratante_id String    @unique
  slug           String    @unique  // Ex: "joao-silva-deputado"
  titulo         String    // "Fale com João Silva"
  subtitulo      String?   // "Deputado Federal pelo Ceará"
  descricao      String?   // Texto de boas-vindas
  foto_url       String?   // Foto do candidato
  cor_primaria   String    @default("#1a56db")
  cor_secundaria String    @default("#ffffff")
  whatsapp_link  String?   // Link direto wa.me (opcional)
  ativo          Boolean   @default(true)
  total_cadastros Int      @default(0)
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  cadastros      CadastroPortal[]
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt
}

model CadastroPortal {
  id         String        @id @default(cuid())
  portal_id  String
  nome       String
  telefone   String
  email      String?
  cidade     String?
  bairro     String?
  assunto    String?       // "Saúde", "Educação", "Segurança", etc.
  mensagem   String?       @db.Text
  status     String        @default("novo")  // novo, contatado, arquivado
  origem_ip  String?
  eleitor_id String?       // FK para tabela eleitores (se já existir)
  portal     PortalEleitor @relation(fields: [portal_id], references: [id])
  created_at DateTime      @default(now())

  @@index([portal_id, status])
  @@index([portal_id, created_at])
}
```

### Rodar migração
```bash
npx prisma migrate dev --name add_portal_eleitor
```

### API Routes a criar

**`/src/app/api/portal/[slug]/route.ts`**
```
GET — retorna dados públicos do portal (sem dados sensíveis do contratante)
```

**`/src/app/api/portal/[slug]/cadastro/route.ts`**
```
POST — recebe o form, salva CadastroPortal, cria/atualiza Eleitor, 
       dispara WhatsApp de boas-vindas se SAE ativo, retorna { success: true }
Rate limit: max 3 submissões por IP por hora
```

**`/src/app/api/painel/portal/route.ts`** (autenticado)
```
GET — retorna config do portal do contratante logado
PUT — atualiza configurações (titulo, cor, foto, etc.)
```

**`/src/app/api/painel/portal/cadastros/route.ts`** (autenticado)
```
GET — lista cadastros com filtros: status, cidade, data_inicio, data_fim, busca
    — suporta paginação: ?page=1&limit=20
    — suporta exportação: ?export=csv
```

**`/src/app/api/painel/portal/cadastros/[id]/route.ts`** (autenticado)
```
PUT — atualiza status (contatado, arquivado)
```

### Página Pública: `/src/app/eleitor/[slug]/page.tsx`

**Layout:**
- Header: foto do candidato (circular, 120px) + nome + cargo/partido
- Formulário com os campos:
  - Nome completo* (obrigatório)
  - WhatsApp* (obrigatório, máscara (99) 9 9999-9999)
  - Cidade (select ou texto)
  - Bairro (texto)
  - Assunto (select): Saúde | Educação | Segurança | Infraestrutura | Emprego | Outro
  - Mensagem (textarea, opcional, max 500 chars)
  - Botão: "Enviar Mensagem"
- Após submissão: tela de agradecimento com animação de check verde
- Footer: "Atendido por SyncroFlow | Serviço de Atendimento ao Eleitor"
- Cor de destaque: `cor_primaria` do portal
- 100% responsivo, mobile-first

**SEO:**
```tsx
export async function generateMetadata({ params }) {
  const portal = await getPortalBySlug(params.slug)
  return {
    title: portal.titulo,
    description: portal.descricao || `Fale diretamente com ${portal.titulo}`,
    openGraph: { images: [portal.foto_url] }
  }
}
```

**Se portal inativo ou slug não existe:** página 404 customizada com mensagem amigável.

### Painel do Candidato (área logada)

**Localização sugerida:** `/src/app/painel/portal/page.tsx`

**Aba "Configurar":**
- Preview em tempo real do portal enquanto edita
- Campos: Título, Subtítulo, Descrição, Foto (upload), Cor primária (color picker)
- Toggle ativar/desativar portal
- Link copiável: `https://syncrofloweleicoes.com.br/eleitor/[slug]`
- Botão "Gerar QR Code" para impressão em material gráfico

**Aba "Cadastros":**
- Tabela: Nome | Telefone | Cidade | Assunto | Data | Status | Ações
- Filtros: Status (todos/novo/contatado/arquivado), Cidade, Data
- Ação por linha: "Marcar como Contatado" | "Arquivar" | "Abrir no WhatsApp"
- Botão "Exportar CSV"
- Contador: "X novos cadastros" destacado em badge

### Integração com SAE (WhatsApp)
Ao receber novo cadastro via portal:
```typescript
// Após salvar CadastroPortal, verificar se candidato tem WhatsApp ativo
const numero = await db.numerosWhatsapp.findFirst({
  where: { contratante_id, status: 'ativo', is_primary: true }
})
if (numero) {
  await enviarMensagemBoasVindas(numero, cadastro.telefone, candidato.nome)
}
```

### Commit deste módulo
```bash
git add .
git commit -m "feat(M1): Portal do Eleitor - página pública de captação e gestão no painel"
git push origin main
# → Aguardar deploy Vercel → testar /eleitor/[slug-teste]
```

---

## MÓDULO 2 — Área do Coordenador

### Objetivo
Portal separado com login próprio para coordenadores regionais (cabos eleitorais, líderes de zona). Cada coordenador acessa apenas sua cidade/bairro. Cadastra líderes e eleitores. Sem acesso a financeiro, WhatsApp, Radar ou estratégia.

### Prisma Schema

```prisma
model Coordenador {
  id             String      @id @default(cuid())
  contratante_id String
  nome           String
  telefone       String?
  email          String      @unique
  senha_hash     String
  cidade         String?     // Restrição automática de visualização
  bairros        String[]    // Vazio = acessa todos os bairros da cidade
  meta_votos     Int?        // Meta atribuída pelo candidato
  ativo          Boolean     @default(true)
  ultimo_acesso  DateTime?
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt

  @@index([contratante_id, ativo])
}

model CheckInLider {
  id              String      @id @default(cuid())
  lider_id        String      // FK para tabela de líderes existente
  coordenador_id  String
  contratante_id  String
  tipo            String      // "visita", "ligacao", "reuniao", "evento"
  observacao      String?
  data_checkin    DateTime    @default(now())
  coordenador     Coordenador @relation(fields: [coordenador_id], references: [id])
  created_at      DateTime    @default(now())
}
```

### Migração
```bash
npx prisma migrate dev --name add_coordenadores
```

### Rotas e Autenticação

**Autenticação separada do painel principal.**

`/src/app/coordenador/login/page.tsx` — tela de login simples (email + senha)

`/src/app/api/coordenador/auth/login/route.ts`
```
POST — verifica email+senha, gera JWT com { coordenador_id, contratante_id, cidade, bairros }
       Token separado do JWT do candidato (prefixo diferente ou issuer diferente)
```

Middleware `/src/middleware.ts` — proteger rotas `/coordenador/*` com validação do JWT de coordenador.

### API Routes do Coordenador

Todas as rotas abaixo sob `/src/app/api/coordenador/`:
```
GET  /dashboard         — totais: meus_lideres, meus_eleitores, minha_meta, % atingido
GET  /lideres           — lista líderes da cidade/bairro do coordenador (filtro automático)
POST /lideres           — cadastrar novo líder (cidade/bairro limitado ao do coordenador)
GET  /lideres/[id]      — detalhe do líder
PUT  /lideres/[id]      — atualizar líder
POST /lideres/[id]/checkin — registrar visita/check-in
GET  /eleitores         — lista eleitores vinculados aos seus líderes
POST /eleitores         — cadastrar eleitor (vinculado a um dos seus líderes)
GET  /metas             — metas atribuídas e progresso
```

**Filtro de segurança obrigatório em TODAS as queries:**
```typescript
// Em cada query, sempre aplicar:
where: {
  contratante_id: coordenador.contratante_id,
  cidade: coordenador.cidade ?? undefined,
  // Se bairros definidos:
  ...(coordenador.bairros.length > 0 && { bairro: { in: coordenador.bairros } })
}
```

### UI do Coordenador

**`/coordenador/` — Dashboard mobile-first**
- Topo: "Olá, [Nome]" + data
- Cards grandes: Total de Líderes | Total de Eleitores | Minha Meta | % Atingido
- Lista rápida: "Últimos cadastros" (5 mais recentes)
- Botão flutuante (+): "Novo Líder" ou "Novo Eleitor"

**`/coordenador/lideres`**
- Lista com busca, botão "Cadastrar Líder"
- Cada item: nome, bairro, qtd eleitores do líder, último check-in
- Toque → abre detalhe com botão "Registrar Visita"

**`/coordenador/eleitores`**
- Lista de eleitores, vinculado ao líder
- Formulário de cadastro: nome, telefone, endereço, líder responsável

**PWA — instalar como app no celular:**
Adicionar `/public/manifest.json`:
```json
{
  "name": "SyncroFlow Coordenador",
  "short_name": "Coord.",
  "start_url": "/coordenador",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a56db",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```
Adicionar no `<head>` da área coordenador: `<link rel="manifest" href="/manifest.json">`

### Painel do Candidato — Gestão de Coordenadores

**`/painel/equipe/coordenadores`**
- Tabela: Nome | Cidade | Bairros | Meta | Líderes Cadastrados | Último Acesso | Status
- Botão "Novo Coordenador": modal com nome, email, senha temporária, cidade, bairros, meta
- Ação: Ativar/Desativar, Editar, Ver relatório de atividade
- Relatório de atividade: check-ins por período, cadastros realizados

### Commit
```bash
git add .
git commit -m "feat(M2): Área do Coordenador - portal mobile com auth separada e gestão de equipe"
git push origin main
# → Deploy → testar /coordenador/login com usuário criado no painel
```

---

## MÓDULO 3 — Resultados Eleitorais TSE

### Objetivo
Importar resultados eleitorais do TSE (2022 e 2024) e cruzar com a base atual do candidato. Mostrar onde ele tem força, onde precisa crescer, e projetar estimativa de votos com base nos dados reais.

### Fonte dos dados (pública e gratuita)
- URL base TSE: `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/`
- Arquivos: `votacao_candidato_munzona_2024_BR.csv` e `votacao_candidato_munzona_2022_BR.csv`
- Criar script de seed para importação inicial

### Prisma Schema

```prisma
model ResultadoTSE {
  id              String   @id @default(cuid())
  ano             Int      // 2022 ou 2024
  turno           Int      // 1 ou 2
  cargo           String   // "DEPUTADO ESTADUAL", "DEPUTADO FEDERAL", "SENADOR", "GOVERNADOR"
  uf              String   // "CE", "SP", etc.
  municipio       String
  municipio_tse   String   // Código IBGE do município
  partido         String
  numero_urna     Int
  candidato_nome  String
  candidato_cpf   String?
  votos           Int
  percentual      Float?
  situacao        String?  // "ELEITO", "NÃO ELEITO", etc.
  created_at      DateTime @default(now())

  @@unique([ano, turno, cargo, uf, municipio_tse, numero_urna])
  @@index([ano, uf, cargo])
  @@index([candidato_cpf])
}

model MetaVotosContratante {
  id              String      @id @default(cuid())
  contratante_id  String      @unique
  votos_meta      Int         @default(0)   // Meta definida pelo candidato
  votos_lideres   Int         @default(0)   // Soma das estimativas dos líderes
  votos_campanha  Int         @default(0)   // Estimativa do sistema (algoritmo)
  percentual_meta Float       @default(0)
  atualizado_em   DateTime    @updatedAt
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
}
```

### Script de Importação

**Criar `/scripts/import-tse-data.ts`**
```typescript
// Baixa os CSVs do TSE, parseia e faz upsert no banco
// Filtrar somente: DEPUTADO ESTADUAL, DEPUTADO FEDERAL, SENADOR, GOVERNADOR
// Mapeamento de colunas do CSV do TSE para o schema acima
// Executar: npx ts-node scripts/import-tse-data.ts
// Tempo estimado: ~5-10 min (arquivos grandes)
// Filtrar por UF dos contratantes ativos para reduzir volume
```

Campos do CSV TSE (2024): `DS_CARGO`, `NM_MUNICIPIO`, `CD_MUNICIPIO`, `SG_UF`, `NR_TURNO`, `NR_ANO_ELEICAO`, `SG_PARTIDO`, `NR_CANDIDATO`, `NM_CANDIDATO`, `NM_CPF_CANDIDATO`, `QT_VOTOS_NOMINAIS`, `PC_VOTOS_NOMINAIS_VALIDOS`, `DS_SIT_TOT_TURNO`

### API Routes

```
GET /api/painel/resultados-tse
    ?ano=2024&cargo=DEPUTADO_FEDERAL&uf=CE&municipio=FORTALEZA
    — retorna lista de candidatos com votos por município

GET /api/painel/resultados-tse/comparativo
    — cruzamento: meus eleitores captados por município vs. resultado real 2024

GET /api/painel/projecao-votos
    — retorna MetaVotosContratante atual

PUT /api/painel/projecao-votos
    body: { votos_meta: 15000 }
    — atualiza meta do candidato, recalcula percentual

GET /api/painel/resultados-tse/mapa
    — dados agregados por município para overlay no mapa
```

### UI — Integração no Dashboard

**Widget "Estimativa de Votos" no dashboard principal:**
```
┌─────────────────────────────────────┐
│ 🎯 Meta: 15.000      Progresso: 8.1%│
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│ Estimativa Líderes: 3.065           │
│ Estimativa Campanha: 1.222          │
└─────────────────────────────────────┘
```
Botão "Definir Meta" abre modal para atualizar `votos_meta`.

**Aba "Resultado 2024" no Mapa de Atuação:**
- Toggle: "Exibir Resultado 2024"
- Overlay de cor no mapa por município (verde = ganhou, vermelho = perdeu, cinza = não concorreu)
- Ao clicar no município: popup com "Resultado 2024: X votos (Y%)" + "Eleitores captados: Z"
- Tabela comparativa abaixo do mapa: Município | Votos 2024 | Líderes Atuais | Eleitores Captados | Diferença

### Commit
```bash
git add .
git commit -m "feat(M3): Resultados Eleitorais TSE - histórico 2022/2024, mapa comparativo e projeção de votos"
git push origin main
# → Executar script de importação no banco de produção
# → Deploy → validar dados no mapa
```

---

## MÓDULO 4 — Criação de Conteúdo com IA

### Objetivo
Gerador de posts para redes sociais por tema político. Ilimitado (diferencial vs. LideraAI que limita 10/semana). Com agendamento direto via Telegram broadcast da plataforma.

### Prisma Schema

```prisma
model ConteudoIA {
  id              String      @id @default(cuid())
  contratante_id  String
  tema            String      // "saude", "educacao", "seguranca", etc.
  tema_customizado String?    // Quando tema = "personalizado"
  plataforma      String      // "instagram", "facebook", "tiktok", "telegram", "linkedin", "x"
  tom             String      @default("proximo")  // formal, proximo, emotivo
  texto_gerado    String      @db.Text
  hashtags        String[]
  prompt_usado    String      @db.Text
  status          String      @default("rascunho")  // rascunho, agendado, enviado, arquivado
  agendado_para   DateTime?
  enviado_em      DateTime?
  canal_envio     String?     // "telegram_broadcast", "manual"
  tokens_usados   Int?        // Controle de custo
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  created_at      DateTime    @default(now())

  @@index([contratante_id, status])
  @@index([contratante_id, created_at])
}
```

### Temas disponíveis (alinhados com Plataforma Política existente)
```typescript
export const TEMAS_POLITICOS = [
  { id: 'saude', label: 'Saúde', icon: '🏥' },
  { id: 'educacao', label: 'Educação', icon: '📚' },
  { id: 'seguranca', label: 'Segurança Pública', icon: '🛡️' },
  { id: 'infraestrutura', label: 'Infraestrutura', icon: '🏗️' },
  { id: 'meio_ambiente', label: 'Meio Ambiente', icon: '🌿' },
  { id: 'emprego', label: 'Emprego e Economia', icon: '💼' },
  { id: 'cultura', label: 'Cultura', icon: '🎭' },
  { id: 'esporte', label: 'Esporte', icon: '⚽' },
  { id: 'transporte', label: 'Transporte', icon: '🚌' },
  { id: 'assistencia_social', label: 'Assistência Social', icon: '🤝' },
  { id: 'tecnologia', label: 'Tecnologia e Inovação', icon: '💡' },
  { id: 'juventude', label: 'Juventude', icon: '🧑' },
  { id: 'terceira_idade', label: 'Terceira Idade', icon: '👴' },
  { id: 'mulheres', label: 'Direitos das Mulheres', icon: '♀️' },
  { id: 'lgbtqia', label: 'Direitos LGBTQIA+', icon: '🏳️‍🌈' },
  { id: 'personalizado', label: 'Tema Personalizado', icon: '✏️' },
]
```

### Limites por plataforma
```typescript
export const LIMITES_CARACTERES = {
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  telegram: 4096,
  linkedin: 3000,
  x: 280,
}
```

### API Routes

**`/api/painel/conteudo-ia/gerar` — POST (autenticado)**
```typescript
// body: { tema, tema_customizado?, plataforma, tom }
// 1. Buscar dados do contratante (nome, cargo, partido, posicionamento político)
// 2. Montar prompt
// 3. Chamar OpenAI GPT-4o
// 4. Salvar no banco como status "rascunho"
// 5. Retornar { texto, hashtags, id }
```

**Prompt template:**
```
Você é um especialista em comunicação política brasileira.

Crie um post para {plataforma} sobre o tema "{tema_label}" para:
- Candidato/Político: {nome_candidato}
- Cargo: {cargo}
- Partido: {partido}
- UF: {uf}

Posicionamento político (de acordo com seu perfil): {posicionamento_ia}
Tom desejado: {tom}
Limite máximo de caracteres: {limite}

Regras obrigatórias:
- NÃO mencione "campanha eleitoral", "vote em mim" ou similares
- NÃO ataque adversários pelo nome
- Foque em propostas e realizações concretas
- Use linguagem adequada para {plataforma}
- Seja autêntico e próximo do eleitor

Retorne SOMENTE um JSON válido:
{
  "texto": "texto completo do post",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}
```

**`/api/painel/conteudo-ia` — GET**
```
?status=rascunho|agendado|enviado
?plataforma=instagram|telegram|...
?page=1&limit=20
```

**`/api/painel/conteudo-ia/[id]/agendar` — POST**
```typescript
// body: { agendado_para: DateTime }
// Se canal_envio = "telegram_broadcast": agenda job no sistema de filas
// Atualiza status para "agendado"
```

**`/api/painel/conteudo-ia/[id]` — DELETE**
```
Apenas para status "rascunho" ou "agendado" (não enviado)
```

### UI

**`/painel/conteudo/criar` — Criador passo a passo**

**Passo 1 — Escolher tema:**
Grid de cards com ícone + label (ver lista acima). Um toque seleciona.
Se "Tema Personalizado": campo de texto livre aparece abaixo.

**Passo 2 — Escolher plataforma:**
Botões com logo: Instagram | Facebook | TikTok | Telegram | LinkedIn | X

**Passo 3 — Tom:**
3 opções como chips: Formal | Próximo | Emotivo

**Botão "Gerar Conteúdo"** — loading com animação (~3-5 segundos)

**Resultado:**
- Caixa de texto editável com o conteúdo gerado
- Chips de hashtags (copiáveis individualmente)
- Contador de caracteres com a cor do limite da plataforma
- Botões: "Copiar Texto" | "Regenerar" | "Agendar no Telegram" | "Salvar Rascunho"

**"Agendar no Telegram"** abre modal:
- Datepicker + timepicker
- Confirmação: "Será enviado para X inscritos no Telegram"

**`/painel/conteudo` — Histórico**
- Tabs: Rascunhos | Agendados | Enviados
- Cada item: tema, plataforma, data, status, preview truncado
- Ações: Editar | Copiar | Agendar | Excluir | Ver completo

### Commit
```bash
git add .
git commit -m "feat(M4): Criação de Conteúdo com IA - gerador ilimitado por tema e agendamento Telegram"
git push origin main
# → Verificar OPENAI_API_KEY no ambiente Vercel
# → Testar geração de post para cada plataforma
```

---

## MÓDULO 5 — Radar Político + Radar Social

### Objetivo
Monitoramento automático de (a) adversários e pautas nas redes/notícias e (b) sentimento sobre o próprio candidato. Alertas em tempo real + resumo semanal com sugestão de contra-narrativa gerada por IA.

### Fontes de dados
- **Google Alerts via RSS** — gratuito, sem API key, confiável
  - URL: `https://www.google.com/alerts/feeds/{hash}/{hash}`
  - Candidato configura os alertas no Google e cola o URL RSS no painel
- **Twitter/X API v2** — busca pública (Free tier: 500k tweets/mês)
  - Bearer Token nas variáveis de ambiente
- **Web scraping** (opcional, fase 2) — Playwright para páginas públicas

### Prisma Schema

```prisma
model RadarMonitorado {
  id             String      @id @default(cuid())
  contratante_id String
  tipo           String      // "adversario" | "proprio" | "tema" | "palavra_chave"
  nome           String      // Ex: "João Adversário" ou "saúde pública Ceará"
  rss_url        String?     // URL do Google Alerts RSS
  twitter_query  String?     // Query para Twitter API Ex: "from:adversario OR #adversario"
  plataformas    String[]    // ["google_alerts", "twitter", "instagram"]
  ativo          Boolean     @default(true)
  ultima_coleta  DateTime?
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  resultados     RadarResultado[]
  created_at     DateTime    @default(now())

  @@index([contratante_id, ativo])
}

model RadarResultado {
  id             String          @id @default(cuid())
  radar_id       String
  contratante_id String
  plataforma     String          // "google_alerts", "twitter", "instagram"
  tipo           String          // "post", "noticia", "mencao", "retweet"
  titulo         String?
  texto          String          @db.Text
  url            String?
  autor          String?
  engajamento    Int?            // Likes + retweets + comentários
  sentimento     String?         // "positivo", "negativo", "neutro" — classificado por IA
  relevancia     Int             @default(0)  // 0-100 — calculado por IA
  lido           Boolean         @default(false)
  alerta_gerado  Boolean         @default(false)  // Já gerou notificação?
  radar          RadarMonitorado @relation(fields: [radar_id], references: [id])
  coletado_em    DateTime        @default(now())

  @@index([radar_id, lido])
  @@index([contratante_id, relevancia])
  @@index([coletado_em])
}

model ResumoRadar {
  id             String      @id @default(cuid())
  contratante_id String
  periodo_inicio DateTime
  periodo_fim    DateTime
  tipo           String      // "diario", "semanal"
  resumo_texto   String      @db.Text   // Gerado por IA
  principais_alertas Json   // Array dos top 5 resultados do período
  sugestao_acao  String?     @db.Text   // Contra-narrativa sugerida
  enviado        Boolean     @default(false)
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  created_at     DateTime    @default(now())
}
```

### Jobs em Background (usar Vercel Cron Jobs)

**`/api/cron/radar-coleta` — a cada 6 horas**
```typescript
// 1. Buscar todos RadarMonitorado ativos
// 2. Para cada um:
//    a. Se tem rss_url: buscar RSS, parsear, filtrar novos itens
//    b. Se tem twitter_query: buscar Twitter API v2
// 3. Salvar novos RadarResultado
// 4. Classificar sentimento + relevância via GPT-4o-mini (mais barato)
// 5. Se relevância > 75: criar alerta de notificação (push/email/WhatsApp)
```

**`/api/cron/radar-resumo-diario` — todo dia às 7h**
```typescript
// Gerar ResumoRadar do dia anterior
// Enviar para candidato (WhatsApp ou email configurado)
```

**`/api/cron/radar-resumo-semanal` — toda segunda às 8h**
```typescript
// Gerar ResumoRadar da semana
// Incluir sugestão de contra-narrativa
```

**Configurar no `vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/radar-coleta", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/radar-resumo-diario", "schedule": "0 7 * * *" },
    { "path": "/api/cron/radar-resumo-semanal", "schedule": "0 8 * * 1" }
  ]
}
```

### Prompt de classificação (GPT-4o-mini)
```
Analise este conteúdo em relação à campanha de {nome_candidato}, {cargo}.

Retorne JSON:
{
  "sentimento": "positivo|negativo|neutro",
  "relevancia": 0-100,
  "motivo": "uma linha explicando"
}

Relevância alta (>70): ataques diretos, fake news, mobilização contra, viralização alta.
Relevância média (40-70): menções gerais, pautas relacionadas.
Relevância baixa (<40): ruído genérico.

Conteúdo: {texto}
```

### API Routes

```
GET /api/painel/radar                          — lista RadarMonitorados do contratante
POST /api/painel/radar                         — criar novo monitoramento
PUT /api/painel/radar/[id]                     — editar ou ativar/desativar
DELETE /api/painel/radar/[id]

GET /api/painel/radar/resultados               — feed de resultados (paginado)
    ?tipo=adversario|proprio&sentimento=negativo&lido=false&page=1
PUT /api/painel/radar/resultados/[id]/lido    — marcar como lido

GET /api/painel/radar/resumos                  — histórico de resumos
POST /api/painel/radar/contra-narrativa        — gerar sugestão para um resultado específico
    body: { resultado_id: string }
```

### UI

**`/painel/radar` — Dashboard do Radar**

**Aba "Alertas":**
- Feed de cards com: fonte (ícone Twitter/Google), autor, preview do texto, sentimento (chip colorido: 🟢🔴⚪), relevância (barra), data
- Filtros: todos / não lido / adversário / próprio / negativo
- Badge de contador de alertas não lidos no menu lateral
- Botão em cada card: "Gerar Contra-Narrativa" → chama API e abre modal com sugestão de post

**Aba "Configurar Monitoramento":**
- Lista de radares ativos
- Botão "Adicionar" → modal:
  - Tipo: Adversário | Monitorar Próprio Nome | Palavra-chave
  - Nome/Query
  - Plataformas a monitorar (checkboxes)
  - Se Google Alerts: campo para colar URL do RSS (com instrução de como criar)

**Aba "Resumos":**
- Cards de resumo diário/semanal
- Preview do texto resumo + top alertas do período
- Botão "Ver Completo"

### Commit
```bash
git add .
git commit -m "feat(M5): Radar Político e Social - monitoramento automático, alertas e contra-narrativa IA"
git push origin main
# → Verificar TWITTER_BEARER_TOKEN no ambiente Vercel (se disponível)
# → Verificar crons funcionando no Vercel
```

---

## MÓDULO 6 — Controle Financeiro de Campanha (Premium)

### Objetivo
O melhor sistema financeiro de campanha do mercado político brasileiro. Vai além de registrar receitas e despesas — entrega inteligência financeira: projeção de saldo até o dia da eleição, custo por voto estimado, alerta de burn rate, validação automática de limites de doação por CPF, QR Pix para receber doações, aprovação de pagamentos por tesoureiro, e exportação completa para prestação de contas TSE.

**Diferenciais exclusivos vs. LideraAI e todos os concorrentes:**
- IA projeta se o dinheiro vai acabar antes da eleição (burn rate)
- Custo por voto estimado em tempo real
- QR Pix para doações online com link público compartilhável
- Validação automática do limite de doação por CPF (TSE)
- Perfil de Tesoureiro com fluxo de aprovação de gastos
- Orçamento por categoria com alertas de estouro
- Registro rápido mobile (foto do recibo + valor = 10 segundos)

---

### Prisma Schema

```prisma
model ContaFinanceira {
  id              String      @id @default(cuid())
  contratante_id  String
  nome            String      // "Conta Especial Eleitoral — BB", "Caixa Geral"
  banco           String?
  agencia         String?
  conta           String?
  tipo            String      // "especial_eleitoral", "corrente", "digital", "caixa"
  saldo_inicial   Float       @default(0)
  ativo           Boolean     @default(true)
  principal       Boolean     @default(false)  // Conta Especial Eleitoral obrigatória TSE
  pix_key         String?     // Chave Pix para recebimento de doações
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  lancamentos     LancamentoFinanceiro[]
  created_at      DateTime    @default(now())

  @@index([contratante_id])
}

model Fornecedor {
  id              String      @id @default(cuid())
  contratante_id  String
  nome            String
  cnpj_cpf        String?
  telefone        String?
  email           String?
  pix_key         String?
  categoria       String?
  banco           String?
  agencia         String?
  conta_bancaria  String?
  observacao      String?
  ativo           Boolean     @default(true)
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  lancamentos     LancamentoFinanceiro[]
  created_at      DateTime    @default(now())
}

model LancamentoFinanceiro {
  id                String          @id @default(cuid())
  contratante_id    String
  conta_id          String
  tipo              String          // "receita" | "despesa"
  categoria         String
  subcategoria      String?
  descricao         String
  valor             Float
  data_lancamento   DateTime
  data_efetiva      DateTime?
  status            String          @default("pendente")  // pendente, aprovado, pago, cancelado, atrasado
  requer_aprovacao  Boolean         @default(false)  // true se valor > limite configurado
  aprovado_por      String?         // ID do tesoureiro que aprovou
  aprovado_em       DateTime?
  comprovante_url   String?
  comprovante_tipo  String?         // "nota_fiscal", "recibo", "contrato", "foto"
  fornecedor_id     String?
  doador_nome       String?
  doador_cpf        String?         // Validado contra limite TSE por CPF
  doador_telefone   String?
  link_pix_id       String?         // FK para LinkDoacaoPix se veio de doação online
  centro_custo      String?         // "Zona Norte", "Redes Sociais", "Eventos", etc.
  regiao            String?         // Para análise de gasto por região
  observacoes       String?         @db.Text
  tags              String[]
  conta             ContaFinanceira @relation(fields: [conta_id], references: [id])
  fornecedor        Fornecedor?     @relation(fields: [fornecedor_id], references: [id])
  contratante       Contratante     @relation(fields: [contratante_id], references: [id])
  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt

  @@index([contratante_id, tipo, status])
  @@index([contratante_id, data_lancamento])
  @@index([doador_cpf])
}

model OrcamentoCategoria {
  id              String      @id @default(cuid())
  contratante_id  String
  categoria       String
  valor_orcado    Float
  periodo_inicio  DateTime
  periodo_fim     DateTime    // Normalmente = data da eleição
  alerta_em       Float       @default(80)  // Alerta quando atingir X% do orçado
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  created_at      DateTime    @default(now())

  @@unique([contratante_id, categoria])
}

model LinkDoacaoPix {
  id              String      @id @default(cuid())
  contratante_id  String
  titulo          String      // "Apoie a campanha do João"
  descricao       String?
  valor_sugerido  Float?      // Sugestão de valor (opcional)
  valor_minimo    Float?
  valor_maximo    Float?      // Limite por doação (TSE: por CPF)
  url_slug        String      @unique  // /doar/joao-silva-2026
  ativo           Boolean     @default(true)
  total_arrecadado Float      @default(0)
  total_doacoes   Int         @default(0)
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  doacoes         DoacaoOnline[]
  created_at      DateTime    @default(now())
}

model DoacaoOnline {
  id              String        @id @default(cuid())
  link_id         String
  contratante_id  String
  doador_nome     String
  doador_cpf      String
  doador_email    String?
  doador_telefone String?
  valor           Float
  pix_txid        String?       // ID da transação Pix (integração futura)
  status          String        @default("pendente")  // pendente, confirmado, cancelado
  confirmado_em   DateTime?
  link            LinkDoacaoPix @relation(fields: [link_id], references: [id])
  created_at      DateTime      @default(now())

  @@index([contratante_id, status])
  @@index([doador_cpf])
}

model TesoureiroCampanha {
  id              String      @id @default(cuid())
  contratante_id  String
  nome            String
  cpf             String
  email           String      @unique
  senha_hash      String
  telefone        String?
  limite_aprovacao Float      @default(0)   // Pode aprovar despesas até este valor
  ativo           Boolean     @default(true)
  ultimo_acesso   DateTime?
  contratante     Contratante @relation(fields: [contratante_id], references: [id])
  created_at      DateTime    @default(now())
}

model ProjecaoFinanceira {
  id                  String      @id @default(cuid())
  contratante_id      String      @unique
  data_eleicao        DateTime
  saldo_atual         Float
  receitas_previstas  Float       // Doações comprometidas ainda não recebidas
  despesas_previstas  Float       // Contratos assinados ainda não pagos
  burn_rate_diario    Float       // Média de gasto por dia (últimos 30 dias)
  dias_ate_eleicao    Int
  saldo_projetado     Float       // saldo_atual + receitas_previstas - despesas_previstas
  saldo_dia_eleicao   Float       // saldo_projetado - (burn_rate_diario × dias_ate_eleicao)
  custo_por_voto      Float?      // total_gasto / eleitores_captados
  alerta_nivel        String      @default("verde")  // verde, amarelo, vermelho
  mensagem_alerta     String?
  calculado_em        DateTime    @default(now())
  contratante         Contratante @relation(fields: [contratante_id], references: [id])
}
```

### Migração
```bash
npx prisma migrate dev --name add_financeiro_premium
```

---

### Categorias e Subcategorias (alinhadas TSE 2026)

```typescript
export const CATEGORIAS_FINANCEIRO = {
  // RECEITAS
  receitas: {
    'Doação de Pessoa Física': ['Dinheiro', 'Pix', 'Transferência', 'Cheque'],
    'Recurso Próprio do Candidato': ['Dinheiro', 'Pix', 'Transferência'],
    'Fundo Eleitoral (FEFC)': ['Transferência do Partido'],
    'Recurso do Partido': ['Transferência', 'Custeio Direto'],
    'Financiamento Coletivo': ['Plataforma Online', 'Link de Doação SyncroFlow'],
    'Outros Recursos Permitidos': ['Especificar'],
  },

  // DESPESAS
  despesas: {
    'Material Gráfico e Impresso': ['Santinhos', 'Banners', 'Adesivos', 'Camisetas', 'Brindes'],
    'Publicidade e Redes Sociais': ['Impulsionamento', 'Produção de Conteúdo', 'Agência'],
    'Combustível e Transporte': ['Gasolina', 'Aluguel de Veículo', 'Frete', 'Passagem'],
    'Alimentação': ['Eventos', 'Equipe', 'Reuniões'],
    'Aluguel e Infraestrutura': ['Comitê', 'Palco', 'Som e Iluminação', 'Tendas'],
    'Pessoal e Serviços': ['Cabos Eleitorais', 'Assessoria', 'Fotógrafo', 'Design'],
    'Tecnologia': ['Software', 'Domínio', 'Servidor', 'SyncroFlow'],
    'Eventos e Comícios': ['Organização', 'Segurança', 'Decoração'],
    'Doação ao Partido': ['Transferência'],
    'Pesquisa Eleitoral': ['Instituto', 'Pesquisa Própria'],
    'Jurídico e Contábil': ['Advogado Eleitoral', 'Contador'],
    'Outros': ['Especificar'],
  },
}

// Limite TSE 2026 para doação por CPF (atualizar conforme Resolução vigente)
// Deputado Estadual: R$ 1.064,10 por CPF
// Deputado Federal: R$ 1.064,10 por CPF
// Senador: R$ 1.064,10 por CPF
// Governador: limite maior — verificar TSE 2026
export const LIMITE_DOACAO_POR_CPF: Record<string, number> = {
  'DEPUTADO_ESTADUAL': 106410,  // em centavos
  'DEPUTADO_FEDERAL':  106410,
  'SENADOR':           106410,
  'GOVERNADOR':        212820,  // verificar
}
```

---

### API Routes

**Dashboard e Projeção:**
```
GET /api/painel/financeiro/dashboard
    Retorna:
    {
      saldo_atual: float,
      a_receber: float,
      a_pagar: float,
      saldo_projetado: float,
      atrasados: { count, total },
      burn_rate_diario: float,
      dias_ate_eleicao: int,
      saldo_dia_eleicao: float,       // ← projeção até a eleição
      custo_por_voto: float,          // ← diferencial exclusivo
      alerta_nivel: verde|amarelo|vermelho,
      mensagem_alerta: string,        // IA gera essa mensagem
      fluxo_mensal: [{ mes, entradas, saidas, saldo }],
      despesas_categoria: [{ categoria, valor, percentual, orcado, alerta }],
      top_fornecedores: [{ nome, total_pago }],
      arrecadacao_semana: float,
    }
```

**Lançamentos:**
```
GET    /api/painel/financeiro/lancamentos
       ?tipo=receita|despesa
       ?status=pendente|aprovado|pago|atrasado
       ?categoria=...
       ?data_inicio=...&data_fim=...
       ?page=1&limit=20&export=csv|pdf

POST   /api/painel/financeiro/lancamentos
       — Validação automática: se tipo=receita e doador_cpf fornecido,
         checar soma de doações deste CPF contra limite TSE

PUT    /api/painel/financeiro/lancamentos/[id]
DELETE /api/painel/financeiro/lancamentos/[id]

POST   /api/painel/financeiro/lancamentos/[id]/comprovante
       — Upload (multipart/form-data), aceita imagem ou PDF

POST   /api/painel/financeiro/lancamentos/[id]/aprovar
       — Apenas Tesoureiro autorizado. Valida que valor <= tesoureiro.limite_aprovacao
       — Muda status de "pendente" para "aprovado"

POST   /api/painel/financeiro/lancamentos/[id]/pagar
       — Marca como "pago", registra data_efetiva
```

**Registro rápido mobile (diferencial):**
```
POST /api/painel/financeiro/lancamentos/rapido
     body: { foto_base64, valor, descricao_rapida }
     — Salva comprovante, cria lançamento como despesa pendente de categorização
     — IA (GPT-4o-mini) tenta categorizar automaticamente pela descrição
     — Retorna o lançamento criado para o usuário confirmar/ajustar
```

**Contas bancárias:**
```
GET/POST   /api/painel/financeiro/contas
PUT/DELETE /api/painel/financeiro/contas/[id]
GET        /api/painel/financeiro/contas/saldos   — saldo calculado de cada conta
```

**Fornecedores:**
```
GET/POST   /api/painel/financeiro/fornecedores
PUT/DELETE /api/painel/financeiro/fornecedores/[id]
GET        /api/painel/financeiro/fornecedores/[id]/historico
```

**Orçamento:**
```
GET/POST /api/painel/financeiro/orcamento
PUT      /api/painel/financeiro/orcamento/[categoria]
GET      /api/painel/financeiro/orcamento/alertas   — categorias que ultrapassaram X%
```

**Doações online (Link Pix):**
```
GET/POST  /api/painel/financeiro/link-doacao
PUT       /api/painel/financeiro/link-doacao/[id]
GET       /api/painel/financeiro/link-doacao/[id]/doacoes
POST      /api/doacao/[slug]              — recebe doação pública (sem auth)
GET       /api/doacao/[slug]              — retorna dados públicos do link (sem auth)
POST      /api/doacao/[slug]/confirmar    — webhook Pix (quando integrar gateway)
```

**Tesoureiro:**
```
GET/POST  /api/painel/financeiro/tesoureiro
PUT       /api/painel/financeiro/tesoureiro/[id]
GET       /api/painel/financeiro/tesoureiro/pendentes  — aprovações aguardando
```

**Exportação e Relatórios:**
```
GET /api/painel/financeiro/exportar/tse
    ?ano=2026
    — CSV formato SPCE do TSE para prestação de contas

GET /api/painel/financeiro/exportar/csv
    ?tipo=receita|despesa|todos&periodo=...

GET /api/painel/financeiro/exportar/pdf
    — Relatório completo em PDF (usa biblioteca pdfmake ou Puppeteer)

GET /api/painel/financeiro/relatorio/doadores
    — Lista de doadores com CPF, total doado, alertas de limite TSE

GET /api/painel/financeiro/relatorio/cpf/[cpf]
    — Histórico completo de um CPF: quantas doações, total, margem restante
```

**Projeção IA:**
```
POST /api/painel/financeiro/projecao/recalcular
     — Recalcula ProjecaoFinanceira com base nos dados atuais
     — Gera mensagem de alerta via IA se necessário

GET  /api/painel/financeiro/projecao
     — Retorna última projeção calculada
```

---

### Lógica de Inteligência Financeira

**1. Projeção até o dia da eleição (rodar diariamente via cron)**
```typescript
async function recalcularProjecao(contratante_id: string) {
  const dataEleicao = await getDataEleicao(contratante_id)
  const diasAteEleicao = diferencaDias(new Date(), dataEleicao)

  // Burn rate = média de gasto por dia nos últimos 30 dias
  const burnRateDiario = await calcularBurnRate(contratante_id, 30)

  // Saldo atual real
  const saldoAtual = await calcularSaldoAtual(contratante_id)

  // Receitas comprometidas (doações prometidas, partido pendente)
  const receitasPrevistas = await somarLancamentosPendentes(contratante_id, 'receita')

  // Despesas comprometidas (contratos assinados não pagos)
  const despesasPrevistas = await somarLancamentosPendentes(contratante_id, 'despesa')

  const saldoProjetado = saldoAtual + receitasPrevistas - despesasPrevistas
  const saldoDiaEleicao = saldoProjetado - (burnRateDiario * diasAteEleicao)

  // Custo por voto = total gasto / eleitores captados
  const totalGasto = await somarGastoTotal(contratante_id)
  const eleitoresCaptados = await contarEleitores(contratante_id)
  const custoPorVoto = eleitoresCaptados > 0 ? totalGasto / eleitoresCaptados : null

  // Nível de alerta
  let alertaNivel = 'verde'
  let mensagemAlerta = null
  if (saldoDiaEleicao < 0) {
    alertaNivel = 'vermelho'
    const diasAteZero = Math.floor(saldoProjetado / burnRateDiario)
    // IA gera mensagem personalizada:
    mensagemAlerta = await gerarMensagemAlertaIA({
      saldoAtual, burnRateDiario, diasAteEleicao, diasAteZero, custoPorVoto
    })
  } else if (saldoDiaEleicao < burnRateDiario * 14) {
    alertaNivel = 'amarelo'
    mensagemAlerta = `Reserva para apenas ${Math.floor(saldoDiaEleicao / burnRateDiario)} dias extras após a eleição.`
  }

  await db.projecaoFinanceira.upsert({ where: { contratante_id }, ... })
}
```

**Prompt IA para mensagem de alerta:**
```
Você é o consultor financeiro da campanha de {nome_candidato}.

Dados atuais:
- Saldo disponível: R$ {saldoAtual}
- Gasto médio diário: R$ {burnRateDiario}
- Dias até a eleição: {diasAteEleicao}
- Saldo projetado no dia da eleição: R$ {saldoDiaEleicao}
- Custo por voto atual: R$ {custoPorVoto}

{se saldoDiaEleicao < 0}: O dinheiro acaba em {diasAteZero} dias, {X} dias antes da eleição.

Escreva uma mensagem de alerta direta e objetiva (máximo 2 frases) para o candidato,
sem drama mas clara sobre a urgência. Inclua uma sugestão prática de ação imediata.
```

**2. Validação de limite de doação por CPF**
```typescript
async function validarLimiteDoacaoCPF(
  contratante_id: string,
  cpf: string,
  valorNovo: Float
): Promise<{ permitido: boolean; totalAtual: Float; limite: Float; margem: Float }> {
  const cargo = await getCargo(contratante_id)
  const limite = LIMITE_DOACAO_POR_CPF[cargo]

  const totalAtual = await db.lancamentoFinanceiro.aggregate({
    where: { contratante_id, doador_cpf: cpf, tipo: 'receita', status: { not: 'cancelado' } },
    _sum: { valor: true }
  })

  const somaAtual = totalAtual._sum.valor ?? 0
  const margem = limite - somaAtual

  return {
    permitido: (somaAtual + valorNovo) <= limite,
    totalAtual: somaAtual,
    limite,
    margem,
  }
}
// Se não permitido: retornar erro 422 com mensagem clara para o usuário
```

**3. Categorização automática por IA (lançamento rápido)**
```typescript
async function categorizarLancamento(descricao: string): Promise<string> {
  const prompt = `
    Categorize esta despesa de campanha eleitoral em UMA das categorias:
    Material Gráfico | Publicidade Digital | Combustível | Alimentação |
    Aluguel/Infraestrutura | Pessoal/Serviços | Tecnologia | Eventos | Outros

    Despesa: "${descricao}"
    Responda apenas o nome da categoria, sem explicações.
  `
  // GPT-4o-mini para baixo custo
  return await openai.complete(prompt)
}
```

---

### UI — Telas e Componentes

**`/painel/financeiro` — Dashboard principal**

Linha 1 — Cards KPI (5 cards):
```
[Saldo Atual]  [A Receber]  [A Pagar]  [Custo/Voto]  [Burn Rate/Dia]
R$ 55.200      R$ 2.500     R$ 12.019  R$ 4,50        R$ 1.200
```

Linha 2 — Alerta de projeção (condicional):
```
🔴 ATENÇÃO: No ritmo atual, o caixa zera em 34 dias (dia 05/09/2026),
   25 dias antes da eleição. Ação sugerida: antecipar 2 doações comprometidas.
```
(Card vermelho se alerta=vermelho, amarelo se alerta=amarelo, oculto se verde)

Linha 3 — Gráficos lado a lado:
- Esquerda: Gráfico de barras "Entradas × Saídas" por mês (últimos 6 meses)
- Direita: Gráfico pizza "Despesas por categoria" com % e valor

Linha 4 — Mini tabelas:
- "Pendentes de aprovação" (se tiver tesoureiro configurado)
- "Últimos lançamentos" (5 mais recentes)
- "Orçamento por categoria" (barras de progresso com % utilizado)

**`/painel/financeiro/lancamentos` — Gestão de Lançamentos**

Barra superior:
- Tabs: Todos | Receitas | Despesas | Pendentes de Aprovação
- Filtros: Período (DateRangePicker) | Categoria | Status | Conta
- Botões: "Lançamento Rápido 📷" | "Novo Lançamento" | "Exportar"

Tabela:
```
Data | Tipo | Descrição | Categoria | Conta | Valor | Status | Ações
```
- Linha colorida: verde para receita, vermelho para despesa
- Clip de comprovante na linha quando anexado
- Ação inline: Aprovar (se tesoureiro) | Marcar Pago | Ver Comprovante | Editar | Excluir

**Modal "Lançamento Rápido" (mobile):**
- Campo: foto do comprovante (câmera ou galeria)
- Campo: valor (numérico grande, fácil de digitar)
- Campo: descrição curta
- Toggle: Despesa / Receita
- Botão: "Salvar" → IA categoriza em background
- O tesoureiro ou candidato categoriza depois se a IA errar

**Modal "Novo Lançamento" (completo):**
- Tipo: toggle Receita / Despesa
- Categoria + Subcategoria (selects em cascata)
- Descrição
- Valor (com máscara monetária)
- Conta (select das contas cadastradas)
- Data do documento + Data de pagamento (opcional)
- Status: pendente / pago
- Comprovante: upload (aceita foto, PDF)
- Se receita + tipo doação: campos Doador (Nome, CPF) com validação de limite TSE em tempo real
  - Ao digitar CPF: mostra "Total doado por este CPF: R$ X / Limite: R$ Y / Margem: R$ Z"
- Se despesa: campo Fornecedor (select ou digitar novo)
- Tags + Centro de custo + Região (opcionais, expansíveis)
- Observações

**`/painel/financeiro/orcamento` — Orçamento**
- Para cada categoria de despesa: valor orçado para toda a campanha
- Barra de progresso: gasto atual vs. orçado
- Alertas: 🟡 80% atingido | 🔴 100% atingido
- Botão "Redistribuir Orçamento" → modal para ajustar valores

**`/painel/financeiro/doacoes` — Doações Online**

Seção "Link de Doação":
- Criar link público de doação: título, descrição, valor sugerido
- URL gerada: `syncrofloweleicoes.com.br/doar/[slug]`
- QR Code para impressão em material gráfico
- Estatísticas: total arrecadado, número de doadores, valor médio

Página pública `/doar/[slug]`:
- Layout simples e responsivo com nome/foto do candidato
- Formulário: Nome, CPF, Telefone, E-mail (opcional), Valor
- Validação de CPF em tempo real + cálculo do limite TSE
- Instrução de pagamento via Pix (chave da conta especial eleitoral)
- Após confirmar: mensagem "Doação registrada! Após confirmação do Pix, seu nome aparecerá na lista de apoiadores."
- (Confirmação de pagamento: manual no início, automática quando integrar gateway)

**`/painel/financeiro/relatorios` — Relatórios**

Cards de relatório disponíveis:
- "Relatório de Doadores" — lista com CPF, total e status TSE
- "Prestação de Contas TSE" — exporta CSV no formato SPCE
- "Fluxo de Caixa Completo" — PDF com todos os lançamentos
- "Relatório por Região" — gasto por região geográfica
- "Relatório por Fornecedor" — histórico por fornecedor
- "Projeção até a Eleição" — PDF com análise completa da IA

**`/painel/financeiro/contas` — Contas Bancárias**
- Saldo calculado por conta
- Conta Especial Eleitoral destacada (obrigatória TSE)
- Chave Pix por conta para recebimento de doações
- "Adicionar Conta" com campos completos

**`/painel/financeiro/fornecedores` — Fornecedores**
- Cadastro com CNPJ, dados bancários, Pix
- Histórico de pagamentos
- "Novo Fornecedor" diretamente do modal de lançamento

**Portal do Tesoureiro `/tesoureiro-financeiro/`:**
- Login separado (igual ao coordenador, auth JWT próprio)
- Vê APENAS o financeiro: dashboard, lançamentos, aprovações
- Aba "Aprovações Pendentes" — com alertas de push notification
- Aprova ou rejeita despesas com comentário
- Não vê mapa, WhatsApp, radar, eleitores

---

### Cron Jobs

**`/api/cron/financeiro-projecao` — todo dia às 6h:**
```typescript
// Para cada contratante ativo:
// 1. Recalcular ProjecaoFinanceira
// 2. Verificar categorias de orçamento
// 3. Se alerta=vermelho e mudou de ontem: notificar candidato via WhatsApp
// 4. Verificar despesas com data_efetiva passada e status=pendente → marcar atrasado
```

Adicionar ao `vercel.json`:
```json
{ "path": "/api/cron/financeiro-projecao", "schedule": "0 6 * * *" }
```

---

### Commit
```bash
git add .
git commit -m "feat(M6): Controle Financeiro Premium - projeção IA, Pix doações, validação TSE, tesoureiro, orçamento inteligente"
git push origin main
# → Verificar OPENAI_API_KEY (para projeção e categorização)
# → Configurar cron no vercel.json
# → Testar fluxo de doação online em /doar/[slug-teste]
# → Testar validação de limite TSE por CPF
```

---

## MÓDULO 7 — Gabinete 360 (Produto Mandato)

### Objetivo
Módulo exclusivo para políticos eleitos que contratam o produto "Mandato". Gerencia demandas de cidadãos, fiscalizações, ofícios, projetos de lei. IA sugere resposta e gera documentos com um clique.

### Ativação condicional
O menu "Gabinete" só aparece quando `contratante.produto_ativo` inclui `'mandato'`.
No middleware de autorização, verificar essa condição antes de permitir acesso às rotas `/painel/gabinete/*`.

### Adicionar ao model Contratante existente
```prisma
// Adicionar ao model Contratante:
produto_ativo   String[]  @default(["campanha"])  // ["campanha"], ["mandato"], ["campanha", "mandato"]
```

### Prisma Schema

```prisma
model DemandaGabinete {
  id             String      @id @default(cuid())
  contratante_id String
  protocolo      String      @unique  // Gerado automaticamente: "GAB-2026-00001"
  origem         String      // "portal_eleitor", "whatsapp", "presencial", "email", "telefone"
  nome_cidadao   String
  telefone       String?
  email          String?
  cidade         String?
  bairro         String?
  categoria      String      // Saúde, Educação, Infraestrutura, etc.
  descricao      String      @db.Text
  prioridade     String      @default("normal")   // baixa, normal, alta, urgente
  status         String      @default("aberta")   // aberta, em_andamento, respondida, encerrada
  resposta_ia    String?     @db.Text             // Sugestão gerada por IA
  resposta_final String?     @db.Text             // Resposta aprovada e enviada
  prazo          DateTime?
  responsavel_id String?     // ID do Coordenador responsável
  eleitor_id     String?     // FK para eleitor se existir no banco
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  documentos     DocumentoGabinete[]
  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt

  @@index([contratante_id, status, prioridade])
}

model DocumentoGabinete {
  id             String           @id @default(cuid())
  contratante_id String
  demanda_id     String?
  tipo           String           // "oficio", "relatorio_fiscalizacao", "projeto_lei", "protocolo", "nota"
  numero         String?          // Ex: "Ofício Nº 042/2026"
  titulo         String
  destinatario   String?          // Para ofícios
  conteudo       String           @db.Text   // Gerado por IA, editável pelo usuário
  arquivo_url    String?          // PDF gerado após aprovação
  status         String           @default("rascunho")  // rascunho, aprovado, enviado
  demanda        DemandaGabinete? @relation(fields: [demanda_id], references: [id])
  contratante    Contratante      @relation(fields: [contratante_id], references: [id])
  created_at     DateTime         @default(now())
  updated_at     DateTime         @updatedAt
}

model Fiscalizacao {
  id             String      @id @default(cuid())
  contratante_id String
  titulo         String
  local          String
  endereco       String?
  cidade         String?
  tipo           String      // "escola", "posto_saude", "obra_publica", "transporte", "outros"
  data_agendada  DateTime
  data_realizada DateTime?
  status         String      @default("agendada")  // agendada, realizada, cancelada
  relatorio      String?     @db.Text
  fotos_urls     String[]
  coordenador_id String?
  contratante    Contratante @relation(fields: [contratante_id], references: [id])
  created_at     DateTime    @default(now())
}
```

### Geração automática de protocolo
```typescript
async function gerarProtocolo(contratante_id: string): Promise<string> {
  const count = await db.demandaGabinete.count({ where: { contratante_id } })
  const numero = String(count + 1).padStart(5, '0')
  return `GAB-${new Date().getFullYear()}-${numero}`
}
```

### IA no Gabinete

**Ao criar nova demanda — gerar sugestão de resposta + ofício:**
```typescript
// Prompt para GPT-4o:
const prompt = `
Você é assistente de ${nome_candidato}, ${cargo} pelo ${partido} em ${municipio}/${uf}.

Chegou a seguinte demanda de cidadão via ${origem}:
Categoria: ${categoria}
Descrição: ${descricao}

Gere:
1. Uma resposta ao cidadão: empática, objetiva, com previsão de encaminhamento. Máximo 3 parágrafos. Sem promessas vazias.
2. Se pertinente, um esboço de ofício ao órgão competente responsável pela resolução.

Formato de retorno em JSON:
{
  "resposta_cidadao": "texto da resposta",
  "oficio": {
    "pertinente": true/false,
    "destinatario": "Secretaria Municipal de X",
    "assunto": "Encaminhamento de demanda cidadã — [tema]",
    "corpo": "texto do ofício"
  }
}
`
```

### API Routes

```
GET/POST   /api/painel/gabinete/demandas
GET/PUT    /api/painel/gabinete/demandas/[id]
POST       /api/painel/gabinete/demandas/[id]/gerar-resposta-ia
POST       /api/painel/gabinete/demandas/[id]/aprovar-resposta
POST       /api/painel/gabinete/demandas/[id]/enviar-resposta    — envia via WhatsApp/email

GET/POST   /api/painel/gabinete/documentos
GET/PUT    /api/painel/gabinete/documentos/[id]
POST       /api/painel/gabinete/documentos/[id]/gerar-pdf        — gera PDF do documento
GET        /api/painel/gabinete/documentos/[id]/pdf              — download do PDF

GET/POST   /api/painel/gabinete/fiscalizacoes
PUT        /api/painel/gabinete/fiscalizacoes/[id]
POST       /api/painel/gabinete/fiscalizacoes/[id]/concluir

GET /api/painel/gabinete/dashboard
    — retorna: demandas abertas, em_andamento, prazo_vencido, por categoria
```

### UI

**`/painel/gabinete` — Dashboard do Gabinete**
- Cards: Demandas Abertas | Em Andamento | Prazo Vencido | Resolvidas (mês)
- Alertas de prioridade urgente em destaque vermelho
- Lista das 5 demandas mais antigas ainda abertas

**`/painel/gabinete/demandas` — Lista de Demandas**
- Tabela: Protocolo | Cidadão | Categoria | Prioridade | Status | Prazo | Ações
- Filtros: Status, Categoria, Prioridade, Origem
- "Nova Demanda" → modal com campos + botão "Gerar Resposta com IA" (após salvar)
- Detalhe da demanda: histórico de status, resposta IA, campos editáveis, botão "Aprovar e Enviar"

**`/painel/gabinete/documentos` — Documentos**
- Lista por tipo (ofícios, relatórios, projetos de lei)
- Editor de texto rico para editar rascunho gerado pela IA
- Botão "Gerar PDF" — usa Puppeteer ou biblioteca server-side (jsPDF/PDFKit)
- Numeração automática por tipo

**`/painel/gabinete/fiscalizacoes` — Fiscalizações**
- Visão calendário + lista
- Card: "Escola Maria Amélia — Agendada para 18/01/2026"
- Ao concluir: abrir modal para escrever relatório e fazer upload de fotos
- PDF automático de relatório de fiscalização

### Commit
```bash
git add .
git commit -m "feat(M7): Gabinete 360 - demandas cidadãs, documentos com IA e fiscalizações (produto Mandato)"
git push origin main
```

---

## MÓDULO 8 — Pricing + Stripe (executar por último)

### Estrutura de preços corrigida e final

#### 2º turno — Importante
Segundo turno existe SOMENTE para cargos majoritários: **Governador** e **Presidente**.
Deputado Estadual, Deputado Federal e Senador são eleitos por sistema proporcional/maioria simples — **sem segundo turno**.

#### Produto Campanha (pagamento único até 30/09/2026)

| Cargo | Preço Final | Rótulo sugerido |
|-------|-------------|-----------------|
| Deputado Estadual | R$ 4.900 | Até 30/09/2026 |
| Deputado Federal | R$ 7.900 | Até 30/09/2026 |
| Senador | R$ 12.900 | Até 30/09/2026 |
| Governador | R$ 14.900 | Até 30/09/2026 |

#### Add-on 2º Turno (apenas para Governador)

| | Preço |
|-|-------|
| Governador — 2º Turno | +R$ 4.900 |
| Presidente — 2º Turno | Sob consulta (negociação) |

#### Produto Mandato (recorrente mensal)

| Cargo | Preço/mês |
|-------|-----------|
| Deputado Estadual | R$ 1.490/mês |
| Deputado Federal | R$ 2.490/mês |
| Senador | R$ 3.490/mês |
| Governador / Presidente | R$ 4.490/mês |

### Produtos e Preços a criar no Stripe

```typescript
// Executar script stripe-setup.ts:

const produtos = [
  // CAMPANHA — one_time
  { id: 'campanha_dep_estadual', nome: 'SyncroFlow — Dep. Estadual 2026', valor: 490000 },
  { id: 'campanha_dep_federal',  nome: 'SyncroFlow — Dep. Federal 2026',  valor: 790000 },
  { id: 'campanha_senador',      nome: 'SyncroFlow — Senador 2026',       valor: 1290000 },
  { id: 'campanha_governador',   nome: 'SyncroFlow — Governador 2026',    valor: 1490000 },
  // ADD-ON 2º TURNO — one_time
  { id: 'addon_2turno_gov',      nome: 'SyncroFlow — 2º Turno Governador', valor: 490000 },
  // MANDATO — recurring
  { id: 'mandato_dep_estadual',  nome: 'SyncroFlow Mandato — Dep. Estadual', valor: 149000, recorrente: true },
  { id: 'mandato_dep_federal',   nome: 'SyncroFlow Mandato — Dep. Federal',  valor: 249000, recorrente: true },
  { id: 'mandato_senador',       nome: 'SyncroFlow Mandato — Senador',        valor: 349000, recorrente: true },
  { id: 'mandato_governador',    nome: 'SyncroFlow Mandato — Governador/Presidente', valor: 449000, recorrente: true },
]
// Valores em centavos (R$ × 100)
```

### Criar script `/scripts/stripe-setup.ts`
```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Criar produto + price para cada item acima
// Salvar price_ids no .env ou banco de configuração
// Log final com todos os price_ids gerados
```

### Página `/precos` — UI

**Header:**
```
Investimento único para toda a campanha
Plataforma + inteligência + suporte até 30/09/2026
```

**4 cards de campanha (lado a lado, responsivo):**
- Dep. Estadual | Dep. Federal | Senador | Governador
- Badge "Oferta Pré-Convenções" (configurável, pode ser desativado)
- Preço riscado + preço final (se quiser mostrar desconto)
- Lista de itens inclusos
- Botão "Contratar Agora →"

**Nota sobre 2º turno:**
```
* Governador: caso avance ao segundo turno, valor adicional de R$ 4.900.
  Demais cargos não têm segundo turno no sistema eleitoral brasileiro.
```

**Seção Mandato (abaixo dos cards de campanha):**
```
Para políticos eleitos: continue com sua base organizada após a eleição
```
- 4 cards de mandato com preço mensal
- Badge: "Cancele quando quiser"

**Footer da página:**
```
Prefeito e Vereador: em breve.
Dúvidas? Fale com um especialista → [WhatsApp]
```

### Webhook Stripe atualizado
Verificar e atualizar o handler do webhook para os novos price_ids.
Ao confirmar pagamento: ativar `produto_ativo` correto no contratante.

### Commit final
```bash
git add .
git commit -m "feat(M8): Pricing atualizado, produtos Stripe configurados, página /precos"
git push origin main
# → Configurar variáveis de ambiente do Stripe no Vercel
# → Executar npx ts-node scripts/stripe-setup.ts em produção
# → Testar fluxo completo de compra
```

---

## Termos de Uso — Melhorias para o SyncroFlow

Com base na análise dos termos do LideraAI e nas especificidades do SyncroFlow (SAE, IA, WhatsApp, TSE), adicionar as seguintes cláusulas ao termo atual:

### Cláusula TSE (nova)
> O CONTRATANTE declara que utilizará a Plataforma em conformidade com a Resolução TSE nº 23.755/2026 e demais normas eleitorais aplicáveis, incluindo: (i) identificação obrigatória do sistema de inteligência artificial ao eleitor em toda interação automatizada; (ii) proibição do uso de neurobots e sistemas de simulação de humanos; (iii) ciência de que a Plataforma realiza desativação automática do canal de atendimento por IA 72 (setenta e duas) horas antes do início da votação, sem que isso configure descumprimento contratual.

### Cláusula WhatsApp/Meta (nova)
> O canal de comunicação via WhatsApp é operado conforme as políticas do Meta Platforms. O CONTRATANTE é o único responsável pelo uso adequado do canal, sendo vedado o envio de mensagens não solicitadas (spam), conteúdo enganoso ou uso em desconformidade com os termos do WhatsApp Business. A SyncroFlow não se responsabiliza por eventuais suspensões de número ou conta decorrentes de uso indevido pelo CONTRATANTE.

### Cláusula de dados eleitorais (nova)
> Os dados históricos de resultados eleitorais disponíveis na Plataforma são de fonte pública (Tribunal Superior Eleitoral — TSE) e de uso livre. Os dados de eleitores inseridos ou captados pelo CONTRATANTE através da Plataforma são de sua exclusiva propriedade e responsabilidade, nos termos da Lei Geral de Proteção de Dados (LGPD).

### Cláusula de deativação eleitoral (nova)
> A SyncroFlow poderá suspender temporariamente funcionalidades da Plataforma em cumprimento a determinações do TSE, da LGPD ou de outros órgãos reguladores. A suspensão automática do canal de IA 72h antes da eleição é obrigação legal e não gera direito a reembolso proporcional.

### Cláusula de portabilidade (adaptar do LideraAI)
> Todos os dados inseridos na Plataforma são de propriedade exclusiva do CONTRATANTE. A SyncroFlow não reivindica qualquer direito sobre esses dados. O CONTRATANTE poderá solicitar exportação de seus dados a qualquer momento. Em caso de cancelamento, os dados permanecerão disponíveis para exportação por 30 (trinta) dias, após os quais serão excluídos definitivamente dos servidores.

---

## Checklist de Variáveis de Ambiente (verificar antes de cada deploy)

```env
# Banco de dados
DATABASE_URL=

# OpenAI (M4, M5, M7)
OPENAI_API_KEY=

# Stripe (M8)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# WhatsApp/WABA (existente)
META_WABA_API_TOKEN=
META_WABA_BUSINESS_ID=

# Twitter API (M5 — opcional)
TWITTER_BEARER_TOKEN=

# Salvy (existente)
SALVY_API_KEY=

# App
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXT_PUBLIC_APP_URL=
```

---

## Resumo de Módulos e Tabelas do Banco

| Módulo | Novas Tabelas |
|--------|--------------|
| M1 — Portal do Eleitor | `PortalEleitor`, `CadastroPortal` |
| M2 — Área do Coordenador | `Coordenador`, `CheckInLider` |
| M3 — Resultados TSE | `ResultadoTSE`, `MetaVotosContratante` |
| M4 — Conteúdo IA | `ConteudoIA` |
| M5 — Radar | `RadarMonitorado`, `RadarResultado`, `ResumoRadar` |
| M6 — Financeiro | `ContaFinanceira`, `Fornecedor`, `LancamentoFinanceiro` |
| M7 — Gabinete | `DemandaGabinete`, `DocumentoGabinete`, `Fiscalizacao` |
| M8 — Pricing | Nenhuma tabela nova (configs no `.env`) |

**Total: 14 novas tabelas + modificações no model `Contratante` existente.**

Rodar `npx prisma migrate dev` a cada módulo, nunca acumular migrações entre módulos.
