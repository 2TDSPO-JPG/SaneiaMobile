const { execFileSync } = require('node:child_process');

function commitHash() {
  if (process.env.SANEIA_COMMIT_HASH) return process.env.SANEIA_COMMIT_HASH;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return null;
  }
}

module.exports = {
  name: 'Saneia',
  slug: 'saneia',
  scheme: 'saneia',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: { bundleIdentifier: 'br.com.saneia.mobile' },
  android: {
    package: 'br.com.saneia.mobile',
    ...(process.env.SANEIA_ANDROID_MAPS_KEY
      ? { config: { googleMaps: { apiKey: process.env.SANEIA_ANDROID_MAPS_KEY } } }
      : {}),
  },
  plugins: [
    'expo-router',
    ['expo-image-picker', { photosPermission: 'Permitir anexar uma foto ao relato de saneamento.', microphonePermission: false }],
    ['expo-location', { locationWhenInUsePermission: 'Permitir sugerir a localização do problema relatado.' }],
  ],
  extra: { commitHash: commitHash() },
};
