// Cloudflare Pages Function: /proxy?target=<base>&path=<path>
// 通用 CORS 代理，解决浏览器访问第三方 API 的跨域问题

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Headers': '*',
};

function filterHeaders(inHeaders) {
  const out = new Headers();
  for (const [k, v] of inHeaders.entries()) {
    const lk = k.toLowerCase();
    if (lk === 'host' || lk === 'connection' || lk === 'content-length') continue;
    out.set(k, v);
  }
  return out;
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const target = url.searchParams.get('target');
  const targetPath = url.searchParams.get('path') || '';

  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response('400 Bad Request: missing or invalid ?target=', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
    });
  }

  let targetUrl;
  try {
    const search = url.search
      .replace(/&?target=[^&]*/g, '')
      .replace(/&?path=[^&]*/g, '')
      .replace(/^&/, '');
    targetUrl = new URL(
      target.replace(/\/+$/, '') + '/' + targetPath.replace(/^\//, '') + (search ? '?' + search : '')
    );
  } catch (e) {
    return new Response('400 Bad Request: invalid target url', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
    });
  }

  try {
    const init = {
      method: request.method,
      headers: filterHeaders(request.headers),
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    const response = await fetch(targetUrl, init);
    const outHeaders = {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      ...corsHeaders,
    };
    if (response.headers.get('content-length')) {
      outHeaders['Content-Length'] = response.headers.get('content-length');
    }
    if (response.headers.get('content-disposition')) {
      outHeaders['Content-Disposition'] = response.headers.get('content-disposition');
    }
    return new Response(response.body, { status: response.status, headers: outHeaders });
  } catch (err) {
    return new Response('502 Bad Gateway: 无法连接到目标 API (' + err.message + ')', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
    });
  }
}
