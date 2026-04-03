const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — BOLSA FAMÍLIA (novo)
// GET /bolsa-familia → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

const TABELA_NUMEROS = 'numeros_bolsa_familia';

const MENSAGEM = '(bf1) Olá! Quero saber mais sobre o empréstimo Bolsa Família!';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    const { data: numeros, error } = await supabase
      .from('numeros_bolsa_familia')
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[BOLSA-FAMILIA FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[BOLSA-FAMILIA REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    if (!req.query.test) {
      supabase
        .from('redirect_log_bolsa_familia')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});

      dispararWebhook('redirect.bolsa-familia', {
        produto: 'Bolsa Família',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[BOLSA-FAMILIA ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
