import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getNumeros, addNumero, deleteNumero, getStats } from './api';
import { supabase } from './supabaseClient';
import './App.css';

const REDIRECT_PATH = '/fgts';

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [numeros, setNumeros] = useState([]);
  const [input, setInput] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const inputRef = useRef(null);

  const redirectUrl = window.location.origin + REDIRECT_PATH;

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
    if (error) {
      setLoginError(error.message);
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getAccessToken = () => session?.access_token || '';

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const token = session.access_token;
      const [nums, st] = await Promise.all([getNumeros(token), getStats(token)]);
      setNumeros(nums);
      setStats(st);
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, session]);

  const handleAdd = async () => {
    const value = input.trim();
    if (!value) return;
    try {
      await addNumero(value, getAccessToken());
      setInput('');
      fetchData();
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNumero(id, getAccessToken());
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(redirectUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTest = async () => {
    if (numeros.length === 0 || testing) return;
    setTesting(true);
    setTestResult('');
    const results = [];
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch('/api/fgts', { redirect: 'manual' });
        const location = res.headers.get('location') || '';
        if (location) {
          results.push(location);
        } else {
          // fallback: buscar via API random
          const apiRes = await fetch('/api/numeros');
          const data = await apiRes.json();
          if (data.length > 0) {
            const rand = data[Math.floor(Math.random() * data.length)];
            results.push(`wa.me/55${rand.numero.replace(/\D/g, '')}`);
          }
        }
      } catch {
        results.push('(erro)');
      }
    }
    setTestResult(results.join('  →  '));
    setTesting(false);
    fetchData();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const getNumeroStats = (numero) => {
    if (!stats?.porNumero) return 0;
    const found = stats.porNumero.find(s => s.numero === numero);
    return found ? found.total : 0;
  };

  // ── Loading ──
  if (authLoading) {
    return (
      <div className="page">
        <div className="login-container">
          <p style={{ textAlign: 'center', color: '#888' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // ── Login Screen ──
  if (!session) {
    return (
      <div className="page">
        <div className="login-container">
          <h1>Random Disparo</h1>
          <p className="subtitle">Faça login para acessar o painel</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="E-mail"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              type="password"
              placeholder="Senha"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            {loginError && <p className="login-error">{loginError}</p>}
            <button type="submit" className="btn-login" disabled={loginLoading}>
              {loginLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin Panel ──
  return (
    <div className="page">
      <div className="top-bar">
        <span className="user-email">{session.user.email}</span>
        <button className="btn-logout" onClick={handleLogout}>Sair</button>
      </div>
      <h1>Random Disparo</h1>
      <p className="subtitle">Gerenciador de números ativos — CLT & FGTS</p>

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
            {copied ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{stats?.totalRedirects ?? '—'}</span>
            <span className="stat-label">Redirects total</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats?.redirectsHoje ?? '—'}</span>
            <span className="stat-label">Hoje</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{numeros.length}</span>
            <span className="stat-label">Números ativos</span>
          </div>
        </div>

        <button
          className="btn-test"
          onClick={handleTest}
          disabled={testing || numeros.length === 0}
        >
          {testing ? 'Testando...' : 'Testar Randomização'}
        </button>
        {testResult && (
          <div className="test-result">
            <span className="test-label">Resultado:</span> {testResult}
          </div>
        )}
      </div>

      {/* Números Ativos */}
      <div className="numbers-card">
        <div className="card-header">
          <h2>Números Ativos</h2>
          <span className="counter">{numeros.length}</span>
        </div>

        <div className="input-area">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ex: 11999998888"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn-add" onClick={handleAdd}>Adicionar</button>
        </div>

        <div className="numbers-list">
          {numeros.length === 0 && (
            <div className="empty-msg">Nenhum número ativo. Adicione acima.</div>
          )}
          {numeros.map((n, idx) => (
            <div key={n.id} className="number-item">
              <span className="num-index">{idx + 1}.</span>
              <span className="num-value">{n.numero}</span>
              <span className="num-redirects" title="Redirects para este número">
                {getNumeroStats(n.numero)} cliques
              </span>
              <span className="num-status">Ativo</span>
              <button
                className="btn-remove"
                onClick={() => handleDelete(n.id)}
                title="Remover (banido)"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
