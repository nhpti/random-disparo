const { supabase } = require('./supabase');

/**
 * Busca um número ativo aleatório da tabela informada para usar como fallback.
 * Se a tabela estiver vazia ou sem números ativos, busca de outra tabela ativa
 * para nunca redirecionar para um número inválido como 550.
 */
async function getFallbackNumber(tabela) {
  try {
    // 1. Tenta buscar da tabela solicitada
    if (tabela) {
      const { data, error } = await supabase
        .from(tabela)
        .select('numero')
        .eq('ativo', true);

      if (!error && data && data.length > 0) {
        const sorteado = data[Math.floor(Math.random() * data.length)];
        return sorteado.numero.replace(/\D/g, '');
      }
    }

    // 2. Rede de segurança: busca de tabelas que possuem atendentes ativos
    const tabelasFallback = ['numeros', 'numeros_bolsa_familia', 'numeros_bolsa', 'numeros_renegociacao'];
    for (const tab of tabelasFallback) {
      if (tab === tabela) continue;
      const { data } = await supabase
        .from(tab)
        .select('numero')
        .eq('ativo', true);

      if (data && data.length > 0) {
        const sorteado = data[Math.floor(Math.random() * data.length)];
        return sorteado.numero.replace(/\D/g, '');
      }
    }
  } catch (e) {
    // silencioso — se falhar, retorna null
  }
  return null;
}

module.exports = { getFallbackNumber };
