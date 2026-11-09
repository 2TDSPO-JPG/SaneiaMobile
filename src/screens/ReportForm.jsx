import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { demoCenter } from '../data/demo';
import { eligibilityMessage, occurrenceEligibility, previousOpenReport } from '../report-policy';
import { api } from '../services/api';
import { useErrorText, useSession } from '../session';
import { categories, colors, reportStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Body, Button, Card, Field, Heading, Notice, Resource, Screen, styles } from '../ui';
import MonitorMap from '../components/MonitorMap';

export function ReportFormScreen() {
  const { id, followUp } = useLocalSearchParams();
  const load = useCallback(async (session) => {
    if (session.user.role !== 'resident') return null;
    if (id) return { initial: await api.report(session, id), reports: [] };
    const reports = await api.listReports(session);
    const previous = reports.find((report) => report.id === followUp && report.status !== 'closed');
    return { reports, initial: previous ? {
      category: previous.category, neighborhood: previous.neighborhood,
      coordinate: previous.coordinate, address: previous.address,
    } : {} };
  }, [id, followUp]);
  const state = useResource(load);
  const { session } = useSession();
  if (session?.user.role !== 'resident') return <Screen back><Notice error text="Esta ação está disponível para moradores." /></Screen>;
  return <Screen back narrow>
    <Heading kicker="Atendimento" title={id ? 'Editar relato' : 'Novo relato'}
      subtitle="Indique onde aconteceu e conte o que você observou." />
    <Resource state={state}>{({ initial, reports }) => {
      if (initial.status && initial.status !== 'received') return <Notice error text="Este relato já está em atendimento." />;
      return <ReportFields initial={initial} reports={reports} />;
    }}</Resource>
  </Screen>;
}

function ReportFields({ initial, reports }) {
  const { session } = useSession();
  const errorText = useErrorText();
  const router = useRouter();
  const [category, setCategory] = useState(initial.category || categories[0]);
  const [description, setDescription] = useState(initial.description || '');
  const [address, setAddress] = useState(initial.address || '');
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood || '');
  const [coordinate, setCoordinate] = useState(initial.coordinate || null);
  const [photo, setPhoto] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [error, setError] = useState('');
  const [conflictId, setConflictId] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoUrl = photo?.uri || initial.photoUrl;
  const previous = previousOpenReport(reports, { category, coordinate });
  const eligibility = occurrenceEligibility(reports, { category, coordinate });
  const openToComplement = (id) => router.replace({ pathname: '/relato/[id]', params: { id, complement: '1' } });

  useEffect(() => {
    if (!coordinate || !session) return;
    let active = true;
    api.coverage(session, coordinate).then(
      (value) => { if (active) setCoverage({ coordinate, value }); },
      (failure) => { if (active) setCoverage({ coordinate, error: errorText(failure) }); },
    );
    return () => { active = false; };
  }, [coordinate, session, errorText]);

  async function locate() {
    setError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Localização indisponível. Você pode marcar o local no mapa.');
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoordinate({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLocating(false);
    }
  }

  async function choosePhoto() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) setPhoto(result.assets[0]);
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  async function save() {
    setError('');
    setConflictId(null);
    if (!eligibility.allowed) return;
    if (description.trim().length < 10 || address.trim().length < 3 || neighborhood.trim().length < 2 || !coordinate) {
      setError('Indique o local no mapa, preencha o bairro e a referência e escreva pelo menos 10 caracteres na descrição.');
      return;
    }
    setSaving(true);
    try {
      const report = await api.saveReport(session, {
        category, description: description.trim(), address: address.trim(),
        neighborhood: neighborhood.trim().replace(/\s+/g, ' '), coordinate, photo,
      }, initial.id);
      const detail = { pathname: '/relato/[id]', params: { id: report.id, saved: '1' } };
      if (initial.id) router.dismissTo(detail);
      else router.replace(detail);
    } catch (failure) {
      setError(errorText(failure));
      if (failure.code === 'REPORT_COOLDOWN') setConflictId(failure.existingReportId);
    } finally {
      setSaving(false);
    }
  }

  const verified = coverage?.coordinate === coordinate ? coverage : null;
  return <>
    <Card>
      <Text style={styles.section}>1. O que aconteceu?</Text>
      <View style={styles.wrap}>
        {categories.map((option) => <Pressable key={option} accessibilityRole="button"
          accessibilityState={{ selected: category === option }} onPress={() => setCategory(option)}>
          <Badge label={option} tone={category === option ? 'green' : 'neutral'} />
        </Pressable>)}
      </View>
      <Field label="Descrição" placeholder="Ex.: esgoto voltando pelo ralo da calçada" multiline
        maxLength={1000} value={description} onChangeText={setDescription} />
    </Card>
    <Card>
      <Text style={styles.section}>2. Onde aconteceu?</Text>
      <Field label="Endereço ou referência" placeholder="Rua, número ou ponto de referência"
        maxLength={180} value={address} onChangeText={setAddress} />
      <Field label="Bairro ou região" placeholder="Ex.: Setor Norte" maxLength={80}
        value={neighborhood} onChangeText={setNeighborhood} />
      <Body>Toque no mapa para marcar ou corrigir o local.</Body>
      <MonitorMap center={coordinate || demoCenter} selection={coordinate} onSelect={setCoordinate} />
      {coordinate && <Body>{coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}</Body>}
      <Button secondary title="Usar minha localização" icon="crosshair" busy={locating} onPress={locate} />
      {coordinate && !verified && <Body>Consultando cobertura…</Body>}
      {!!verified?.error && <Notice error text={verified.error} />}
      {verified?.value && <Badge
        label={verified.value.sensorId
          ? verified.value.status === 'offline' ? 'Com sensor próximo · sem comunicação' : 'Com sensor próximo'
          : 'Sem sensor próximo'}
        tone={verified.value.sensorId ? 'green' : 'neutral'} />}
    </Card>
    {!!previous && <Card>
      <Text style={styles.section}>Ocorrência anterior no mesmo local</Text>
      <Badge label={reportStatus[previous.status].label} tone={reportStatus[previous.status].tone} />
      <Body>{previous.protocol} · {previous.category}</Body>
      <Body>{previous.progressNote || 'A operadora ainda não informou o motivo da pendência.'}</Body>
      {eligibility.allowed
        ? <Notice text="Se o problema continua, o novo relato será vinculado a este protocolo e entrará como prioridade." />
        : <>
          <Notice text={eligibilityMessage(eligibility)} />
          <Button secondary title="Abrir protocolo para complementar" icon="file-text" onPress={() => openToComplement(previous.id)} />
        </>}
    </Card>}
    <Card>
      <Text style={styles.section}>3. Foto do local</Text>
      <Body>Opcional. A imagem fica disponível para a operadora que analisa o relato.</Body>
      {!!photoUrl && <Image source={{ uri: photoUrl }} accessibilityLabel="Foto do local"
        style={{ width: '100%', height: 170, borderRadius: 12, backgroundColor: colors.grayBg }} />}
      <Button secondary title={photoUrl ? 'Trocar foto' : 'Selecionar foto'} icon="image" onPress={choosePhoto} />
      {!!photo && <Button secondary title="Remover foto selecionada" onPress={() => setPhoto(null)} />}
    </Card>
    <Notice error text={error} />
    {!!conflictId && <Button secondary title="Abrir protocolo para complementar" icon="file-text" onPress={() => openToComplement(conflictId)} />}
    <Button title={initial.id ? 'Salvar alterações' : 'Enviar e gerar protocolo'} icon="send"
      busy={saving} disabled={!eligibility.allowed} onPress={save} />
  </>;
}
