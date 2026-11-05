import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export const unstable_settings = { initialRouteName: 'inicio' };

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}
