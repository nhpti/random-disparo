# Random Disparo — CLT & FGTS

Gerenciador de números para disparo no WhatsApp com redirect automático.  
Substitui o CurtLink — cada clique no link redireciona para um número aleatório.

**React** (painel admin) + **Vercel** (serverless) + **Supabase** (banco de dados).

---

## Como funciona

```
Pessoa clica no link /fgts → Vercel pega número aleatório do Supabase → 302 redirect → wa.me/55XXXXX
```

---

## Estrutura

```
random_disparo/
├── api/                    ← Serverless functions (rodam na Vercel)
│   ├── fgts.js             ← Redirect público (substitui o CurtLink)
│   ├── stats.js            ← Estatísticas de cliques
│   └── numeros/
│       ├── index.js        ← GET/POST números
│       └── [id].js         ← DELETE número
├── lib/
│   └── supabase.js         ← Conexão com Supabase
├── src/                    ← Frontend React (painel admin)
│   ├── App.js
│   ├── App.css
│   ├── api.js
│   └── index.js
├── public/
│   └── index.html
├── vercel.json             ← Config de rotas da Vercel
├── package.json
└── README.md
```

---

## Deploy na Vercel (passo a passo)

### 1. Criar conta no Supabase (banco de dados gratuito)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto (escolha uma senha e região)
3. No painel, vá em **SQL Editor** e rode:

```sql
CREATE TABLE numeros (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE redirect_log (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. Vá em **Settings → API** e copie:
   - `Project URL` (ex: https://xxxxx.supabase.co)
   - `service_role key` (a chave secreta, NÃO a anon)

### 2. Deploy na Vercel (hospedagem gratuita)

1. Suba este projeto no [GitHub](https://github.com)
2. Acesse [vercel.com](https://vercel.com) e conecte o repositório
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` → o Project URL do passo anterior
   - `SUPABASE_SERVICE_KEY` → a service_role key
4. Clique em **Deploy**

### 3. Usar

- **Painel admin**: `https://seu-projeto.vercel.app`
- **Link para disparo**: `https://seu-projeto.vercel.app/fgts`

Se quiser usar um domínio próprio (ex: outro domínio novo), configure em **Settings → Domains** na Vercel.

---

## API Endpoints

| Método   | Rota               | Descrição                       |
|----------|--------------------|---------------------------------|
| `GET`    | `/fgts`            | Redirect público → WhatsApp     |
| `GET`    | `/api/numeros`     | Listar números ativos           |
| `POST`   | `/api/numeros`     | Adicionar `{ numero }`          |
| `DELETE` | `/api/numeros/:id` | Remover número                  |
| `GET`    | `/api/stats`       | Estatísticas de redirects       |

---

## Dev local

```bash
npm install
npm start        # React na porta 3000
```

As API functions só funcionam na Vercel (ou com `vercel dev`).
