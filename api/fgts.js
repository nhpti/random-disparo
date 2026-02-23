const { supabase } = require('../lib/supabase');

// ══════════════════════════════════════════════════════
// REDIRECT PÚBLICO — substitui o CurtLink
// GET /fgts → pega número aleatório → 302 → wa.me
// ══════════════════════════════════════════════════════

// Número de fallback caso o banco esteja fora ou sem números
// TROCAR pelo número principal de vocês ↓
const FALLBACK_NUMBER = '5511999999999';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Buscar todos os números ativos
    const { data: numeros, error } = await supabase
      .from('numeros')
      .select('numero');

    if (error) throw error;

    if (!numeros || numeros.length === 0) {
      // Fallback — sem números cadastrados
      console.log(`[FALLBACK] Nenhum número cadastrado, usando fallback`);
      return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}`);
    }

    // Escolher um aleatório
    const sorteado = numeros[Math.floor(Math.random() * numeros.length)];
    const limpo = sorteado.numero.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${limpo}`;

    console.log(`[REDIRECT] ${new Date().toISOString()} → ${sorteado.numero} → ${whatsappUrl}`);

    // Registrar no log (async, não bloqueia o redirect)
    supabase
      .from('redirect_log')
      .insert({
        numero: sorteado.numero,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      })
      .then(() => {})
      .catch(() => {});

    return res.redirect(302, whatsappUrl);
  } catch (err) {
    console.error('[FGTS ERROR]', err);
    // Em caso de QUALQUER erro, usa o fallback para não perder leads
    return res.redirect(302, `https://wa.me/${FALLBACK_NUMBER}`);
  }
};
