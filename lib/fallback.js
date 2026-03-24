const { supabase } = require('./supabase');

/**
 * Busca um número ativo aleatório da tabela informada para usar como fallback.
 * Assim, o fallback é sempre um número que está realmente ativo no randomizador.
 * Só retorna null se o banco estiver completamente inacessível E a tabela vazia.
 */
async function getFallbackNumber(tabela) {
  try {
    const { data, error } = await supabase
      .from(tabela)
      .select('numero')
      .eq('ativo', true);

    if (!error && data && data.length > 0) {
      const sorteado = data[Math.floor(Math.random() * data.length)];
      return sorteado.numero.replace(/\D/g, '');
    }
  } catch (e) {
    // silencioso — se falhar, retorna null
  }
  return null;
}

module.exports = { getFallbackNumber };
