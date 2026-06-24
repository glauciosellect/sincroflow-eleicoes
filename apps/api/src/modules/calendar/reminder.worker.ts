// TODO: lembretes de evento (seção 4.7 da spec — "eleitor pode solicitar lembrete →
// agente registra e envia mensagem no dia") ainda não foram implementados no modelo
// eleitoral. O model `Appointment` (com reminderJobId) existia no SyncroFlow original
// e foi removido; era acoplado ao fluxo de "IA agenda consulta", que a spec proíbe
// para o produto eleitoral (o agente só informa eventos, nunca agenda).
//
// Reimplementar exigirá um novo model (ex: EventReminder: eventId, contactId,
// scheduledAt, sentAt, reminderJobId) e um fluxo onde o eleitor pede lembrete de um
// Event já cadastrado pela equipe — sem o agente criar/alterar o evento em si.
export function startReminderWorker() {
  // no-op por enquanto
}
