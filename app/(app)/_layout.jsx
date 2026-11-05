import { Redirect, Stack, useSegments } from 'expo-router';
import { useSession } from '../../src/session';
import { colors } from '../../src/theme';

export const unstable_settings = { anchor: 'inicio' };

const routeRoles = {
  relatos: ['resident', 'operator'],
  relato: ['resident', 'operator'],
  'novo-relato': ['resident'],
  mapa: ['operator'],
  sensor: ['operator'],
  bairro: ['operator'],
  equipamentos: ['admin'],
  equipamento: ['admin'],
  usuarios: ['admin'],
};

export default function AppLayout() {
  const { session } = useSession();
  const [group, page] = useSegments();
  const roles = group === '(app)' ? routeRoles[page] : undefined;
  if (!session) return <Redirect href="/" />;
  if (roles && !roles.includes(session.user.role)) return <Redirect href="/inicio" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}
