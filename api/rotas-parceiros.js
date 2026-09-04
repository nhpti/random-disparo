const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// GET  /api/rotas-parceiros       -> Listar todas as rotas
// POST /api/rotas-parceiros       -> Criar nova rota
// PUT  /api/rotas-parceiros?id=... -> Atualizar rota
// DELETE /api/rotas-parceiros?id=... -> Excluir rota
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado.' });

  const id = req.query.id;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('rotas_parceiros')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { nome_parceiro, codigo_origem, produto, mensagem_template } = req.body;

      if (!nome_parceiro || !codigo_origem || !produto || !mensagem_template) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      const { data, error } = await supabase
        .from('rotas_parceiros')
        .insert({
          nome_parceiro: nome_parceiro.trim(),
          codigo_origem: codigo_origem.trim().toLowerCase(),
          produto: produto.trim().toLowerCase(),
          mensagem_template: mensagem_template.trim(),
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

      const { nome_parceiro, codigo_origem, produto, mensagem_template, ativo } = req.body;

      const updates = { atualizado_em: new Date().toISOString() };
      if (nome_parceiro !== undefined) updates.nome_parceiro = nome_parceiro.trim();
      if (codigo_origem !== undefined) updates.codigo_origem = codigo_origem.trim().toLowerCase();
      if (produto !== undefined) updates.produto = produto.trim().toLowerCase();
      if (mensagem_template !== undefined) updates.mensagem_template = mensagem_template.trim();
      if (ativo !== undefined) updates.ativo = ativo;

      const { data, error } = await supabase
        .from('rotas_parceiros')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

      const { error } = await supabase
        .from('rotas_parceiros')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ROTAS PARCEIROS API ERROR]', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
};
