import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoReports } from './demo';
import { readLegacyDemo } from './demo-storage';

const storageKey = 'saneia-demo-v3';
let pendingWrite = Promise.resolve();

export async function readDemo() {
  const saved = await AsyncStorage.getItem(storageKey);
  return saved === null
    ? readLegacyDemo() ?? { reports: demoReports, sequence: 2 }
    : JSON.parse(saved);
}

export function updateDemo(change) {
  const write = pendingWrite.then(async () => {
    const { state, result } = change(await readDemo());
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
    return result;
  });
  pendingWrite = write.catch(() => {});
  return write;
}
