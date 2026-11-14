const { isIP } = require('node:net');

function publicApi(name) {
  let url;
  try {
    url = new URL(process.env[name]?.trim());
  } catch {
    throw new Error(`Configure ${name} com a URL HTTPS pública da API.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || !url.hostname.includes('.') || isIP(url.hostname) || /\.(localhost|local|test|example|internal)$/.test(url.hostname)
      || !/\/api\/?$/.test(url.pathname) || /\/__(saneia_monitoring|saneia_iot)(\/|$)/.test(url.pathname)) {
    throw new Error(`Configure ${name} com a URL HTTPS pública da API, incluindo /api.`);
  }
}

if (process.env.EAS_BUILD_PROFILE === 'avaliacao') {
  publicApi('EXPO_PUBLIC_API_URL');
  publicApi('EXPO_PUBLIC_MONITORING_API_URL');
  if (process.env.EXPO_PUBLIC_LOCAL_MODE === 'true') {
    throw new Error('Desative EXPO_PUBLIC_LOCAL_MODE no build de avaliação.');
  }
  if (!/^[a-f0-9]{40}$/i.test(process.env.EAS_BUILD_GIT_COMMIT_HASH ?? process.env.SANEIA_COMMIT_HASH ?? '')) {
    throw new Error('Informe o hash Git completo do código que será avaliado.');
  }
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !process.env.SANEIA_ANDROID_MAPS_KEY?.trim()) {
    throw new Error('Configure SANEIA_ANDROID_MAPS_KEY para o mapa do APK instalado.');
  }
  console.log('Configuração do build de avaliação validada.');
}
