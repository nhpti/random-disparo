// Middleware da Vercel — roda antes de qualquer rota
// Redireciona domínios específicos quando acessam a raiz "/"
export default function middleware(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || '';

  // Só intercepta a raiz "/"
  if (url.pathname !== '/') return;

  // Mapa: domínio → path do randomizador
  const domainMap = {
    'clt.canaldojefinho.com': '/jclt',
  };

  const redirectPath = domainMap[host];
  if (redirectPath) {
    url.pathname = redirectPath;
    return Response.redirect(url.toString(), 302);
  }
}

export const config = {
  matcher: '/',
};
