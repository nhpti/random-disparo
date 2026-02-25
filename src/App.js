import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getNumeros, addNumero, deleteNumero, toggleNumero, getStats,
  getConversoes, saveConversao,
  getNumerosBolsa, addNumeroBolsa, deleteNumeroBolsa, toggleNumeroBolsa, getStatsBolsa,
  getConversoesBolsa, saveConversaoBolsa,
} from './api';
import { supabase } from './supabaseClient';
import './App.css';

// ── Config por produto ──
const PRODUTOS = {
  fgts: {
    nome: 'CLT & FGTS',
    path: '/fgts',
    emoji: '💼',
    desc: 'Gerenciador de números ativos — CLT & FGTS',
    apiGet: getNumeros,
    apiAdd: addNumero,
    apiDel: deleteNumero,
    apiToggle: toggleNumero,
    apiStats: getStats,
    apiGetConv: getConversoes,
    apiSaveConv: saveConversao,
    testPath: '/api/fgts',
    numerosPath: '/api/numeros',
  },
  bolsa: {
    nome: 'Bolsa Família',
    path: '/bolsa',
    emoji: '👨‍👩‍👧‍👦',
    desc: 'Gerenciador de números ativos — Bolsa Família',
    apiGet: getNumerosBolsa,
    apiAdd: addNumeroBolsa,
    apiDel: deleteNumeroBolsa,
    apiToggle: toggleNumeroBolsa,
    apiStats: getStatsBolsa,
    apiGetConv: getConversoesBolsa,
    apiSaveConv: saveConversaoBolsa,
    testPath: '/api/bolsa',
    numerosPath: '/api/numeros-bolsa',
  },
};

// ── Traduzir erros do Supabase ──
function traduzirErro(msg) {
  const map = {
    'Invalid login credentials': 'Email ou senha incorretos.',
    'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
    'User not found': 'Usuário não encontrado.',
    'Invalid email or password': 'Email ou senha inválidos.',
    'Too many requests': 'Muitas tentativas. Aguarde um momento.',
    'Network request failed': 'Erro de conexão. Verifique sua internet.',
  };
  return map[msg] || msg;
}

// ── Formatar número para exibição ──
function formatarNumero(num) {
  const limpo = num.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return num;
}

// ── SVG Copy Icon ──
const CopyIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

function App() {
  // ── Auth State ──
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Produto selecionado (null = tela de seleção) ──
  const [produto, setProduto] = useState(null);

  // ── Admin State ──
  const [numeros, setNumeros] = useState([]);
  const [input, setInput] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [copiedNumero, setCopiedNumero] = useState(null);
  const [conversoes, setConversoes] = useState({});
  const [savingConv, setSavingConv] = useState(null);
  const inputRef = useRef(null);
  const toastTimeout = useRef(null);

  const config = produto ? PRODUTOS[produto] : null;
  const redirectUrl = config ? window.location.origin + config.path : '';

  // ── Dark Mode ──
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light';
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // ── Toast ──
  const showToast = (message, type = 'success') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Copiar número ──
  const handleCopyNumero = (numero) => {
    navigator.clipboard.writeText(numero).then(() => {
      setCopiedNumero(numero);
      showToast(`Número ${formatarNumero(numero)} copiado!`);
      setTimeout(() => setCopiedNumero(null), 2000);
    });
  };

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) setLoginError(traduzirErro(error.message));
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProduto(null);
  };

  const getAccessToken = () => session?.access_token || '';

  // ── Fetch data (reage a produto e session) ──
  const fetchData = useCallback(async () => {
    if (!session || !config) return;
    try {
      const token = session.access_token;
      const hoje = new Date().toISOString().split('T')[0];
      const [nums, st, conv] = await Promise.all([
        config.apiGet(token),
        config.apiStats(token),
        config.apiGetConv(token, hoje),
      ]);
      setNumeros(nums);
      setStats(st);
      // Indexar conversões por número
      const convMap = {};
      for (const c of conv || []) {
        convMap[c.numero] = { mensagens: c.mensagens || 0, conversoes: c.conversoes || 0 };
      }
      setConversoes(convMap);
    } catch (err) {
      console.error(err);
    }
  }, [session, config]);

  useEffect(() => {
    if (!session || !config) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, session, config]);

  // Limpar dados ao trocar de produto
  const handleSelectProduto = (key) => {
    setNumeros([]);
    setStats(null);
    setConversoes({});
    setInput('');
    setCopied(false);
    setConfirmDelete(null);
    setProduto(key);
  };

  const handleVoltar = () => {
    setProduto(null);
    setNumeros([]);
    setStats(null);
    setConversoes({});
  };

  const handleAdd = async () => {
    const value = input.trim();
    if (!value || !config) return;
    try {
      await config.apiAdd(value, getAccessToken());
      setInput('');
      showToast(`Número ${formatarNumero(value)} adicionado!`);
      fetchData();
      inputRef.current?.focus();
    } catch (err) {
      showToast('Erro ao adicionar número.', 'error');
      console.error(err);
    }
  };

  const handleDelete = async (id, numero) => {
    if (!config) return;
    try {
      await config.apiDel(id, getAccessToken());
      showToast(`Número ${formatarNumero(numero)} removido.`, 'error');
      setConfirmDelete(null);
      fetchData();
    } catch (err) {
      showToast('Erro ao remover número.', 'error');
      console.error(err);
    }
  };

  const handleToggle = async (id, numero, ativoAtual) => {
    if (!config) return;
    try {
      const novoStatus = !ativoAtual;
      await config.apiToggle(id, novoStatus, getAccessToken());
      showToast(
        novoStatus
          ? `Número ${formatarNumero(numero)} ativado!`
          : `Número ${formatarNumero(numero)} pausado.`,
        novoStatus ? 'success' : 'error'
      );
      fetchData();
    } catch (err) {
      showToast('Erro ao alterar status.', 'error');
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(redirectUrl).then(() => {
      setCopied(true);
      showToast('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  // ── Conversões: atualizar campo local ──
  const handleConvChange = (numero, field, value) => {
    const val = parseInt(value, 10) || 0;
    setConversoes(prev => ({
      ...prev,
      [numero]: { ...prev[numero], [field]: val },
    }));
  };

  // ── Conversões: salvar no servidor ──
  const handleSaveConv = async (numero) => {
    if (!config) return;
    setSavingConv(numero);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const c = conversoes[numero] || { mensagens: 0, conversoes: 0 };
      await config.apiSaveConv({
        numero,
        data: hoje,
        mensagens: c.mensagens,
        conversoes: c.conversoes,
      }, getAccessToken());
      showToast(`Conversões de ${formatarNumero(numero)} salvas!`);
    } catch (err) {
      showToast('Erro ao salvar conversões.', 'error');
      console.error(err);
    }
    setSavingConv(null);
  };

  const getNumeroStats = (numero) => {
    if (!stats?.porNumero) return { total: 0, uniqueIps: 0 };
    const found = stats.porNumero.find(s => s.numero === numero);
    return found ? { total: found.total, uniqueIps: found.uniqueIps || 0 } : { total: 0, uniqueIps: 0 };
  };

  const getMaxCliques = () => {
    if (!stats?.porNumero || stats.porNumero.length === 0) return 1;
    return Math.max(...stats.porNumero.map(s => s.total), 1);
  };

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════

  // ── Loading ──
  if (authLoading) {
    return (
      <div className="page">
        <div className="login-container">
          <div className="loading-spinner"></div>
          <p style={{ textAlign: 'center', marginTop: '16px' }} className="text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  // ── Login Screen ──
  if (!session) {
    return (
      <div className="page">
        <div className="login-container">
          <div className="login-icon">🔒</div>
          <h1>Random Disparo</h1>
          <p className="subtitle">Faça login para acessar o painel</p>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <span className="input-icon">✉</span>
              <input type="email" placeholder="E-mail" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)} required autoFocus />
            </div>
            <div className="input-group">
              <span className="input-icon">🔑</span>
              <input type="password" placeholder="Senha" value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)} required />
            </div>
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="btn-login" disabled={loginLoading}>
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Seleção de Produto ──
  if (!produto) {
    return (
      <div className="page">
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.type === 'success' ? '✓' : '✕'}</span> {toast.message}
          </div>
        )}
        <div className="top-bar">
          <button className="btn-theme" onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="user-email">👤 {session.user.email}</span>
          <button className="btn-logout" onClick={handleLogout}>Sair</button>
        </div>
        <h1>Random Disparo</h1>
        <p className="subtitle">Selecione o produto para gerenciar</p>

        <div className="product-selector">
          {Object.entries(PRODUTOS).map(([key, p]) => (
            <button key={key} className="product-card" onClick={() => handleSelectProduto(key)}>
              <span className="product-emoji">{p.emoji}</span>
              <span className="product-name">{p.nome}</span>
              <span className="product-arrow">→</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Admin Panel (produto selecionado) ──
  const maxCliques = getMaxCliques();

  return (
    <div className="page">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span> {toast.message}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Remover número?</h3>
            <p>Tem certeza que deseja remover o número <strong>{formatarNumero(confirmDelete.numero)}</strong>?</p>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-confirm-delete" onClick={() => handleDelete(confirmDelete.id, confirmDelete.numero)}>Remover</button>
            </div>
          </div>
        </div>
      )}

      <div className="top-bar">
        <button className="btn-voltar" onClick={handleVoltar}>← Produtos</button>
        <button className="btn-theme" onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <span className="user-email">👤 {session.user.email}</span>
        <button className="btn-logout" onClick={handleLogout}>Sair</button>
      </div>
      <h1>{config.emoji} {config.nome}</h1>
      <p className="subtitle">{config.desc}</p>

      {/* Link de Redirect */}
      <div className="redirect-section">
        <h2>Link de Disparo</h2>
        <p className="redirect-desc">
          Este é o link que vai no template de disparo. Cada clique redireciona
          automaticamente para um WhatsApp aleatório entre os números ativos.
        </p>
        <div className="redirect-link-box">
          <span className="redirect-link">{redirectUrl}</span>
          <button className="btn-copy-main" onClick={handleCopyLink}>
            {copied ? '✓ Copiado!' : <><CopyIcon size={14} /> Copiar</>}
          </button>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{stats?.totalRedirects ?? '—'}</span>
            <span className="stat-label">Redirects total</span>
          </div>
          <div className="stat-card stat-card-highlight">
            <span className="stat-value">{stats?.redirectsHoje ?? '—'}</span>
            <span className="stat-label">Cliques hoje</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats?.uniqueHoje ?? '—'}</span>
            <span className="stat-label">IPs únicos hoje</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{numeros.length}</span>
            <span className="stat-label">Números ativos</span>
          </div>
        </div>

        {/* Histórico dos últimos 7 dias */}
        {stats?.historico && stats.historico.length > 0 && (
          <div className="historico-section">
            <h3 className="historico-title">📊 Últimos 7 dias</h3>
            <div className="historico-chart">
              {stats.historico.map((h, i) => {
                const maxHist = Math.max(...stats.historico.map(x => x.cliques), 1);
                const barHeight = (h.cliques / maxHist) * 100;
                const isHoje = i === stats.historico.length - 1;
                return (
                  <div key={h.data} className={`historico-bar-col ${isHoje ? 'historico-hoje' : ''}`}>
                    <span className="historico-valor">{h.cliques}</span>
                    <div className="historico-bar-bg">
                      <div className="historico-bar-fill" style={{ height: `${barHeight}%` }}></div>
                    </div>
                    <span className="historico-dia">{isHoje ? 'Hoje' : h.dia}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Distribuição por Hora (hoje) */}
        {stats?.porHora && stats.porHora.some(v => v > 0) && (
          <div className="historico-section">
            <h3 className="historico-title">🕐 Distribuição por Hora (Hoje)</h3>
            <div className="hora-chart">
              {stats.porHora.map((count, hora) => {
                const maxHora = Math.max(...stats.porHora, 1);
                const barHeight = (count / maxHora) * 100;
                return (
                  <div key={hora} className={`hora-bar-col ${count > 0 ? 'hora-active' : ''}`}>
                    <span className="hora-valor">{count > 0 ? count : ''}</span>
                    <div className="hora-bar-bg">
                      <div className="hora-bar-fill" style={{ height: `${barHeight}%` }}></div>
                    </div>
                    <span className="hora-label">{String(hora).padStart(2, '0')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Números Ativos */}
      <div className="numbers-card">
        <div className="card-header">
          <h2>Números</h2>
          <span className="counter">{numeros.filter(n => n.ativo !== false).length} / {numeros.length}</span>
        </div>

        <div className="input-area">
          <input ref={inputRef} type="text" placeholder="Ex: 48999998888"
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
          <button className="btn-add" onClick={handleAdd}>+ Adicionar</button>
        </div>

        <div className="numbers-list">
          {numeros.length === 0 && (
            <div className="empty-msg">Nenhum número cadastrado. Adicione acima.</div>
          )}
          {numeros.map((n, idx) => {
            const st = getNumeroStats(n.numero);
            const percent = maxCliques > 0 ? (st.total / maxCliques) * 100 : 0;
            const isAtivo = n.ativo !== false;
            return (
              <div key={n.id} className={`number-item ${!isAtivo ? 'number-item-paused' : ''}`}>
                <span className="num-index">{idx + 1}.</span>
                <div className="num-info">
                  <div className="num-top-row">
                    <span className="num-value">{formatarNumero(n.numero)}</span>
                    <button className="btn-copy-num" onClick={() => handleCopyNumero(n.numero)}
                      title="Copiar número">
                      {copiedNumero === n.numero ? '✓' : <CopyIcon size={14} />}
                    </button>
                    <span className="num-redirects">{st.total} cliques · {st.uniqueIps} pessoas</span>
                    <button
                      className={`btn-toggle ${isAtivo ? 'btn-toggle-on' : 'btn-toggle-off'}`}
                      onClick={() => handleToggle(n.id, n.numero, isAtivo)}
                      title={isAtivo ? 'Pausar número' : 'Ativar número'}>
                      {isAtivo ? 'Ativo' : 'Pausado'}
                    </button>
                    <button className="btn-remove"
                      onClick={() => setConfirmDelete({ id: n.id, numero: n.numero })}
                      title="Remover número">&times;</button>
                  </div>
                  <div className="num-bar-bg">
                    <div className="num-bar-fill" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel de Conversões */}
      {numeros.length > 0 && (
        <div className="conversoes-card">
          <div className="card-header">
            <h2>📈 Funil de Conversão (Hoje)</h2>
          </div>

          {/* Resumo do funil */}
          {(() => {
            const totalCliques = stats?.redirectsHoje || 0;
            const totalUnique = stats?.uniqueHoje || 0;
            const totalMensagens = Object.values(conversoes).reduce((s, c) => s + (c.mensagens || 0), 0);
            const totalConversoes = Object.values(conversoes).reduce((s, c) => s + (c.conversoes || 0), 0);
            const taxaRepeticao = totalCliques > 0 ? (((totalCliques - totalUnique) / totalCliques) * 100).toFixed(1) : '0.0';
            const taxaAbertura = totalUnique > 0 ? ((totalMensagens / totalUnique) * 100).toFixed(1) : '0.0';
            const taxaConversao = totalMensagens > 0 ? ((totalConversoes / totalMensagens) * 100).toFixed(1) : '0.0';

            return (
              <div className="funil-resumo">
                <div className="funil-step">
                  <span className="funil-valor">{totalCliques}</span>
                  <span className="funil-label">Cliques</span>
                  <span className="funil-taxa funil-taxa-muted">{taxaRepeticao}% repetidos</span>
                </div>
                <span className="funil-arrow">→</span>
                <div className="funil-step">
                  <span className="funil-valor">{totalUnique}</span>
                  <span className="funil-label">Pessoas (IPs)</span>
                </div>
                <span className="funil-arrow">→</span>
                <div className="funil-step">
                  <span className="funil-valor">{totalMensagens}</span>
                  <span className="funil-label">Mensagens</span>
                  <span className="funil-taxa">{taxaAbertura}%</span>
                </div>
                <span className="funil-arrow">→</span>
                <div className="funil-step">
                  <span className="funil-valor">{totalConversoes}</span>
                  <span className="funil-label">Conversões</span>
                  <span className="funil-taxa">{taxaConversao}%</span>
                </div>
              </div>
            );
          })()}

          <p className="conv-desc">
            Preencha quantas mensagens recebeu e quantas converteram hoje. A taxa de abertura usa IPs únicos como base real.
          </p>

          <div className="conv-list">
            {numeros.map((n) => {
              const c = conversoes[n.numero] || { mensagens: 0, conversoes: 0 };
              const st = getNumeroStats(n.numero);
              return (
                <div key={n.id} className="conv-item">
                  <div className="conv-numero">
                    <span className="conv-num-label">{formatarNumero(n.numero)}</span>
                    <span className="conv-cliques">{st.uniqueIps} pessoas · {st.total} cliques</span>
                  </div>
                  <div className="conv-inputs">
                    <div className="conv-field">
                      <label>Msgs</label>
                      <input type="number" min="0" value={c.mensagens || ''}
                        placeholder="0"
                        onChange={(e) => handleConvChange(n.numero, 'mensagens', e.target.value)} />
                    </div>
                    <div className="conv-field">
                      <label>Conv</label>
                      <input type="number" min="0" value={c.conversoes || ''}
                        placeholder="0"
                        onChange={(e) => handleConvChange(n.numero, 'conversoes', e.target.value)} />
                    </div>
                    <button className="btn-save-conv" onClick={() => handleSaveConv(n.numero)}
                      disabled={savingConv === n.numero}>
                      {savingConv === n.numero ? '...' : '💾'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
