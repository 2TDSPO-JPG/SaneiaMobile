import { Stack } from 'expo-router';
import { useSession } from '../../src/session';
import { colors } from '../../src/theme';

export const unstable_settings = { initialRouteName: 'inicio' };

export default function AppLayout() {
  const { session } = useSession();
  const role = session?.user.role;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
    <Stack.Screen name="inicio" />
    <Stack.Screen name="perfil" />
    <Stack.Screen name="sobre" />
    <Stack.Protected guard={role === 'resident' || role === 'operator'}>
      <Stack.Screen name="relatos" />
      <Stack.Screen name="relato/[id]" />
    </Stack.Protected>
    <Stack.Protected guard={role === 'resident'}>
      <Stack.Screen name="novo-relato" />
    </Stack.Protected>
    <Stack.Protected guard={role === 'operator'}>
      <Stack.Screen name="mapa" />
      <Stack.Screen name="sensor/[id]" />
      <Stack.Screen name="bairro/[name]" />
    </Stack.Protected>
    <Stack.Protected guard={role === 'admin'}>
      <Stack.Screen name="equipamentos" />
      <Stack.Screen name="equipamento" />
      <Stack.Screen name="usuarios" />
    </Stack.Protected>
  </Stack>;
}
