import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text } from 'react-native';
import { EquipmentRows, ReportQueue } from '../components/Operations';
import { ReportUpdates } from '../components/ReportUpdates';
import { api } from '../services/api';
import { useErrorText, useSession } from '../session';
import { areaKey, areaName, colors, dateTime, reportDate, reportStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Body, Button, Card, Field, Heading, ListItem, Notice, Resource, Screen, styles } from '../ui';

const byScope = (reports, scope) => scope === 'open' ? reports.filter((item) => item.status !== 'closed')
  : scope === 'closed' ? reports.filter((item) => item.status === 'closed')
    : scope === 'priority' ? reports.filter((item) => item.status !== 'closed' && item.previousReportId) : reports;
const matchesArea = (item, name) => areaKey(areaName(item)) === areaKey(name);

const searchKey = (value) => areaKey(value).replace(/[^a-z0-9]+/g, ' ').trim();

function matchesAddress(query, ...items) {
  const normalized = searchKey(query);
  if (!normalized) return true;
  const addresses = searchKey(items.filter(Boolean).flatMap((item) => [
    item.address, item.neighborhood, item.city, item.prefix, ...Object.values(item.postalAddress ?? {}),
  ]).join(' '));
  return normalized.split(' ').every((word) => addresses.includes(word));
}

async function loadOperatorReports(session) {
  const [reports, equipment] = await Promise.allSettled([api.listReports(session), api.sensors(session)]);
  if (reports.status === 'rejected') throw reports.reason;
  const sensors = equipment.status === 'fulfilled' ? equipment.value : [];
  return {
    reports: reports.value,
    sensors,
    equipmentById: new Map(sensors.map((sensor) => [String(sensor.id), sensor])),
    equipmentUnavailable: equipment.status === 'rejected',
  };
}

function AddressSearch({ query, onChange }) {
  return <Field label="Pesquisar por endereço" value={query} onChangeText={onChange}
    placeholder="Rua, endereço, bairro, cidade ou CEP" />;
}

export function ReportListScreen() {
  const { session } = useSession();
  const { scope } = useLocalSearchParams();
  return session?.user.role === 'operator' ? <OperatorReports scope={scope} /> : <ResidentReports scope={scope} />;
}

function ResidentReports({ scope }) {
  const router = useRouter();
  const state = useResource(api.listReports);
  return <Screen tabs>
    <Heading kicker="Área do morador" title={scope === 'open' ? 'Relatos em aberto' : scope === 'closed' ? 'Relatos encerrados' : 'Meus relatos'}
      subtitle="Abra um protocolo para ver a situação e os detalhes." />
    <Button title="Novo relato" icon="plus" onPress={() => router.push('/novo-relato')} />
    {!!scope && <Button secondary title="Ver todos os relatos" onPress={() => router.setParams({ scope: '' })} />}
    <Resource state={state}>{(reports) => <ReportQueue reports={byScope(reports, scope)} />}</Resource>
  </Screen>;
}

function OperatorReports({ scope }) {
  const router = useRouter();
  const state = useResource(loadOperatorReports);
  const [query, setQuery] = useState('');
  return <Screen tabs>
    <Heading kicker="Área da operadora"
      title={scope === 'priority' ? 'Recorrências prioritárias' : scope === 'open' ? 'Relatos em aberto' : 'Relatos recebidos'}
      subtitle="Consulte os protocolos, filtre por categoria e atualize os atendimentos." />
    {!!scope && <Button secondary title="Ver todos os relatos" onPress={() => router.setParams({ scope: '' })} />}
    <AddressSearch query={query} onChange={setQuery} />
    <Resource state={state}>{({ reports, equipmentById, equipmentUnavailable }) => {
      const visible = byScope(reports, scope).filter((report) => matchesAddress(query, report, equipmentById.get(String(report.sensorId))));
      const names = [...new Map(visible.map((item) => {
        const name = areaName(item);
        return [areaKey(name), name];
      })).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      return <>
        {equipmentUnavailable && <Notice text="O catálogo está indisponível. A busca está usando os endereços dos relatos." />}
        <ReportQueue key={scope || 'all'} reports={visible} equipmentById={equipmentById} operator />
        {names.length > 0 && <Text style={styles.section}>Relatos por bairro</Text>}
        {names.map((name) => {
          const count = visible.filter((item) => matchesArea(item, name)).length;
          return <ListItem key={name} title={name} icon="map-pin" description={count === 1 ? '1 relato' : `${count} relatos`}
            onPress={() => router.push({ pathname: '/bairro/[name]', params: { name, scope: scope || '', query } })} />;
        })}
      </>;
    }}</Resource>
  </Screen>;
}

export function NeighborhoodScreen() {
  const { name, scope, query: initialQuery } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useSession();
  const state = useResource(loadOperatorReports);
  const [query, setQuery] = useState(typeof initialQuery === 'string' ? initialQuery : '');
  if (session?.user.role !== 'operator') return <Screen back><Notice error text="Área exclusiva da operadora." /></Screen>;
  return <Screen back>
    <Heading kicker="Relatos por bairro" title={name} subtitle="Consulte os protocolos registrados neste bairro." />
    {!!scope && <Button secondary title="Ver todos os relatos do bairro" onPress={() => router.setParams({ scope: '' })} />}
    <AddressSearch query={query} onChange={setQuery} />
    <Resource state={state}>{({ reports, sensors, equipmentById, equipmentUnavailable }) => {
      const visible = byScope(reports, scope).filter((report) => matchesArea(report, name)
        && matchesAddress(query, report, equipmentById.get(String(report.sensorId))));
      const neighborhoodEquipment = sensors.filter((sensor) => matchesArea(sensor, name) && matchesAddress(query, sensor));
      return <>
        {equipmentUnavailable && <Notice text="O catálogo está indisponível. Os relatos do bairro continuam acessíveis." />}
        <Text style={styles.section}>{scope === 'priority' ? 'Recorrências prioritárias' : scope === 'open' ? 'Relatos em aberto' : 'Relatos do bairro'}</Text>
        <ReportQueue key={scope || 'all'} reports={visible} equipmentById={equipmentById} operator />
        {!equipmentUnavailable && <>
          <Text style={styles.section}>Equipamentos do bairro</Text>
          <EquipmentRows equipment={neighborhoodEquipment} />
        </>}
      </>;
    }}</Resource>
  </Screen>;
}

export function ReportDetailScreen() {
  const { id, saved, complement } = useLocalSearchParams();
  const load = useCallback((session) => api.report(session, id), [id]);
  const state = useResource(load);
  return <Screen back>
    <Resource state={state}>{(report) => <Details key={report.id} report={report} state={state}
      saved={saved === '1'} complement={complement === '1'} />}</Resource>
  </Screen>;
}

function Details({ report, state, saved, complement }) {
  const router = useRouter();
  const { session } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resolution, setResolution] = useState('');
  const [progressNote, setProgressNote] = useState(report.progressNote || '');
  const [assessmentNote, setAssessmentNote] = useState('');
  const operator = session?.user.role === 'operator';
  const status = reportStatus[report.status];
  const canEdit = !operator && report.status === 'received';

  async function mutate(action, then) {
    setBusy(true);
    setError('');
    try {
      await action();
      then();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(status) {
    if (status === 'closed' && !resolution.trim()) {
      setError('Informe o desfecho antes de encerrar o atendimento.');
      return;
    }
    mutate(() => api.updateStatus(session, report.id, {
      status, resolution: resolution.trim() || null, progressNote: progressNote.trim() || null,
    }), state.retry);
  }

  function requestAssessment() {
    const note = assessmentNote.trim();
    if (!note) {
      setError('Informe o que a equipe precisa verificar.');
      return;
    }
    mutate(() => api.requestAssessment(session, report.id, note), state.retry);
  }

  return <>
    <Heading kicker={report.protocol} title={report.category} subtitle={report.address} />
    {saved && <Notice text="Relato salvo. Você pode acompanhar pelo número do protocolo." />}
    {!!report.previousReportId && <Notice text={`Recorrência vinculada ao protocolo ${report.previousProtocol || report.previousReportId}.`} />}
    <Card>
      <Badge label={status.label} tone={status.tone} />
      {operator && !!report.previousReportId && report.status !== 'closed' && <Badge label="Prioridade por recorrência" tone="red" />}
      <Body>Enviado em {operator ? reportDate(report.createdAt) : dateTime(report.createdAt)}</Body>
      <Text style={styles.section}>Descrição</Text>
      <Body>{report.description}</Body>
      {!!report.photoUrl && <Image source={{ uri: report.photoUrl }} accessibilityLabel="Foto da ocorrência"
        style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.grayBg }} />}
      <Badge label={report.sensorId ? 'Com sensor próximo' : 'Sem sensor próximo'} tone={report.sensorId ? 'green' : 'neutral'} />
      {operator && <Body>Bairro: {areaName(report)}</Body>}
      {operator && !!report.coordinate && <Body>Localização: {report.coordinate.latitude.toFixed(5)}, {report.coordinate.longitude.toFixed(5)}</Body>}
    </Card>
    {!!report.progressNote && report.status !== 'closed' && <Card>
      <Text style={styles.section}>Atualização da operadora</Text><Body>{report.progressNote}</Body>
    </Card>}
    {!!report.resolution && <Card><Text style={styles.section}>Desfecho</Text><Body>{report.resolution}</Body></Card>}
    <ReportUpdates report={report} canAdd={!operator && report.status !== 'closed'} startOpen={complement} onSaved={() => {
      if (complement) router.setParams({ complement: '' });
      state.retry();
    }} />
    <Notice error text={error} />
    {operator && (report.assessment || report.status !== 'closed') && <Card>
      <Text style={styles.section}>Avaliação técnica</Text>
      {report.assessment ? <>
        <Badge label="Avaliação solicitada" tone="blue" />
        <Body>Registrada em {reportDate(report.assessment.requestedAt)}</Body>
        <Body>{report.assessment.note}</Body>
      </> : <>
        <Body>Registre uma solicitação de avaliação neste protocolo quando for preciso vistoriar o local ou verificar a cobertura.</Body>
        <Field label="O que precisa ser verificado?" multiline maxLength={600} value={assessmentNote} onChangeText={setAssessmentNote} />
        <Button secondary title="Solicitar avaliação técnica" icon="clipboard" busy={busy} onPress={requestAssessment} />
      </>}
    </Card>}
    {operator && report.status !== 'closed' && <Card>
      <Text style={styles.section}>Atualizar atendimento</Text>
      <Field label="Situação para o morador" multiline maxLength={600} value={progressNote} onChangeText={setProgressNote} />
      <Button secondary title="Salvar atualização" icon="message-square" busy={busy}
        onPress={() => changeStatus(report.status)} />
      {report.status === 'received'
        ? <Button title="Iniciar atendimento" icon="play" busy={busy} onPress={() => changeStatus('in_progress')} />
        : <>
          <Field label="Desfecho para o morador" multiline maxLength={600} value={resolution} onChangeText={setResolution} />
          <Button title="Encerrar atendimento" icon="check" busy={busy} onPress={() => changeStatus('closed')} />
        </>}
    </Card>}
    {!operator && report.status !== 'closed' && <FollowUp report={report} />}
    {canEdit && <>
      <Button secondary title="Editar relato" icon="edit" disabled={busy}
        onPress={() => router.push({ pathname: '/novo-relato', params: { id: report.id } })} />
      {confirmDelete && <Notice text="Confirme a exclusão deste protocolo." />}
      <Button danger title={confirmDelete ? 'Confirmar exclusão' : 'Excluir relato'} icon="trash-2" busy={busy}
        onPress={() => confirmDelete
          ? mutate(() => api.deleteReport(session, report.id), () => router.replace('/relatos'))
          : setConfirmDelete(true)} />
      {confirmDelete && <Button secondary title="Cancelar exclusão" disabled={busy} onPress={() => setConfirmDelete(false)} />}
    </>}
  </>;
}

function FollowUp({ report }) {
  const router = useRouter();
  return <Card>
    <Text style={styles.section}>O problema continua?</Text>
    <Body>Você pode complementar este protocolo a qualquer momento. Um novo protocolo sobre o mesmo problema e local fica disponível após 20 dias.</Body>
    <Button secondary title="Relatar que o problema continua" icon="repeat"
      onPress={() => router.push({ pathname: '/novo-relato', params: { followUp: report.id } })} />
  </Card>;
}
