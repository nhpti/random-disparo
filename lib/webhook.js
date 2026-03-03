const { supabase } = require('./supabase');

// ══════════════════════════════════════════════════════
// WEBHOOK DISPATCHER — Dispara eventos para o n8n
// ══════════════════════════════════════════════════════

/**
 * Dispara um evento para todas as URLs de webhook configuradas.
 * Não bloqueia a execução — fire and forget.
 *
 * @param {string} evento - Nome do evento (ex: 'redirect.fgts', 'redirect.bolsa', 'numero.ativado')
 * @param {object} dados  - Dados do evento
 */
async function dispararWebhook(evento, dados = {}) {
  try {
    // Buscar URLs de webhook ativas no banco
    const { data: webhooks, error } = await supabase
      .from('webhooks_n8n')
      .select('url, eventos')
      .eq('ativo', true);

    if (error || !webhooks || webhooks.length === 0) return;

    const payload = {
      evento,
      timestamp: new Date().toISOString(),
      dados,
    };

    // Disparar para todos os webhooks que escutam esse evento
    for (const wh of webhooks) {
      // Se o webhook tem filtro de eventos, checar
      if (wh.eventos && wh.eventos.length > 0) {
        const match = wh.eventos.some(e => evento.startsWith(e) || e === '*');
        if (!match) continue;
      }

      // Fire and forget — não espera resposta
      fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(r => console.log(`[WEBHOOK] ${evento} → ${wh.url} (${r.status})`))
        .catch(err => console.error(`[WEBHOOK ERROR] ${evento} → ${wh.url}:`, err.message));
    }
  } catch (err) {
    // Nunca deixar webhook quebrar o fluxo principal
    console.error('[WEBHOOK FATAL]', err.message);
  }
}

module.exports = { dispararWebhook };
