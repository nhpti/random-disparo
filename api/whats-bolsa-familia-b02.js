const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — RETOMADA BOLSA FAMÍLIA (b02)
// ══════════════════════════════════════════════════════

const TABELA_NUMEROS = 'numeros_bolsa_familia';

// Nova mensagem com a tag (b02)
const MENSAGEM = '(b02) Olá! Quero saber mais sobre o empréstimo Bolsa Família!'

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    // Usa a mesma fila de números do Bolsa Família padrão
    const { data: numeros, error } = await supabase
      .from('numeros_bolsa_familia')
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[WHATS-BOLSA-FAMILIA-B02 FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[WHATS-BOLSA-FAMILIA-B02 REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    if (!req.query.test) {
      supabase
        .from('redirect_log_bolsa_familia')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => { })
        .catch(() => { });

      dispararWebhook('redirect.whats-bolsa-familia-b02', {
        produto: 'WhatsApp Bolsa Família Retomada',
        codigo: 'b02',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[WHATS-BOLSA-FAMILIA-B02 ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
