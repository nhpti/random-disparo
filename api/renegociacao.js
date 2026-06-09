const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');
const { getFallbackNumber } = require('../lib/fallback');
const { getNextNumero } = require('../lib/round-robin');

const TABELA_NUMEROS = 'numeros_renegociacao';
const TABELA_LOG = 'redirect_log_renegociacao';

const MENSAGEM = '(b11) Olá, gostaria de saber mais sobre a renegociação!';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const textParam = `?text=${encodeURIComponent(MENSAGEM)}`;

  try {
    const { data: numeros, error } = await supabase
      .from(TABELA_NUMEROS)
      .select('id, numero')
      .neq('ativo', false);

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      console.log('[RENEGOCIACAO FALLBACK] Nenhum numero cadastrado, buscando fallback ativo');
      const fb = await getFallbackNumber(TABELA_NUMEROS);
      return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const sorteado = await getNextNumero(TABELA_NUMEROS, numeros, clientIp);
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[RENEGOCIACAO REDIRECT] ${new Date().toISOString()} -> ${sorteado.numero} -> ${whatsappUrl}`);

    if (!req.query.test) {
      supabase
        .from(TABELA_LOG)
        .insert({
          numero: sorteado.numero,
          ip: clientIp,
        })
        .then(() => {})
        .catch(() => {});

      dispararWebhook('redirect.renegociacao', {
        produto: 'Renegociacao',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[RENEGOCIACAO ERROR]', err);
    const fb = await getFallbackNumber(TABELA_NUMEROS);
    return res.redirect(302, `https://wa.me/55${fb || '0'}${textParam}`);
  }
};
