import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';
import { useSession } from '../session';
import { equipmentStatus, reportStatus, roleLabels } from '../theme';
import { useResource } from '../use-resource';
import { Body, Brand, Button, Card, EmptyState, Heading, ListItem, Metric, Resource, Screen, styles } from '../ui';
import { EquipmentRows } from '../components/Operations';
import { AdminHomeScreen } from './Admin';

const loadOperatorSensors = (session) => session.user.role === 'operator' ? api.sensors(session) : Promise.resolve([]);

export function HomeScreen() {
  const { session } = useSession();
  if (!session) return null;
  return session.user.role === 'admin' ? <AdminHomeScreen /> : <OperationsHome session={session} />;
}

function OperationsHome({ session }) {
  const router = useRouter();
  const equipment = useResource(loadOperatorSensors);
  const queue = useResource(api.listReports);
  const operator = session.user.role === 'operator';

  return <Screen tabs>
    <Heading kicker={operator ? 'Área da operadora' : 'Área do morador'}
      title={operator ? 'Visão geral' : `Olá, ${session.user.name.split(' ')[0]}`}
      subtitle={operator ? 'Acompanhe os equipamentos e a fila de atendimento.' : 'Acompanhe suas solicitações e registre novas ocorrências.'} />
    {!operator && <Card>
      <Text style={styles.section}>Precisa de atendimento?</Text>
      <Body>Informe o local e descreva o problema de saneamento.</Body>
      <Button title="Registrar relato" icon="plus" onPress={() => router.push('/novo-relato')} />
    </Card>}
    {operator && <>
      <Text style={styles.section}>Equipamentos</Text>
      <Resource state={equipment}>{(sensors) => <>
        <View style={styles.metrics}>
          {[['alarm', 'Equipamentos em alarme', 'alert-octagon', 'red'], ['warning', 'Equipamentos em alerta', 'alert-triangle', 'yellow'],
            ['normal', 'Equipamentos OK', 'check-circle', 'green'], ['offline', 'Sem comunicação', 'wifi-off', 'neutral']].map(([status, label, icon, tone]) => (
            <Metric key={status} label={label} icon={icon} tone={tone} value={sensors.filter((sensor) => equipmentStatus(sensor) === status).length}
              onPress={() => router.push({ pathname: '/mapa', params: { status } })} />
          ))}
        </View>
        <View style={home.sectionRow}><Text style={styles.section}>Pontos de atenção</Text>
          <Button secondary title="Abrir mapa" icon="map" onPress={() => router.push('/mapa')} /></View>
        <EquipmentRows equipment={sensors.filter((sensor) => ['alarm', 'warning'].includes(equipmentStatus(sensor))).slice(0, 4)} />
      </>}</Resource>
      <Text style={styles.section}>Atendimento ao morador</Text>
    </>}
    <Resource state={queue}>{(reports) => <>
      <View style={styles.metrics}>
        <Metric label="Relatos em aberto" value={reports.filter((item) => item.status !== 'closed').length}
          icon="file-text"
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'open' } })} />
        {operator && <Metric label="Recorrências prioritárias"
          icon="repeat" tone="yellow"
          value={reports.filter((item) => item.previousReportId && item.status !== 'closed').length}
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'priority' } })} />}
        {!operator && <Metric label="Relatos encerrados" value={reports.filter((item) => item.status === 'closed').length}
          icon="check-circle"
          onPress={() => router.push({ pathname: '/relatos', params: { scope: 'closed' } })} />}
      </View>
      <Text style={styles.section}>{operator ? 'Últimos relatos recebidos' : 'Últimas solicitações'}</Text>
      {reports.length ? [...reports].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3).map((report) =>
        <ListItem key={report.id} title={report.category} description={`${report.protocol} · ${report.address}`} icon="file-text"
          badge={reportStatus[report.status]?.label} tone={reportStatus[report.status]?.tone}
          onPress={() => router.push({ pathname: '/relato/[id]', params: { id: report.id } })} />)
        : <EmptyState title="Nenhum relato registrado" description={operator ? 'Os relatos recebidos aparecerão aqui.'
          : 'Seus protocolos aparecerão aqui depois do primeiro registro.'} />}
    </>}</Resource>
    <Button secondary title={operator ? 'Ver todos os relatos' : 'Meus protocolos'} icon="file-text" onPress={() => router.push('/relatos')} />
  </Screen>;
}

export function ProfileScreen() {
  const router = useRouter();
  const { session, setSession } = useSession();
  if (!session) return null;
  return <Screen tabs narrow>
    <Heading kicker="Conta" title="Meu perfil" />
    <Card>
      <Text style={styles.section}>{session.user.name}</Text>
      <Body>{roleLabels[session.user.role]}</Body>
      {!!session.user.email && <Body>{session.user.email}</Body>}
    </Card>
    <ListItem title="Sobre o Saneia" description="Informações do aplicativo" icon="info" onPress={() => router.push('/sobre')} />
    <Button secondary title="Sair da conta" icon="log-out" onPress={() => setSession(null)} />
  </Screen>;
}

export function AboutScreen() {
  const config = Constants.expoConfig;
  const hash = config?.extra?.commitHash;
  return <Screen back>
    <Heading kicker="Saneia" title="Sobre o aplicativo" />
    <Card><Brand /><Body>Atendimento a ocorrências de saneamento e acompanhamento de equipamentos por região.</Body></Card>
    <Card>
      <Text style={styles.section}>Versão {config?.version ?? '0.1.0'}</Text>
      {!!hash && <Body>Identificação da versão {hash.slice(0, 7)}</Body>}
    </Card>
  </Screen>;
}

const home = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 6 },
});
