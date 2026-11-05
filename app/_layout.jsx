import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SessionProvider, useSession } from '../src/session';
import { colors } from '../src/theme';

function Routes() {
  const { session } = useSession();
  const router = useRouter();
  const signedIn = Boolean(session);
  const previousSignIn = useRef(signedIn);

  useEffect(() => {
    if (previousSignIn.current === signedIn) return;
    previousSignIn.current = signedIn;
    router.replace(signedIn ? '/inicio' : '/');
  }, [router, signedIn]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="cadastro" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <SessionProvider><Routes /></SessionProvider>;
}
