const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — DISPARO SERGIO FGTS (b01)
// ══════════════════════════════════════════════════════

// Usa a tabela principal do FGTS
const TABELA_NUMEROS = 'numeros';

const MENSAGEM = '(b01) Olá Novo Horizonte! Quero sacar meu FGTS e receber agora!'

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    const { data: numeros, error } = await supabase
      .from('numeros')
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log(`[FGTS-B01 FALLBACK] Nenhum número cadastrado, buscando fallback ativo`);
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[FGTS-B01 REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    if (!req.query.test) {
      supabase
        .from('redirect_log')
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => { })
        .catch(() => { });

      dispararWebhook('redirect.fgts-b01', {
        produto: 'FGTS Disparo Sergio',
        codigo: 'b01',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[FGTS-B01 ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
