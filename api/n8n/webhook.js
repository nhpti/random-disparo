const { supabase } = require('../../lib/supabase');
const { verifyAuthWithRole } = require('../../lib/auth');

// ══════════════════════════════════════════════════════
// CRUD de Webhooks do n8n
// GET    /api/n8n/webhook — listar webhooks (admin)
// POST   /api/n8n/webhook — cadastrar webhook (admin)
// DELETE /api/n8n/webhook?id=X — remover webhook (admin)
// PATCH  /api/n8n/webhook?id=X — ativar/desativar (admin)
// ══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Autenticação — apenas admin
  const { user, role } = await verifyAuthWithRole(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  if (role !== 'admin') return res.status(403).json({ error: 'Apenas administradores.' });

  try {
    // ── GET — listar todos ──
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('webhooks_n8n')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    // ── POST — cadastrar novo webhook ──
    if (req.method === 'POST') {
      const { url, nome, eventos } = req.body;

      if (!url || !url.trim()) {
        return res.status(400).json({ error: 'URL do webhook é obrigatória.' });
      }

      // Validar que a URL parece válida
      try {
        new URL(url.trim());
      } catch {
        return res.status(400).json({ error: 'URL inválida.' });
      }

      const { data, error } = await supabase
        .from('webhooks_n8n')
        .insert({
          url: url.trim(),
          nome: (nome || '').trim() || 'Webhook n8n',
          eventos: eventos || ['*'],
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    // ── DELETE — remover webhook ──
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

      const { error } = await supabase
        .from('webhooks_n8n')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── PATCH — ativar/desativar ──
    if (req.method === 'PATCH') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

      const { ativo } = req.body;
      const { data, error } = await supabase
        .from('webhooks_n8n')
        .update({ ativo: !!ativo })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[WEBHOOK CRUD ERROR]', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};
