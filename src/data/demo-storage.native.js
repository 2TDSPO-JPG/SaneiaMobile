import { File, Paths } from 'expo-file-system';

export function readLegacyDemo() {
  const source = new File(Paths.document, 'saneia-demo-v2.json');
  return source.exists ? JSON.parse(source.textSync()) : null;
}
