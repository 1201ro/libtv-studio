const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = __dirname;
// 云端部署时由平台注入端口（如 CloudStudio / Render / Railway），本地默认 3000
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// CORS 头（允许任意来源，便于页面跨域访问本地代理 / 从 file:// 打开也能用）
function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    'access-control-allow-headers': '*',
  };
}

// ==================== ComfyUI 代理 ====================
// 浏览器 -> http://localhost:8091/comfy/<rest>?target=<ComfyUI基础地址>
// 转发到 <ComfyUI基础地址>/<rest>，规避 CORS 限制
function proxyToComfyUI(req, res) {
  const fullUrl = new URL(req.url, 'http://localhost');
  const target = fullUrl.searchParams.get('target');
  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
    res.end('400 Bad Request: missing or invalid ?target=');
    return;
  }
  const rest = fullUrl.searchParams.get('path') || decodeURIComponent(fullUrl.pathname).replace(/^\/comfy\/?/, '');
  let targetUrl;
  try {
    targetUrl = new URL(rest + fullUrl.search.replace(/&?target=[^&]*/, '').replace(/&?path=[^&]*/, ''), target.replace(/\/+$/, '') + '/');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
    res.end('400 Bad Request: invalid target url');
    return;
  }

  const mod = targetUrl.protocol === 'https:' ? https : http;
  const headers = filterHeaders(req.headers);

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    if (body && !headers['content-length']) headers['content-length'] = body.length;

    const upstream = mod.request(targetUrl, { method: req.method, headers }, (up) => {
      const outHeaders = {
        'content-type': up.headers['content-type'] || 'application/octet-stream',
        ...corsHeaders(),
      };
      if (up.headers['content-length']) outHeaders['content-length'] = up.headers['content-length'];
      if (up.headers['content-disposition']) outHeaders['content-disposition'] = up.headers['content-disposition'];
      res.writeHead(up.statusCode, outHeaders);
      up.pipe(res);
    });

    upstream.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
      res.end('502 Bad Gateway: 无法连接 ComfyUI (' + err.message + ')。请确认 ComfyUI 已启动且地址正确。');
    });

    if (body) upstream.write(body);
    upstream.end();
  });
}

// ==================== 通用 CORS 代理 ====================
// 浏览器 -> http://localhost:8091/proxy?target=<目标基础地址>&path=<目标路径>
// 转发到 <目标基础地址><目标路径>，用于解决浏览器直接访问第三方 HTTPS API 的 CORS 问题
function proxyToTarget(req, res) {
  const fullUrl = new URL(req.url, 'http://localhost');
  const target = fullUrl.searchParams.get('target');
  const targetPath = fullUrl.searchParams.get('path') || '';
  if (!target || !/^https?:\/\//i.test(target)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
    res.end('400 Bad Request: missing or invalid ?target=');
    return;
  }
  let targetUrl;
  try {
    targetUrl = new URL(target.replace(/\/+$/, '') + '/' + targetPath.replace(/^\//, '') + fullUrl.search.replace(/&?target=[^&]*/, '').replace(/&?path=[^&]*/, ''));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
    res.end('400 Bad Request: invalid target url');
    return;
  }

  const mod = targetUrl.protocol === 'https:' ? https : http;
  const headers = filterHeaders(req.headers);

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    if (body && !headers['content-length']) headers['content-length'] = body.length;

    const upstream = mod.request(targetUrl, { method: req.method, headers }, (up) => {
      const outHeaders = {
        'content-type': up.headers['content-type'] || 'application/octet-stream',
        ...corsHeaders(),
      };
      if (up.headers['content-length']) outHeaders['content-length'] = up.headers['content-length'];
      if (up.headers['content-disposition']) outHeaders['content-disposition'] = up.headers['content-disposition'];
      res.writeHead(up.statusCode, outHeaders);
      up.pipe(res);
    });

    upstream.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
      res.end('502 Bad Gateway: 无法连接到目标 API (' + err.message + ')。请确认目标地址可访问且 API 服务正常。');
    });

    if (body) upstream.write(body);
    upstream.end();
  });
}

// 转发请求头：保留除 host / connection 之外的全部头，避免部分网关需要的自定义头被丢弃
function filterHeaders(inHeaders) {
  const out = {};
  for (const k of Object.keys(inHeaders)) {
    const lk = k.toLowerCase();
    if (lk === 'host' || lk === 'connection' || lk === 'content-length') continue;
    out[k] = inHeaders[k];
  }
  return out;
}

http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);

  // 健康检查（供前端判断本地代理是否存活）
  if (p === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() });
    res.end(JSON.stringify({ ok: true, time: Date.now() }));
    return;
  }

  // 预检请求（CORS preflight）：直接返回 204，避免跨域打开页面时连接被浏览器拦截
  if (req.method === 'OPTIONS' && (p === '/proxy' || p.startsWith('/proxy/') || p === '/comfy' || p.startsWith('/comfy/'))) {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // 通用 CORS 代理
  if (p === '/proxy' || p.startsWith('/proxy/')) {
    proxyToTarget(req, res);
    return;
  }

  // ComfyUI 代理
  if (p === '/comfy' || p.startsWith('/comfy/')) {
    proxyToComfyUI(req, res);
    return;
  }

  // 静态文件
  if (p === '/') {
    const fp = path.join(root, 'index.html');
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('404 Not Found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  const fp = path.join(root, p);
  // 防目录穿越
  if (!fp.startsWith(root)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found: ' + p);
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, HOST, () => {
  console.log('Server running at http://' + HOST + ':' + PORT);
  console.log('Root:', root);
  console.log('ComfyUI proxy: /comfy/<path>?target=http://127.0.0.1:8188');
  console.log('General proxy: /proxy?target=<base>&path=<path>');
  console.log('Health check: /api/ping');
});
