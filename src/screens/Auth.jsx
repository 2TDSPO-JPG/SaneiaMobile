import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, demoMode, demoSession } from '../services/api';
import { useSession } from '../session';
import { colors, roleLabels } from '../theme';
import { Body, Button, Card, Field, Heading, Notice, Screen, styles } from '../ui';

function AuthForm({ signup }) {
  const router = useRouter();
  const { setSession } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password.trim()) {
      setError('Informe um e-mail válido e a senha.');
      return;
    }
    if (signup && (name.trim().length < 2 || password.length < 8)) {
      setError('Informe um nome com pelo menos 2 caracteres e uma senha com pelo menos 8.');
      return;
    }
    setBusy(true);
    try {
      const input = { email: email.trim().toLowerCase(), password };
      const result = signup ? await api.signup({ ...input, name: name.trim() }) : await api.login(input);
      if (!result.token || !Object.hasOwn(roleLabels, result.user?.role)) {
        throw new Error('A API retornou uma sessão inválida.');
      }
      setSession(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back={signup}>
      {!signup && <View style={auth.hero}>
        <View style={auth.heroIcon}><Feather name="map-pin" size={24} color={colors.mint} /></View>
        <Text style={auth.heroTitle}>Saneamento perto de quem precisa.</Text>
        <Text style={auth.heroText}>Registre ocorrências ou acompanhe alertas de reservatórios na sua região.</Text>
      </View>}
      <Heading kicker={signup ? 'Perfil de morador' : 'Acesso ao Saneia'}
        title={signup ? 'Crie sua conta' : 'Entre na sua conta'}
        subtitle={signup ? 'Acompanhe seus protocolos em um só lugar.' : undefined} />
      <Card>
        {signup && <Field label="Nome" value={name} onChangeText={setName} autoComplete="name" maxLength={120} />}
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none"
          keyboardType="email-address" autoComplete="email" placeholder="nome@exemplo.com" maxLength={160} />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry
          autoComplete={signup ? 'new-password' : 'current-password'} maxLength={100}
          placeholder={signup ? 'Mínimo de 8 caracteres' : undefined} />
        <Notice error text={error} />
        <Button title={signup ? 'Criar conta' : 'Entrar'} icon="log-in" busy={busy} onPress={submit} />
        {!signup && !demoMode && <Button secondary title="Criar conta de morador" onPress={() => router.push('/cadastro')} />}
      </Card>
      {demoMode && !signup && <Card>
        <Text style={styles.section}>Explore a demonstração</Text>
        <Body>Entre com uma conta de teste do README ou explore um dos perfis com dados fictícios.</Body>
        <Button secondary title="Explorar como morador" icon="user" onPress={() => setSession(demoSession('resident'))} />
        <Button secondary title="Explorar como operadora" icon="activity" onPress={() => setSession(demoSession('operator'))} />
        <Button secondary title="Explorar como administrador" icon="settings" onPress={() => setSession(demoSession('admin'))} />
      </Card>}
    </Screen>
  );
}

function AuthEntry({ signup = false }) {
  const { session } = useSession();
  return session ? <Redirect href="/inicio" /> : <AuthForm signup={signup} />;
}

export const LoginScreen = () => <AuthEntry />;
export const SignupScreen = () => <AuthEntry signup />;

const auth = StyleSheet.create({
  hero: { backgroundColor: colors.ink, padding: 21, borderRadius: 22, gap: 10 },
  heroIcon: { backgroundColor: '#224651', width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.surface, fontWeight: '800', fontSize: 27, lineHeight: 32, maxWidth: 360 },
  heroText: { color: '#CDE8E0', fontSize: 15, lineHeight: 21 },
});
