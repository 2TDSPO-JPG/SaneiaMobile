const key = 'saneia-demo-v2';

export function readLegacyDemo() {
  return JSON.parse(globalThis.localStorage?.getItem(key) ?? 'null');
}
