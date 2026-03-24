const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — WHATSAPP BOLSA FAMÍLIA (wb1)
// GET /whats-bolsa-familia → pega número aleatório → 302 → wa.me
// Domínio: whats.nhpbolsa.com
// ══════════════════════════════════════════════════════

const TABELA_NUMEROS = 'numeros_bolsa_familia';

const MENSAGEM = '(b07) Olá! Vim através do WhatsApp e quero saber mais sobre o empréstimo Bolsa Família!';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    const { data: numeros, error } = await supabase
      .from('numeros_bolsa_familia')
      .select('numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[WHATS-BOLSA-FAMILIA FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const sorteado = numeros[Math.floor(Math.random() * numeros.length)];
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[WHATS-BOLSA-FAMILIA REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!req.query.test) {
      supabase
        .from('redirect_log_bolsa_familia')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});

      dispararWebhook('redirect.whats-bolsa-familia', {
        produto: 'WhatsApp Bolsa Família',
        codigo: 'b07',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[WHATS-BOLSA-FAMILIA ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
