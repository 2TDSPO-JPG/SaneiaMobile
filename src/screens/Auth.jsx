import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { api, demoMode } from '../services/api';
import { useSession } from '../session';
import { colors, roleLabels } from '../theme';
import { Body, Button, Card, Field, Heading, Notice, Screen } from '../ui';

function AuthForm({ signup }) {
  const router = useRouter();
  const { setSession } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        throw new Error('Não foi possível concluir o acesso. Tente novamente.');
      }
      setSession(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back={signup} auth>
      <Heading kicker={signup ? 'Cadastro de morador' : 'Acesso ao Saneia'}
        title={signup ? 'Crie sua conta' : 'Entre na sua conta'}
        subtitle={signup ? 'Preencha seus dados para acompanhar suas solicitações.'
          : 'Use seu e-mail e senha para continuar.'} />
      <Card>
        {signup && <Field label="Nome" value={name} onChangeText={setName} autoComplete="name" maxLength={120} />}
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none"
          keyboardType="email-address" autoComplete="email" placeholder="nome@exemplo.com" maxLength={160} />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
          autoComplete={signup ? 'new-password' : 'current-password'} maxLength={100}
          placeholder={signup ? 'Mínimo de 8 caracteres' : undefined}
          trailing={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setShowPassword(!showPassword)} style={{ padding: 13 }}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </Pressable>} />
        <Notice error text={error} />
        <Button title={signup ? 'Criar conta' : 'Entrar'} icon="log-in" busy={busy} onPress={submit} />
        {!signup && !demoMode && <Button secondary title="Criar conta de morador" onPress={() => router.push('/cadastro')} />}
      </Card>
      <Body style={{ fontSize: 12, textAlign: 'center' }}>Saneia · Atendimento e monitoramento</Body>
    </Screen>
  );
}

function AuthEntry({ signup = false }) {
  const { session } = useSession();
  return session ? <Redirect href="/inicio" /> : <AuthForm signup={signup} />;
}

export const LoginScreen = () => <AuthEntry />;
export const SignupScreen = () => <AuthEntry signup />;
