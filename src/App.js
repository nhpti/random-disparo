import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getNumeros, addNumero, deleteNumero, toggleNumero, getStats,
  getNumerosBolsa, addNumeroBolsa, deleteNumeroBolsa, toggleNumeroBolsa, getStatsBolsa,
  getNumerosBolsaFamilia, addNumeroBolsaFamilia, deleteNumeroBolsaFamilia, toggleNumeroBolsaFamilia, getStatsBolsaFamilia,
  getActivityLog, getDashboardStats,
  getMe, getUsuarios, addUsuario, updateUsuarioRole, deleteUsuario,
  getHealthStatus, getRealtimeChart,
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
    testPath: '/api/fgts',
    numerosPath: '/api/numeros',
  },
  bolsa: {
    nome: 'Randomizador Jeffinho',
    path: '/bolsa',
    emoji: '🎯',
    desc: 'Gerenciador de números ativos — Randomizador Jeffinho',
    apiGet: getNumerosBolsa,
    apiAdd: addNumeroBolsa,
    apiDel: deleteNumeroBolsa,
    apiToggle: toggleNumeroBolsa,
    apiStats: getStatsBolsa,
    testPath: '/api/bolsa',
    numerosPath: '/api/numeros-bolsa',
  },
  'bolsa-familia': {
    nome: 'Bolsa Família',
    path: '/bolsa-familia',
    emoji: '👨‍👩‍👧‍👦',
    desc: 'Gerenciador de números ativos — Bolsa Família',
    apiGet: getNumerosBolsaFamilia,
    apiAdd: addNumeroBolsaFamilia,
    apiDel: deleteNumeroBolsaFamilia,
    apiToggle: toggleNumeroBolsaFamilia,
    apiStats: getStatsBolsaFamilia,
    testPath: '/api/bolsa-familia',
    numerosPath: '/api/numeros-bolsa-familia',
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
  const [dashboardStats, setDashboardStats] = useState({});

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
  const [copiedSms, setCopiedSms] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [agoText, setAgoText] = useState('');
  // Busca/Filtro (#4)
  const [searchTerm, setSearchTerm] = useState('');
  // Notificações/Health (#5)
  const [healthAlerts, setHealthAlerts] = useState(null);
  const [healthDismissed, setHealthDismissed] = useState(false);
  // Gráfico tempo real (#6)
  const [realtimeData, setRealtimeData] = useState(null);
  // Aba ativa: painel / monitoramento (#7)
  const [activeTab, setActiveTab] = useState('painel');
  // Role do usuário
  const [userRole, setUserRole] = useState(null);
  // Painel de usuários (admin)
  const [usuarios, setUsuarios] = useState([]);
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [novoUsuarioEmail, setNovoUsuarioEmail] = useState('');
  const [novoUsuarioSenha, setNovoUsuarioSenha] = useState('');
  const [novoUsuarioRole, setNovoUsuarioRole] = useState('operador');
  // Filtro por período
  const hoje = new Date().toISOString().split('T')[0];
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [filtroFim, setFiltroFim] = useState(hoje);
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
      if (s) getMe(s.access_token).then(me => setUserRole(me.role)).catch(() => setUserRole('admin'));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) getMe(s.access_token).then(me => setUserRole(me.role)).catch(() => setUserRole('admin'));
      else setUserRole(null);
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
    setUserRole(null);
  };

  const getAccessToken = () => session?.access_token || '';

  // ── Fetch dashboard stats (tela de seleção de produto) ──
  useEffect(() => {
    if (!session || produto) return;
    const fetchDashboard = async () => {
      try {
        const data = await getDashboardStats(session.access_token);
        setDashboardStats(data);
      } catch (err) {
        console.error('Dashboard stats error:', err);
      }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 120000); // 2min (era 60s com 4 calls)
    return () => clearInterval(interval);
  }, [session, produto]);

  // ── Fetch data (reage a produto e session) ──
  const fetchData = useCallback(async () => {
    if (!session || !config) return;
    try {
      const token = session.access_token;
      const [nums, st, logs] = await Promise.all([
        config.apiGet(token),
        config.apiStats(token, filtroInicio, filtroFim),
        getActivityLog(token, produto),
      ]);
      setNumeros(nums);
      setStats(st);
      setActivityLog(logs || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [session, config, filtroInicio, filtroFim]);

  // ── Polling adaptativo ──
  const getPollingInterval = () => {
    const hora = new Date().getHours();
    return (hora >= 8 && hora < 20) ? 60000 : 180000; // 60s horário comercial, 3min fora
  };

  useEffect(() => {
    if (!session || !config) return;
    fetchData();
    let interval = setInterval(fetchData, getPollingInterval());

    // Reajusta intervalo a cada 5 min (caso mude de período)
    const recalc = setInterval(() => {
      clearInterval(interval);
      interval = setInterval(fetchData, getPollingInterval());
    }, 300000);

    // Pausar quando aba perde foco, retomar ao voltar
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchData(); // atualiza imediatamente
        interval = setInterval(fetchData, getPollingInterval());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(recalc);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData, session, config]);

  // ── Atualizar texto "há X seg" ──
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diff < 5) setAgoText('agora');
      else if (diff < 60) setAgoText(`há ${diff}s`);
      else setAgoText(`há ${Math.floor(diff / 60)}min`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // ── Helpers de permissão ──
  const canEdit = userRole === 'admin' || userRole === 'operador';
  const isAdmin = userRole === 'admin';

  // ── Health Status polling (cada 5 min) (#5) ──
  useEffect(() => {
    if (!session || !config) return;
    const fetchHealth = async () => {
      try {
        const data = await getHealthStatus(session.access_token);
        setHealthAlerts(data);
        setHealthDismissed(false);
      } catch (err) {
        console.error('Health status error:', err);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 300000); // 5 min
    return () => clearInterval(interval);
  }, [session, config]);

  // ── Realtime Chart polling (cada 60s, só na aba monitoramento) (#6) ──
  useEffect(() => {
    if (!session || !config || activeTab !== 'monitoramento') return;
    const fetchRealtime = async () => {
      try {
        const data = await getRealtimeChart(session.access_token);
        setRealtimeData(data);
      } catch (err) {
        console.error('Realtime chart error:', err);
      }
    };
    fetchRealtime();
    const interval = setInterval(fetchRealtime, 60000);
    return () => clearInterval(interval);
  }, [session, config, activeTab]);

  // ── Usuários (admin) ──
  const fetchUsuarios = useCallback(async () => {
    if (!session || !isAdmin) return;
    try {
      const data = await getUsuarios(session.access_token);
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
  }, [session, isAdmin]);

  useEffect(() => {
    if (showUsuarios) fetchUsuarios();
  }, [showUsuarios, fetchUsuarios]);

  const handleAddUsuario = async () => {
    if (!novoUsuarioEmail.trim()) return;
    try {
      const result = await addUsuario(novoUsuarioEmail.trim(), novoUsuarioRole, novoUsuarioSenha.trim() || undefined, session.access_token);
      setNovoUsuarioEmail('');
      setNovoUsuarioSenha('');
      setNovoUsuarioRole('operador');
      if (result.senhaTemporaria) {
        showToast(`Usuário criado! Senha: ${result.senhaTemporaria}`);
      } else {
        showToast('Usuário adicionado!');
      }
      fetchUsuarios();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeRole = async (id, newRole) => {
    try {
      await updateUsuarioRole(id, newRole, session.access_token);
      showToast('Role atualizada!');
      fetchUsuarios();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUsuario = async (id) => {
    try {
      await deleteUsuario(id, session.access_token);
      showToast('Usuário removido.');
      fetchUsuarios();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Limpar dados ao trocar de produto
  const handleSelectProduto = (key) => {
    setNumeros([]);
    setStats(null);
    setActivityLog([]);
    setInput('');
    setCopied(false);
    setConfirmDelete(null);
    setSearchTerm('');
    setHealthAlerts(null);
    setHealthDismissed(false);
    setRealtimeData(null);
    setActiveTab('painel');
    setProduto(key);
  };

  const handleVoltar = () => {
    setProduto(null);
    setNumeros([]);
    setStats(null);
    setActivityLog([]);
    setShowUsuarios(false);
    setSearchTerm('');
    setHealthAlerts(null);
    setRealtimeData(null);
    setActiveTab('painel');
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

  const handleCopySmsLink = (key, url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSms(key);
      showToast('Link SMS copiado!');
      setTimeout(() => setCopiedSms(null), 2000);
    });
  };

  // Links SMS para disparo
  // Links extras de disparo (aparecem junto ao link principal)
  const extraDisparoLinks = {
    fgts: [
      { key: 'bc06', label: 'WhatsApp CLT (bc06)', path: '/clt', domain: 'https://clt.nhpcred.com' },
    ],
    'bolsa-familia': [
      { key: 'b07', label: 'WhatsApp Bolsa Família (b07)', path: '/bf', domain: 'https://whats.nhpbolsa.com' },
    ],
  };

  const smsLinks = {
    fgts: [
      { key: 'sf1', label: 'SMS FGTS (sf1)', path: '/sms-fgts', domain: 'https://sms.nhpfgts.com' },
      { key: 'sc1', label: 'SMS CLT (sc1)', path: '/sms-clt', domain: 'https://sms.nhpfgts.com' },
    ],
    'bolsa-familia': [
      { key: 'sb1', label: 'SMS Bolsa (sb1)', path: '/sms-bolsa', domain: 'https://sms.nhpbolsa.com' },
    ],
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
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

  // ── Helper comparativo (#3) ──
  const getComparativo = (atual, anterior) => {
    if (!anterior || anterior === 0) return null;
    const diff = ((atual - anterior) / anterior) * 100;
    return { diff: Math.round(diff), up: diff >= 0 };
  };

  // ── Filtrar números por busca (#4) ──
  const numerosFiltrados = numeros.filter((n) => {
    if (!searchTerm.trim()) return true;
    const termo = searchTerm.toLowerCase().replace(/\D/g, '');
    const numLimpo = n.numero.replace(/\D/g, '');
    return numLimpo.includes(termo) || formatarNumero(n.numero).toLowerCase().includes(searchTerm.toLowerCase());
  });

  // ── Exportar CSV ──
  const exportCSV = () => {
    if (!stats || numeros.length === 0) return;
    const sep = ';';
    const linhas = [];
    // Cabeçalho do relatório
    linhas.push(`Relatório ${config.nome}`);
    linhas.push(`Período: ${filtroInicio} até ${filtroFim}`);
    linhas.push(`Total cliques: ${stats.redirectsHoje ?? 0}`);
    linhas.push(`IPs únicos: ${stats.uniqueHoje ?? 0}`);
    linhas.push('');
    // Cabeçalho da tabela
    linhas.push(['Número', 'Cliques', 'IPs Únicos', 'Status'].join(sep));
    // Dados por número
    numeros.forEach((n) => {
      const st = getNumeroStats(n.numero);
      linhas.push([
        formatarNumero(n.numero),
        st.total,
        st.uniqueIps,
        n.ativo !== false ? 'Ativo' : 'Pausado',
      ].join(sep));
    });
    // Gerar e baixar arquivo
    const bom = '\uFEFF';
    const blob = new Blob([bom + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = config.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `relatorio-${slug}-${filtroInicio}-a-${filtroFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Botão Gerenciar Usuários (admin) */}
      {isAdmin && (
        <button className="btn-manage-users" onClick={() => setShowUsuarios(!showUsuarios)}>
          👥 Gerenciar Usuários
        </button>
      )}

      {/* Painel de Usuários */}
      {showUsuarios && isAdmin && (
        <div className="usuarios-card">
          <div className="card-header">
            <h2>👥 Usuários</h2>
            <button className="btn-close-usuarios" onClick={() => setShowUsuarios(false)}>✕</button>
          </div>

          <div className="usuario-add-form">
            <input type="email" placeholder="Email" value={novoUsuarioEmail}
              onChange={(e) => setNovoUsuarioEmail(e.target.value)} />
            <input type="text" placeholder="Senha (opcional)" value={novoUsuarioSenha}
              onChange={(e) => setNovoUsuarioSenha(e.target.value)} />
            <select value={novoUsuarioRole} onChange={(e) => setNovoUsuarioRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="operador">Operador</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn-add" onClick={handleAddUsuario}>+ Adicionar</button>
          </div>

          <div className="usuarios-list">
            {usuarios.map((u) => (
              <div key={u.id} className="usuario-item">
                <div className="usuario-info">
                  <span className="usuario-email">{u.email}</span>
                  <span className={`usuario-role role-${u.role}`}>{u.role}</span>
                </div>
                <div className="usuario-actions">
                  <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="operador">Operador</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="btn-remove-usuario" onClick={() => handleDeleteUsuario(u.id)}
                    title="Remover usuário">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        <div className="product-selector">
          {Object.entries(PRODUTOS).map(([key, p]) => {
            const ds = dashboardStats[key];
            return (
              <button key={key} className="product-card" onClick={() => handleSelectProduto(key)}>
                <span className="product-emoji">{p.emoji}</span>
                <div className="product-info">
                  <span className="product-name">{p.nome}</span>
                  {ds ? (
                    <div className="product-stats">
                      <span className="product-stat">
                        <span className="product-stat-value">{ds.redirectsHoje ?? 0}</span>
                        <span className="product-stat-label">cliques hoje</span>
                        {ds.redirectsOntem > 0 && (() => {
                          const cmp = getComparativo(ds.redirectsHoje, ds.redirectsOntem);
                          if (!cmp) return null;
                          return (
                            <span className={`product-stat-compare ${cmp.up ? 'compare-up' : 'compare-down'}`}>
                              {cmp.up ? '↑' : '↓'} {Math.abs(cmp.diff)}%
                            </span>
                          );
                        })()}
                      </span>
                      <span className="product-stat-divider">·</span>
                      <span className="product-stat">
                        <span className="product-stat-value">{ds.uniqueHoje ?? 0}</span>
                        <span className="product-stat-label">IPs únicos</span>
                      </span>
                      <span className="product-stat-divider">·</span>
                      <span className="product-stat">
                        <span className="product-stat-value">{ds.ativos}/{ds.totalNumeros}</span>
                        <span className="product-stat-label">números</span>
                      </span>
                    </div>
                  ) : (
                    <span className="product-stat-loading">Carregando...</span>
                  )}
                </div>
                <span className="product-arrow">→</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Admin Panel (produto selecionado) ──
  const maxCliques = getMaxCliques();

  return (
    <div className={`page-wrapper ${logOpen ? 'log-open' : ''}`}>
    {/* Side Panel - Log de Atividades */}
    <div className={`log-sidebar ${logOpen ? 'open' : ''}`}>
      <div className="log-sidebar-header">
        <h3>📋 Log de Atividades</h3>
        <button className="log-sidebar-close" onClick={() => setLogOpen(false)}>✕</button>
      </div>
      {activityLog.length === 0 ? (
        <p className="log-empty">Nenhuma atividade registrada.</p>
      ) : (
        <div className="activity-list">
          {activityLog.map((log) => {
            const acaoEmoji = { adicionou: '➕', removeu: '🗑️', pausou: '⏸️', ativou: '▶️' };
            const acaoClass = { adicionou: 'acao-add', removeu: 'acao-remove', pausou: 'acao-pause', ativou: 'acao-activate' };
            const dt = new Date(log.created_at);
            const timeStr = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={log.id} className={`activity-item ${acaoClass[log.acao] || ''}`}>
                <span className="activity-emoji">{acaoEmoji[log.acao] || '•'}</span>
                <div className="activity-info">
                  <span className="activity-text">
                    <strong>{log.usuario}</strong> {log.acao} <strong>{formatarNumero(log.numero)}</strong>
                  </span>
                  <span className="activity-time">{timeStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    <div className="page">
      {/* Botão toggle log */}
      <button className="btn-log-toggle" onClick={() => setLogOpen(!logOpen)} title="Log de Atividades">
        📋
      </button>
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
        <span className="user-email">👤 {session.user.email} {userRole && <span className={`role-badge role-${userRole}`}>{userRole}</span>}</span>
        <button className="btn-logout" onClick={handleLogout}>Sair</button>
      </div>
      <h1>{config.emoji} {config.nome}</h1>
      <p className="subtitle">{config.desc}</p>
      {lastUpdated && (
        <span className="polling-indicator" title={`Última atualização: ${lastUpdated.toLocaleTimeString('pt-BR')}`}>
          🟢 Atualizado {agoText}
        </span>
      )}

      {/* Abas: Painel / Monitoramento (#7) */}
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'painel' ? 'tab-active' : ''}`} onClick={() => setActiveTab('painel')}>
          📊 Painel
        </button>
        <button className={`tab-btn ${activeTab === 'monitoramento' ? 'tab-active' : ''}`} onClick={() => setActiveTab('monitoramento')}>
          🔍 Monitoramento
          {healthAlerts && !healthAlerts.ok && <span className="tab-badge">!</span>}
        </button>
      </div>

      {/* Notificação de alertas (#5) */}
      {activeTab === 'painel' && healthAlerts && !healthAlerts.ok && !healthDismissed && (
        <div className="health-banner health-banner-danger">
          <div className="health-banner-content">
            <span className="health-banner-icon">🚨</span>
            <div className="health-banner-text">
              <strong>{healthAlerts.problemas.length} problema{healthAlerts.problemas.length > 1 ? 's' : ''} detectado{healthAlerts.problemas.length > 1 ? 's' : ''}</strong>
              <span className="health-banner-detail">
                {healthAlerts.problemas.slice(0, 2).map(p => p.mensagem).join(' · ')}
              </span>
            </div>
            <button className="health-banner-action" onClick={() => setActiveTab('monitoramento')}>Ver detalhes →</button>
            <button className="health-banner-dismiss" onClick={() => setHealthDismissed(true)}>✕</button>
          </div>
        </div>
      )}
      {activeTab === 'painel' && healthAlerts && healthAlerts.ok && healthAlerts.avisos?.length > 0 && !healthDismissed && (
        <div className="health-banner health-banner-warn">
          <div className="health-banner-content">
            <span className="health-banner-icon">💡</span>
            <div className="health-banner-text">
              <strong>{healthAlerts.avisos.length} aviso{healthAlerts.avisos.length > 1 ? 's' : ''}</strong>
              <span className="health-banner-detail">
                {healthAlerts.avisos.slice(0, 2).map(a => a.mensagem).join(' · ')}
              </span>
            </div>
            <button className="health-banner-action" onClick={() => setActiveTab('monitoramento')}>Ver →</button>
            <button className="health-banner-dismiss" onClick={() => setHealthDismissed(true)}>✕</button>
          </div>
        </div>
      )}

      {/* ═══ ABA PAINEL ═══ */}
      {activeTab === 'painel' && (
      <>
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

        {/* Links extras de disparo */}
        {extraDisparoLinks[produto] && extraDisparoLinks[produto].map(link => {
          const linkUrl = (link.domain || window.location.origin) + link.path;
          return (
            <div className="redirect-link-box" key={link.key} style={{ marginTop: 8 }}>
              <span className="redirect-link">
                <strong style={{ marginRight: 8 }}>{link.label}</strong>
                {linkUrl}
              </span>
              <button className="btn-copy-main" onClick={() => handleCopySmsLink(link.key, linkUrl)}>
                {copiedSms === link.key ? '✓ Copiado!' : <><CopyIcon size={14} /> Copiar</>}
              </button>
            </div>
          );
        })}

        {/* Links SMS */}
        {smsLinks[produto] && smsLinks[produto].length > 0 && (
          <div className="sms-links-section">
            <h3 style={{ margin: '18px 0 8px', fontSize: '0.95rem', opacity: 0.85 }}>📲 Links para Disparo SMS</h3>
            {smsLinks[produto].map(link => {
              const smsUrl = (link.domain || window.location.origin) + link.path;
              return (
                <div className="redirect-link-box sms-link-box" key={link.key} style={{ marginBottom: 8 }}>
                  <span className="redirect-link" style={{ fontSize: '0.85rem' }}>
                    <strong style={{ marginRight: 8 }}>{link.label}</strong>
                    {smsUrl}
                  </span>
                  <button className="btn-copy-main" onClick={() => handleCopySmsLink(link.key, smsUrl)}>
                    {copiedSms === link.key ? '✓ Copiado!' : <><CopyIcon size={14} /> Copiar</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{stats?.totalRedirects ?? '—'}</span>
            <span className="stat-label">Redirects total</span>
          </div>
          <div className="stat-card stat-card-highlight">
            <span className="stat-value">{stats?.redirectsHoje ?? '—'}</span>
            <span className="stat-label">Cliques período</span>
            {/* Comparativo (#3) — usa historico se disponível */}
            {(() => {
              if (!stats?.historico || stats.historico.length < 2) return null;
              const hojeH = stats.historico.find(h => h.isHoje);
              const ontemH = stats.historico[stats.historico.length - 2];
              if (!hojeH || !ontemH || ontemH.cliques === 0) return null;
              const cmp = getComparativo(hojeH.cliques, ontemH.cliques);
              if (!cmp) return null;
              return (
                <span className={`stat-compare ${cmp.up ? 'compare-up' : 'compare-down'}`}>
                  {cmp.up ? '↑' : '↓'} {Math.abs(cmp.diff)}% vs {ontemH.dia}
                </span>
              );
            })()}
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats?.uniqueHoje ?? '—'}</span>
            <span className="stat-label">IPs únicos período</span>
            {(() => {
              if (!stats?.historico || stats.historico.length < 2) return null;
              const hojeH = stats.historico.find(h => h.isHoje);
              const ontemH = stats.historico[stats.historico.length - 2];
              if (!hojeH || !ontemH || ontemH.uniqueIps === 0) return null;
              const cmp = getComparativo(hojeH.uniqueIps, ontemH.uniqueIps);
              if (!cmp) return null;
              return (
                <span className={`stat-compare ${cmp.up ? 'compare-up' : 'compare-down'}`}>
                  {cmp.up ? '↑' : '↓'} {Math.abs(cmp.diff)}% vs {ontemH.dia}
                </span>
              );
            })()}
          </div>
          <div className="stat-card">
            <span className="stat-value">{numeros.length}</span>
            <span className="stat-label">Números ativos</span>
          </div>
        </div>

        {/* Filtro por Período */}
        <div className="filtro-periodo">
          <span className="filtro-label">📅 Período:</span>
          <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} max={filtroFim} />
          <span className="filtro-sep">até</span>
          <input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} min={filtroInicio} max={hoje} />
          <button className="btn-filtro-hoje" onClick={() => { setFiltroInicio(hoje); setFiltroFim(hoje); }}>Hoje</button>
          <button className="btn-filtro-7d" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setFiltroInicio(d.toISOString().split('T')[0]); setFiltroFim(hoje); }}>7 dias</button>
          <button className="btn-filtro-30d" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 29); setFiltroInicio(d.toISOString().split('T')[0]); setFiltroFim(hoje); }}>30 dias</button>
          <button className="btn-export-csv" onClick={exportCSV} title="Exportar dados como CSV">⬇ Exportar CSV</button>
        </div>

        {/* Histórico do período */}
        {stats?.historico && stats.historico.length > 0 && (
          <div className="historico-section">
            <h3 className="historico-title">📊 Histórico do Período</h3>
            <div className="historico-legenda">
              <span className="legenda-item"><span className="legenda-cor legenda-cliques"></span>Cliques</span>
              <span className="legenda-item"><span className="legenda-cor legenda-ips"></span>IPs únicos</span>
            </div>
            <div className="historico-chart">
              {stats.historico.map((h, i) => {
                const maxHist = Math.max(...stats.historico.map(x => x.cliques), 1);
                const barCliques = (h.cliques / maxHist) * 100;
                const barIps = (h.uniqueIps / maxHist) * 100;
                const isHoje = h.isHoje;
                return (
                  <div key={h.data} className={`historico-bar-col ${isHoje ? 'historico-hoje' : ''}`}>
                    <div className="historico-valores">
                      <span className="historico-valor">{h.cliques}</span>
                      <span className="historico-valor historico-valor-ip">{h.uniqueIps}</span>
                    </div>
                    <div className="historico-bars-duo">
                      <div className="historico-bar-bg">
                        <div className="historico-bar-fill" style={{ height: `${barCliques}%` }}></div>
                      </div>
                      <div className="historico-bar-bg historico-bar-bg-ip">
                        <div className="historico-bar-fill-ip" style={{ height: `${barIps}%` }}></div>
                      </div>
                    </div>
                    <span className="historico-dia">{isHoje ? 'Hoje' : h.dia}</span>
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

        {/* Busca/Filtro de números (#4) */}
        {numeros.length > 5 && (
          <div className="search-numeros">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
            )}
            {searchTerm && (
              <span className="search-count">{numerosFiltrados.length} de {numeros.length}</span>
            )}
          </div>
        )}

        {/* Alerta: números sem cliques */}
        {(() => {
          const semCliques = numeros.filter(n => {
            if (n.ativo === false) return false;
            const st = getNumeroStats(n.numero);
            return st.total === 0;
          });
          if (semCliques.length === 0) return null;
          return (
            <div className="alerta-sem-cliques">
              <span className="alerta-icon">⚠️</span>
              <span>{semCliques.length} número{semCliques.length > 1 ? 's' : ''} ativo{semCliques.length > 1 ? 's' : ''} sem cliques no período</span>
            </div>
          );
        })()}

        {canEdit && (
        <div className="input-area">
          <input ref={inputRef} type="text" placeholder="Ex: 48999998888"
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} />
          <button className="btn-add" onClick={handleAdd}>+ Adicionar</button>
        </div>
        )}

        <div className="numbers-list">
          {numerosFiltrados.length === 0 && !searchTerm && (
            <div className="empty-msg">Nenhum número cadastrado. Adicione acima.</div>
          )}
          {numerosFiltrados.length === 0 && searchTerm && (
            <div className="empty-msg">Nenhum número encontrado para "{searchTerm}"</div>
          )}
          {numerosFiltrados.map((n, idx) => {
            const st = getNumeroStats(n.numero);
            const percent = maxCliques > 0 ? (st.total / maxCliques) * 100 : 0;
            const isAtivo = n.ativo !== false;
            const semClique = isAtivo && st.total === 0;
            return (
              <div key={n.id} className={`number-item ${!isAtivo ? 'number-item-paused' : ''} ${semClique ? 'number-item-warn' : ''}`}>
                <span className="num-index">{idx + 1}.</span>
                <div className="num-info">
                  <div className="num-top-row">
                    <span className="num-value">{formatarNumero(n.numero)}</span>
                    <button className="btn-copy-num" onClick={() => handleCopyNumero(n.numero)}
                      title="Copiar número">
                      {copiedNumero === n.numero ? '✓' : <CopyIcon size={14} />}
                    </button>
                    <span className="num-redirects">{st.total} cliques · {st.uniqueIps} pessoas</span>
                    {semClique && <span className="num-warn-badge" title="Sem cliques no período">⚠️</span>}
                    {canEdit && (
                    <button
                      className={`btn-toggle ${isAtivo ? 'btn-toggle-on' : 'btn-toggle-off'}`}
                      onClick={() => handleToggle(n.id, n.numero, isAtivo)}
                      title={isAtivo ? 'Pausar número' : 'Ativar número'}>
                      {isAtivo ? 'Ativo' : 'Pausado'}
                    </button>
                    )}
                    {canEdit && (
                    <button className="btn-remove"
                      onClick={() => setConfirmDelete({ id: n.id, numero: n.numero })}
                      title="Remover número">&times;</button>
                    )}
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
      </>
      )}

      {/* ═══ ABA MONITORAMENTO (#7) ═══ */}
      {activeTab === 'monitoramento' && (
      <div className="monitoring-section">
        {/* Status Cards */}
        <div className="monitoring-grid">
          <div className={`monitoring-status-card ${healthAlerts?.ok ? 'status-ok' : 'status-danger'}`}>
            <span className="monitoring-status-icon">{healthAlerts?.ok ? '✅' : '🚨'}</span>
            <div className="monitoring-status-info">
              <span className="monitoring-status-title">{healthAlerts?.ok ? 'Sistema OK' : 'Problemas Detectados'}</span>
              <span className="monitoring-status-detail">
                Verificado às {healthAlerts?.hora_brasilia || '--:--'}
              </span>
            </div>
          </div>

          <div className="monitoring-stat-card">
            <span className="monitoring-stat-value">{healthAlerts?.total_cliques_hoje ?? '—'}</span>
            <span className="monitoring-stat-label">Cliques hoje (todos)</span>
          </div>

          <div className="monitoring-stat-card">
            <span className="monitoring-stat-value">{healthAlerts?.total_cliques_1h ?? '—'}</span>
            <span className="monitoring-stat-label">Última hora</span>
          </div>

          <div className="monitoring-stat-card">
            <span className="monitoring-stat-value">
              {healthAlerts?.numeros_ativos ? `${healthAlerts.numeros_ativos.fgts + healthAlerts.numeros_ativos.bolsa}` : '—'}
            </span>
            <span className="monitoring-stat-label">Números ativos</span>
          </div>
        </div>

        {/* Gráfico tempo real (#6) */}
        <div className="realtime-card">
          <div className="realtime-header">
            <h3>⚡ Cliques em Tempo Real</h3>
            <span className="realtime-subtitle">Últimos 60 minutos · {realtimeData?.total ?? 0} total</span>
          </div>
          <div className="realtime-chart">
            {realtimeData?.minutos ? realtimeData.minutos.map((val, i) => {
              const heightPct = realtimeData.pico > 0 ? (val / realtimeData.pico) * 100 : 0;
              const isRecent = i >= 55;
              return (
                <div key={i} className={`realtime-bar-col ${isRecent ? 'realtime-recent' : ''}`}
                  title={`${60 - i} min atrás: ${val} cliques`}>
                  <div className="realtime-bar-bg">
                    <div className="realtime-bar-fill" style={{ height: `${Math.max(heightPct, val > 0 ? 3 : 0)}%` }}></div>
                  </div>
                </div>
              );
            }) : (
              <div className="realtime-loading">Carregando dados...</div>
            )}
          </div>
          <div className="realtime-labels">
            <span>-60 min</span>
            <span>-30 min</span>
            <span>agora</span>
          </div>
        </div>

        {/* Alertas e Avisos */}
        {healthAlerts && (healthAlerts.problemas.length > 0 || healthAlerts.avisos.length > 0) && (
          <div className="monitoring-alerts-card">
            <h3>📋 Alertas e Avisos</h3>
            {healthAlerts.problemas.length > 0 && (
              <div className="monitoring-alert-group">
                <h4 className="alert-group-title alert-danger-title">🚨 Problemas ({healthAlerts.problemas.length})</h4>
                {healthAlerts.problemas.map((p, i) => (
                  <div key={i} className="monitoring-alert-item alert-item-danger">
                    <span>{p.mensagem}</span>
                  </div>
                ))}
              </div>
            )}
            {healthAlerts.avisos.length > 0 && (
              <div className="monitoring-alert-group">
                <h4 className="alert-group-title alert-warn-title">💡 Avisos ({healthAlerts.avisos.length})</h4>
                {healthAlerts.avisos.map((a, i) => (
                  <div key={i} className="monitoring-alert-item alert-item-warn">
                    <span>{a.mensagem}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {healthAlerts && healthAlerts.problemas.length === 0 && healthAlerts.avisos.length === 0 && (
          <div className="monitoring-alerts-card monitoring-all-clear">
            <span className="all-clear-icon">🎉</span>
            <span className="all-clear-text">Nenhum alerta ativo. Sistema funcionando normalmente!</span>
          </div>
        )}

        {/* Info Workflows n8n */}
        <div className="monitoring-workflows-card">
          <h3>🤖 Workflows n8n</h3>
          <div className="workflow-list">
            <div className="workflow-item">
              <span className="workflow-status-dot dot-active"></span>
              <div className="workflow-info">
                <span className="workflow-name">📧 Relatório Diário</span>
                <span className="workflow-detail">Envio automático por e-mail às 22h · Resumo completo do dia</span>
              </div>
            </div>
            <div className="workflow-item">
              <span className="workflow-status-dot dot-active"></span>
              <div className="workflow-info">
                <span className="workflow-name">🚨 Alertas de Problemas</span>
                <span className="workflow-detail">Verificação a cada 2h · Envia e-mail se detectar problemas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Atividade Recente */}
        {activityLog.length > 0 && (
          <div className="monitoring-activity-card">
            <h3>📋 Atividade Recente</h3>
            <div className="monitoring-activity-list">
              {activityLog.slice(0, 10).map((log) => {
                const acaoEmoji = { adicionou: '➕', removeu: '🗑️', pausou: '⏸️', ativou: '▶️' };
                const dt = new Date(log.created_at);
                const timeStr = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={log.id} className="monitoring-activity-item">
                    <span className="monitoring-activity-emoji">{acaoEmoji[log.acao] || '•'}</span>
                    <span className="monitoring-activity-text">
                      <strong>{log.usuario}</strong> {log.acao} <strong>{formatarNumero(log.numero)}</strong>
                    </span>
                    <span className="monitoring-activity-time">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
    </div>
  );
}

export default App;
