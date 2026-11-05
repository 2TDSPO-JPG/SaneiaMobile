const { getDefaultConfig } = require('expo/metro-config');
const { timingSafeEqual } = require('node:crypto');
const { request } = require('node:http');

const config = getDefaultConfig(__dirname);
const enhance = config.server.enhanceMiddleware;
const prefix = '/__saneia_iot';
const port = Number(process.env.SANEIA_IOT_UPSTREAM_PORT);
const token = process.env.EXPO_PUBLIC_IOT_DEMO_TOKEN;

function send(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ message }));
}

config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhance(middleware, server);
  return (req, res, callback) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith(`${prefix}/`)) return next(req, res, callback);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !token) {
      return send(res, 503, 'A ponte IoT não está configurada no Expo.');
    }
    const route = path.slice(prefix.length);
    const allowed = (req.method === 'GET' && /^\/sensors(?:\/[\w-]+)?$/.test(route))
      || (req.method === 'POST' && /^\/sensors\/[\w-]+\/insights$/.test(route));
    if (!allowed) return send(res, 404, 'Rota IoT não encontrada.');

    const authorization = req.headers.authorization || '';
    const expected = Buffer.from(`Bearer ${token}`);
    const provided = Buffer.from(authorization);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return send(res, 401, 'Token da demonstração inválido.');
    }
    const headers = { authorization };
    for (const header of ['content-type', 'content-length']) {
      if (req.headers[header]) headers[header] = req.headers[header];
    }
    const upstream = request({ hostname: '127.0.0.1', port, path: route, method: req.method, headers }, (reply) => {
      res.writeHead(reply.statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      reply.pipe(res);
    });
    upstream.setTimeout(13_000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) send(res, 502, 'Não foi possível acessar a ponte IoT. Confira o PowerShell do Saneia.');
      else res.destroy();
    });
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
};

module.exports = config;
