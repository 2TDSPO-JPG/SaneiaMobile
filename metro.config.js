const { getDefaultConfig } = require('expo/metro-config');
const { timingSafeEqual } = require('node:crypto');
const { request } = require('node:http');

const config = getDefaultConfig(__dirname);
const enhance = config.server.enhanceMiddleware;
const prefix = '/__saneia_iot';
const port = Number(process.env.SANEIA_IOT_UPSTREAM_PORT);
const token = process.env.EXPO_PUBLIC_IOT_DEMO_TOKEN;
const monitoringPrefix = '/__saneia_monitoring';
const monitoringUpstream = process.env.SANEIA_MONITORING_UPSTREAM
  ? new URL(process.env.SANEIA_MONITORING_UPSTREAM) : null;

function send(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ message }));
}

function forward(req, res, options, errorMessage) {
  const upstream = request(options, (reply) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    if (reply.headers['x-total-pages']) headers['X-Total-Pages'] = reply.headers['x-total-pages'];
    res.writeHead(reply.statusCode, headers);
    reply.pipe(res);
  });
  upstream.setTimeout(12_000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!res.headersSent) send(res, 502, errorMessage);
    else res.destroy();
  });
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  req.pipe(upstream);
}

config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhance(middleware, server);
  return (req, res, callback) => {
    const path = req.url?.split('?')[0];
    if (path?.startsWith(`${monitoringPrefix}/`)) {
      const route = path.slice(monitoringPrefix.length);
      if (req.method !== 'GET' || !/^\/sensors(?:\/[\w-]+)?$/.test(route)) {
        return send(res, 404, 'Rota de monitoramento não encontrada.');
      }
      if (!monitoringUpstream || monitoringUpstream.protocol !== 'http:') {
        return send(res, 503, 'O monitoramento local não está configurado no Expo.');
      }
      return forward(req, res, {
        hostname: monitoringUpstream.hostname, port: monitoringUpstream.port,
        path: monitoringUpstream.pathname.replace(/\/+$/, '') + route + req.url.slice(path.length),
        method: 'GET', headers: { authorization: req.headers.authorization || '', accept: 'application/json' },
      }, 'O monitoramento local está indisponível. Confira se a API .NET está em execução.');
    }
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
    return forward(req, res, { hostname: '127.0.0.1', port, path: route, method: req.method, headers },
      'Não foi possível acessar a ponte IoT. Confira o PowerShell do Saneia.');
  };
};

module.exports = config;
