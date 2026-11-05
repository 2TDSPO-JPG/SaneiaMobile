import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';
import { useSession } from '../session';
import { colors, equipmentStatus, roleLabels } from '../theme';
import { useResource } from '../use-resource';
import { Body, Brand, Button, Card, Heading, ListItem, Resource, Screen, styles } from '../ui';
import { AdminHomeScreen } from './Admin';

async function loadOverview(session) {
  const reports = api.listReports(session);
  const sensors = session.user.role === 'operator' ? api.sensors(session) : Promise.resolve([]);
  const [allReports, allSensors] = await Promise.all([reports, sensors]);
  return { reports: allReports, sensors: allSensors };
}

function Metric({ label, value, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={`${value} registros`}
    onPress={onPress} style={({ pressed }) => [home.metric, pressed && { opacity: 0.65 }]}>
    <Text style={home.number}>{value} <Text style={home.arrow}>↗</Text></Text>
    <Body style={{ fontSize: 13 }}>{label}</Body>
  </Pressable>;
}

export function HomeScreen() {
  const { session } = useSession();
  if (!session) return null;
  return session.user.role === 'admin' ? <AdminHomeScreen /> : <OperationsHome session={session} />;
}

function OperationsHome({ session }) {
  const router = useRouter();
  const overview = useResource(loadOverview);
  const operator = session.user.role === 'operator';

  return <Screen tabs>
    <Heading kicker={operator ? 'Área da operadora' : 'Área do morador'}
      title={operator ? 'Visão geral' : `Olá, ${session.user.name.split(' ')[0]}`}
      subtitle={operator ? 'Localize ocorrências e priorize os atendimentos.' : 'Relate problemas de saneamento e acompanhe seus pedidos.'} />
    <View style={home.hero}>
      <Text style={home.heroLabel}>{operator ? 'MONITORAMENTO' : 'NOVO ATENDIMENTO'}</Text>
      <Text style={home.heroTitle}>{operator ? 'Veja o que precisa de atenção' : 'Encontrou um problema na região?'}</Text>
      <Text style={home.heroBody}>{operator ? 'Acompanhe alarmes, alertas e leituras dos equipamentos.' : 'Envie a localização, uma descrição e, se quiser, uma foto.'}</Text>
      <Button title={operator ? 'Abrir mapa' : 'Registrar relato'} icon={operator ? 'map' : 'plus'}
        onPress={() => router.push(operator ? '/mapa' : '/novo-relato')} />
    </View>
    <Resource state={overview}>{({ reports, sensors }) => <>
      {operator && <>
        <Text style={styles.section}>Equipamentos</Text>
        <View style={home.metrics}>
          {[['alarm', 'Equipamentos em alarme'], ['warning', 'Equipamentos em alerta'],
            ['normal', 'Equipamentos OK'], ['offline', 'Sem comunicação']].map(([status, label]) => (
            <Metric key={status} label={label} value={sensors.filter((sensor) => equipmentStatus(sensor) === status).length}
              onPress={() => router.push({ pathname: '/mapa', params: { status } })} />
          ))}
        </View>
        <Text style={styles.section}>Atendimento ao morador</Text>
      </>}
      <View style={home.metrics}>
        <Metric label="Relatos em aberto" value={reports.filter((item) => item.status !== 'closed').length}
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'open' } })} />
        {operator && <Metric label="Recorrências prioritárias"
          value={reports.filter((item) => item.previousReportId && item.status !== 'closed').length}
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'priority' } })} />}
        {!operator && <Metric label="Relatos encerrados" value={reports.filter((item) => item.status === 'closed').length}
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'closed' } })} />}
      </View>
    </>}</Resource>
    {operator ? <Card>
      <Text style={styles.section}>Como as informações chegam</Text>
      <Body>O equipamento envia leituras. O sistema sinaliza alerta ou alarme e exibe o ponto no mapa.</Body>
      <Body>O morador envia um relato com localização. A operadora consulta e atualiza o protocolo no menu Relatos.</Body>
    </Card> : <ListItem icon="file-text" title="Meus protocolos"
      description="Consulte a situação de cada ocorrência." onPress={() => router.push('/relatos')} />}
  </Screen>;
}

export function ProfileScreen() {
  const router = useRouter();
  const { session, setSession } = useSession();
  if (!session) return null;
  return <Screen tabs>
    <Heading kicker="Conta" title="Meu perfil" />
    <Card>
      <Text style={styles.section}>{session.user.name}</Text>
      <Body>{roleLabels[session.user.role]}</Body>
      {!!session.user.email && <Body>{session.user.email}</Body>}
    </Card>
    <ListItem title="Sobre o App" description="Versão e commit de referência" icon="info" onPress={() => router.push('/sobre')} />
    <Button secondary title="Sair da conta" icon="log-out" onPress={() => setSession(null)} />
  </Screen>;
}

export function AboutScreen() {
  const config = Constants.expoConfig;
  const hash = config?.extra?.commitHash;
  return <Screen back>
    <Heading kicker="Identidade do projeto" title="Sobre o App" />
    <Card><Brand /><Body>Projeto CitizenTech para acompanhar relatos de saneamento e monitorar reservatórios.</Body></Card>
    <Card>
      <Text style={styles.section}>Versão {config?.version ?? '0.1.0'}</Text>
      <Body>Commit de referência</Body>
      <Text selectable style={{ color: colors.ink }}>{typeof hash === 'string' && hash
        ? hash : 'Disponível em uma compilação vinculada ao Git.'}</Text>
    </Card>
  </Screen>;
}

const home = StyleSheet.create({
  hero: { padding: 20, borderRadius: 22, backgroundColor: colors.ink, gap: 11 },
  heroLabel: { color: colors.mint, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  heroTitle: { color: colors.surface, fontWeight: '800', fontSize: 26, lineHeight: 32 },
  heroBody: { color: '#CDE8E0', fontSize: 15, lineHeight: 21 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '48%', flexGrow: 1, gap: 3, backgroundColor: colors.surface,
    borderRadius: 15, borderColor: colors.line, borderWidth: 1, padding: 13 },
  number: { fontSize: 28, color: colors.ink, fontWeight: '800' },
  arrow: { color: colors.primary, fontSize: 16 },
});
