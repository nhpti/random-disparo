const { supabase } = require('../lib/supabase');
const { dispararWebhook } = require('../lib/webhook');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — SMS BOLSA FAMÍLIA (sb1)
// GET /sms-bolsa → pega número aleatório → 302 → wa.me
// Domínio: nhpbolsa.com
// ══════════════════════════════════════════════════════

const FALLBACK_NUMBER = '5548999980196';

const MENSAGEM = '(sb1) Olá! Vim através do SMS e quero saber mais sobre o empréstimo Bolsa Família!';

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
      console.log(`[SMS-BOLSA FALLBACK] Nenhum número cadastrado, usando fallback`);
      return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
    }

    const sorteado = numeros[Math.floor(Math.random() * numeros.length)];
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}${textParam}`;

    console.log(`[SMS-BOLSA REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

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

      dispararWebhook('redirect.sms-bolsa', {
        produto: 'SMS Bolsa Família',
        codigo: 'sb1',
        numero: sorteado.numero,
        ip: clientIp,
        url: whatsappUrl,
      });
    }

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[SMS-BOLSA ERROR]', err);
    return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}${textParam}`);
  }
};
