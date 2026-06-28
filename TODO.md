# TODO — SyncroFlowEleições

Lista viva de pendências do projeto. Atualizada em 2026-06-28 após auditoria geral contra a spec original (`docs/spec-eleicoes/`).

## Validação imediata

- [ ] Confirmar que o EasyPanel reimplantou a API com a feature de Agentes de Campo
- [ ] Teste real de ponta a ponta: convidar um agente de campo, mandar mensagem de WhatsApp mencionando o nome dele, confirmar que o `Contact` foi vinculado (`referredByTeamMemberId`)

## Pendências da auditoria geral (2026-06-28)

- [x] Briefing semanal por e-mail (toda segunda de manhã, resumo da semana anterior) — implementado em 2026-06-28, toggle em Configurações
- [ ] Validade de 48h no convite de equipe — token de convite hoje nunca expira
- [ ] CPF não é editável na tela de Perfil (só no cadastro inicial)
- [ ] Modo Mandato troca só a flag `plan` — não atualiza disclaimer/contexto do agente automaticamente
- [ ] Pagamento via Pix e Boleto — implementado em 2026-06-28. Price `price_1TnOk0JI94CYVRhpKtbVmVwu` criado no Stripe. Falta: configurar `STRIPE_PRICE_CAMPAIGN_ONETIME=price_1TnOk0JI94CYVRhpKtbVmVwu` no EasyPanel e reimplantar
- [ ] Painel administrativo manual (`/admin`) implementado em 2026-06-28 — plano B para Pix direto (sem Stripe) em cadastro/linha WhatsApp/créditos. Falta configurar no EasyPanel: `SYSTEM_ADMIN_KEY` (gerar valor novo forte), `NEXT_PUBLIC_SUPPORT_PIX_KEY` (chave Pix/CNPJ real) e `NEXT_PUBLIC_SUPPORT_WHATSAPP` (número de suporte) — sem essas 3 variáveis, a tela mostra "A definir" no lugar dos dados reais
- [ ] Aba "Fluxos" do cadastro do agente sem interface de edição (lógica existe no código, equipe não consegue configurar)
- [ ] Meta Pixel / Google Analytics na landing — decisão deliberada de deixar para depois, não é bug

## Pendências de sessões anteriores

- [ ] App Review da Meta (Facebook/Instagram) — aguardando aprovação, solicitação enviada 20/06/2026, prazo até ~20 dias úteis (~10/07/2026)
- [ ] Criar produto "Recarga 1000 Mensagens" no Stripe (R$ 97,00, pagamento único) e configurar `STRIPE_PRICE_RECHARGE_1000` no EasyPanel

## Concluído recentemente (referência)

- [x] Datas do TSE configuradas em produção (1º turno 04/10/2026, 2º turno 25/10/2026) — estavam nulas, desativação automática nunca dispararia
- [x] Bugs da landing corrigidos: preço do Plano Campanha, e-mail de contato no footer
- [x] Feature Agentes de Campo implementada (captação de eleitores em campo com atribuição automática por menção, sem custo extra de IA)
- [x] Os 10 relatórios da spec completos, com links de detalhe e PDF
- [x] Financeiro completo: cancelamento, reativação, Modo Mandato, recarga com quantidade variável
- [x] Google Calendar — bug de redirect 404 corrigido, botão acessível no menu
