const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — BOLSA FAMÍLIA
// GET /bolsa → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

const TABELA_NUMEROS = 'numeros_bolsa';

const MENSAGEM = '(cj1) Olá, vim através do Canal do Jefinho e quero saber mais sobre o empréstimo bolsa família';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    const { data: numeros, error } = await supabase
      .from('numeros_bolsa')
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[BOLSA FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[BOLSA REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    // Pular log se for teste (?test=1)
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!req.query.test) {
      supabase
        .from('redirect_log_bolsa')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});

      // Disparar webhook para n8n
      dispararWebhook('redirect.bolsa', {
        produto: 'Bolsa Família',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[BOLSA ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
