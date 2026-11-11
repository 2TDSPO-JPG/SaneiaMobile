import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { EquipmentFilters, filterEquipment, Filters } from '../components/Operations';
import { api, demoMode } from '../services/api';
import { equipmentAddress, lookupCep } from '../services/postal-address';
import { useErrorText, useSession } from '../session';
import { equipmentStatus, roleLabels, sensorStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Body, Button, Card, EmptyState, Field, Heading, ListItem, Metric, Notice, Resource, Screen, styles } from '../ui';

const roleFilters = [['all', 'Todos'], ...Object.entries(roleLabels)];

async function loadAdminOverview(session) {
  const [equipment, users] = await Promise.all([api.adminEquipment(session), api.adminUsers(session)]);
  return { equipment, users };
}

export function AdminHomeScreen() {
  const router = useRouter();
  const state = useResource(loadAdminOverview);
  return <Screen tabs>
    <Heading kicker="Gestão" title="Administração" subtitle="Cadastros e acessos da operação." />
    <Resource state={state}>{({ equipment, users }) => <View style={styles.metrics}>
      <Metric label="Equipamentos cadastrados" value={equipment.length} icon="cpu" onPress={() => router.push('/equipamentos')} />
      <Metric label="Usuários cadastrados" value={users.length} icon="users" onPress={() => router.push('/usuarios')} />
    </View>}</Resource>
    <Card><Text style={styles.section}>Catálogo de equipamentos</Text>
      <Body>Cadastre a instalação, o endereço e os limites operacionais de cada ponto.</Body>
      <Button title="Cadastrar equipamento" icon="plus" onPress={() => router.push('/equipamento')} />
      <Button secondary title="Gerenciar equipamentos" icon="cpu" onPress={() => router.push('/equipamentos')} />
    </Card>
    <ListItem title="Ver usuários" description="Consulte os moradores, as operadoras e os administradores."
      icon="users" onPress={() => router.push('/usuarios')} />
  </Screen>;
}

export function AdminUsersScreen() {
  const state = useResource(api.adminUsers);
  const [role, setRole] = useState('all');
  return <Screen tabs>
    <Heading kicker="Administração" title="Usuários cadastrados" subtitle="Consulte o nome, o e-mail e o perfil de cada conta." />
    <Filters label="Perfil de usuário" options={roleFilters} value={role} onChange={setRole} />
    <Resource state={state}>{(users) => {
      const visible = users.filter((user) => role === 'all' || user.role === role);
      return visible.length ? visible.map((user) => <Card key={user.id}>
        <Text style={styles.section}>{user.name}</Text>
        <Body>{user.email}</Body>
        <Badge label={roleLabels[user.role] || 'Perfil desconhecido'} />
      </Card>) : <EmptyState icon="users" title="Nenhum usuário encontrado" description="Escolha outro perfil para consultar as contas cadastradas." />;
    }}</Resource>
  </Screen>;
}

export function AdminEquipmentScreen() {
  const router = useRouter();
  const state = useResource(api.adminEquipment);
  const [status, setStatus] = useState('all');
  return <Screen tabs>
    <Heading kicker="Administração" title="Equipamentos" subtitle="Endereços, capacidade e limites operacionais." />
    <Button title="Cadastrar equipamento" icon="plus" onPress={() => router.push('/equipamento')} />
    <EquipmentFilters value={status} onChange={setStatus} />
    <Resource state={state}>{(sensors) => {
      const visible = filterEquipment(sensors, status);
      return visible.length ? visible.map((sensor) => {
        const current = sensorStatus[equipmentStatus(sensor)];
        return <ListItem key={sensor.id} title={`${sensor.prefix} · ${sensor.name}`}
          description={sensor.address} icon="activity" badge={current?.label} tone={current?.tone}
          onPress={() => router.push({ pathname: '/equipamento', params: { id: sensor.id } })} />;
      }) : <EmptyState icon="cpu" title="Nenhum equipamento encontrado" description="Cadastre um equipamento ou selecione outro filtro." />;
    }}</Resource>
  </Screen>;
}

export function AdminEquipmentFormScreen() {
  const { id } = useLocalSearchParams();
  const load = useCallback((session) => typeof id === 'string' ? api.adminSensor(session, id) : {}, [id]);
  const state = useResource(load);
  return <Screen back narrow>
    <Heading kicker="Administração" title={id ? 'Editar equipamento' : 'Novo equipamento'} />
    <Resource state={state}>{(sensor) => <EquipmentForm key={sensor.id ?? 'new'} sensor={sensor} />}</Resource>
  </Screen>;
}

function readNumber(value) {
  const clean = value.trim().replace(',', '.');
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) ? Number(clean) : NaN;
}

function readCoordinate(fields) {
  const latitude = readNumber(fields.latitude);
  const longitude = readNumber(fields.longitude);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

function equipmentInput(fields, sensor) {
  const prefix = fields.prefix.trim().toUpperCase();
  const name = fields.name.trim();
  const equipmentType = fields.equipmentType.trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(prefix)) throw new Error('Use de 2 a 30 letras, números, hífens ou sublinhados no prefixo.');
  if (!name || !equipmentType) throw new Error('Preencha nome e tipo do equipamento.');
  const address = equipmentAddress(fields, sensor);
  if (!demoMode && address.address.length > 200) throw new Error('O endereço completo deve ter até 200 caracteres.');
  const coordinate = readCoordinate(fields);
  if (!coordinate) {
    throw new Error('Defina a localização do equipamento pelo CEP, pela sua localização ou pelo ajuste manual.');
  }
  const capacity = readNumber(fields.capacity);
  const limit = readNumber(fields.limit);
  const radiusMeters = readNumber(fields.radiusMeters);
  if (!(Number.isFinite(capacity) && capacity > 0 && limit > 0 && limit <= capacity)) {
    throw new Error('Informe uma capacidade positiva e um limite entre zero e a capacidade.');
  }
  if (!(Number.isFinite(radiusMeters) && radiusMeters > 0)) throw new Error('Informe um raio de cobertura positivo.');
  const data = { prefix, name, ...address, equipmentType, coordinate, capacity, limit, radiusMeters };
  if (!demoMode) return data;
  return { ...data, simulatedVolume: sensor.volume ?? null };
}

function EquipmentForm({ sensor }) {
  const router = useRouter();
  const { session } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationSource, setLocationSource] = useState(sensor.coordinate ? 'saved' : null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fields, setFields] = useState({
    prefix: sensor.prefix ?? '', name: sensor.name ?? '',
    neighborhood: sensor.neighborhood ?? '', equipmentType: sensor.equipmentType ?? 'Reservatório com sensor de nível',
    cep: '', street: '', number: '', city: '', state: '', complement: '',
    ...(sensor.postalAddress && { ...sensor.postalAddress, complement: sensor.postalAddress.complement ?? '' }),
    latitude: String(sensor.coordinate?.latitude ?? ''), longitude: String(sensor.coordinate?.longitude ?? ''),
    capacity: String(sensor.capacity ?? ''), limit: String(sensor.limit ?? ''), radiusMeters: String(sensor.radiusMeters ?? 200),
  });
  const formBusy = busy || lookupBusy || locating;
  const currentCoordinate = readCoordinate(fields);
  const field = (key, label, props) => <>
    <Field label={label} value={fields[key]} editable={!formBusy}
      onChangeText={(value) => changeField(key, value)} {...props} />
    <Notice error text={fieldErrors[key]} />
  </>;
  const decimal = { keyboardType: 'numbers-and-punctuation' };

  function changeField(key, value) {
    const changedCep = key === 'cep' && value.replace('-', '') !== fields.cep.replace('-', '');
    if (key === 'cep') setLookupError('');
    if (changedCep) setLocationSource(null);
    if (key === 'latitude' || key === 'longitude') setLocationSource('manual');
    if (fieldErrors[key]) setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFields((current) => ({ ...current, [key]: value, ...(changedCep && { latitude: '', longitude: '' }) }));
  }

  function applyCoordinate(coordinate, source) {
    setFields((current) => ({ ...current, latitude: String(coordinate.latitude), longitude: String(coordinate.longitude) }));
    setLocationSource(source);
  }

  async function searchCep() {
    setLookupError('');
    setError('');
    setFieldErrors({});
    setLookupBusy(true);
    try {
      const { coordinate, ...address } = await lookupCep(fields.cep);
      setFields((current) => ({ ...current, ...address }));
      const keepCurrent = currentCoordinate && ['saved', 'gps', 'manual'].includes(locationSource);
      if (coordinate && !keepCurrent) applyCoordinate(coordinate, 'cep');
    } catch (failure) {
      setLookupError(failure.message);
    } finally {
      setLookupBusy(false);
    }
  }

  async function locate() {
    setError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Permita o acesso à localização para usar a posição atual.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      applyCoordinate(coords, 'gps');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLocating(false);
    }
  }

  async function submit(remove = false) {
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      if (remove) await api.deleteEquipment(session, sensor.id);
      else await api.saveEquipment(session, equipmentInput(fields, sensor), sensor.id);
      router.dismissTo('/equipamentos');
    } catch (failure) {
      setFieldErrors(Object.fromEntries((failure.fieldErrors ?? []).map(({ field, message }) =>
        [field.replace(/^(postalAddress|coordinate)\./, ''), message])));
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Card>
      {field('prefix', 'Prefixo', { autoCapitalize: 'characters', maxLength: 30, placeholder: 'Ex.: RES-21' })}
      {field('name', 'Nome do equipamento', { maxLength: 100 })}
      {field('equipmentType', 'Tipo', { maxLength: 100 })}
    </Card>
    <Card>
      <Text style={styles.section}>Endereço do equipamento</Text>
      {!!sensor.id && !sensor.postalAddress && <Notice text={`Endereço atual: ${sensor.address}. Para alterar o endereço, preencha os campos abaixo.`} />}
      {field('cep', 'CEP', { keyboardType: 'number-pad', maxLength: 9, placeholder: '00000-000' })}
      <Button title="Buscar CEP" icon="search" secondary busy={lookupBusy} disabled={busy || locating || confirmDelete} onPress={searchCep} />
      <Notice error text={lookupError} />
      {field('street', 'Logradouro', { maxLength: 120 })}
      {field('number', 'Número', { maxLength: 10, placeholder: 'Ex.: 25 ou S/N' })}
      {field('neighborhood', 'Bairro ou região', { maxLength: 80 })}
      {field('city', 'Cidade', { maxLength: 80 })}
      {field('state', 'UF', { autoCapitalize: 'characters', maxLength: 2 })}
      {field('complement', 'Complemento (opcional)', { maxLength: 80 })}
    </Card>
    <Card>
      <Text style={styles.section}>Localização no mapa</Text>
      {locationSource === 'cep'
        ? <Notice text="Localização aproximada preenchida pelo CEP." />
        : <Body>{currentCoordinate ? 'Localização definida para este equipamento.'
          : 'Busque o CEP para preencher a localização. Se o ponto não estiver disponível, use a localização atual no local da instalação.'}</Body>}
      <Button title="Usar minha localização" secondary icon="crosshair" busy={locating} disabled={busy || lookupBusy || confirmDelete} onPress={locate} />
      <Button title={showCoordinates ? 'Ocultar coordenadas' : 'Ajustar coordenadas manualmente'} secondary
        disabled={formBusy} onPress={() => setShowCoordinates(!showCoordinates)} />
      {showCoordinates && <>
        {field('latitude', 'Latitude', decimal)}
        {field('longitude', 'Longitude', decimal)}
      </>}
    </Card>
    <Card>
      {field('capacity', 'Capacidade (L)', decimal)}
      {field('limit', 'Limite operacional (L)', decimal)}
      {field('radiusMeters', 'Raio de cobertura (m)', decimal)}
    </Card>
    <Notice error text={error} />
    <Button title="Salvar equipamento" icon="save" busy={busy && !confirmDelete}
      disabled={confirmDelete || lookupBusy || locating} onPress={() => submit()} />
    {!!sensor.id && (confirmDelete ? <Card>
      <Notice text="Confirme a retirada deste equipamento do mapa e do catálogo." />
      <Button title="Confirmar exclusão" danger busy={busy} onPress={() => submit(true)} />
      <Button title="Cancelar exclusão" secondary disabled={busy} onPress={() => setConfirmDelete(false)} />
    </Card> : <Button title="Excluir equipamento" icon="trash-2" danger disabled={formBusy}
      onPress={() => setConfirmDelete(true)} />)}
  </>;
}
