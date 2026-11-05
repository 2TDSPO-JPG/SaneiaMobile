import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { EquipmentFilters, filterEquipment, Filters } from '../components/Operations';
import { demoCenter } from '../data/demo';
import { api, demoMode, liveIotDemo } from '../services/api';
import { useErrorText, useSession } from '../session';
import { equipmentStatus, roleLabels, sensorStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Body, Button, Card, Field, Heading, ListItem, Notice, Resource, Screen, styles } from '../ui';

const roleFilters = [['all', 'Todos'], ...Object.entries(roleLabels)];

export function AdminHomeScreen() {
  const router = useRouter();
  return <Screen tabs>
    <Heading kicker="Área administrativa" title="Administração"
      subtitle="Gerencie os equipamentos e consulte as contas cadastradas." />
    <ListItem title="Gerenciar equipamentos" description="Cadastre, edite ou retire equipamentos do catálogo."
      icon="activity" onPress={() => router.push('/equipamentos')} />
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
      </Card>) : <Notice text="Nenhum usuário neste filtro." />;
    }}</Resource>
  </Screen>;
}

export function AdminEquipmentScreen() {
  const router = useRouter();
  const state = useResource(api.adminEquipment);
  const [status, setStatus] = useState('all');
  return <Screen tabs>
    <Heading kicker="Administração" title="Equipamentos" subtitle="As alterações no catálogo aparecem na área da operadora." />
    <Button title="Cadastrar equipamento" icon="plus" onPress={() => router.push('/equipamento')} />
    <EquipmentFilters value={status} onChange={setStatus} />
    <Resource state={state}>{(sensors) => {
      const visible = filterEquipment(sensors, status);
      return visible.length ? visible.map((sensor) => {
        const current = sensorStatus[equipmentStatus(sensor)];
        return <ListItem key={sensor.id} title={`${sensor.prefix} · ${sensor.name}`}
          description={sensor.address} icon="activity" badge={current?.label} tone={current?.tone}
          onPress={() => router.push({ pathname: '/equipamento', params: { id: sensor.id } })} />;
      }) : <Notice text="Nenhum equipamento neste filtro." />;
    }}</Resource>
  </Screen>;
}

export function AdminEquipmentFormScreen() {
  const { id } = useLocalSearchParams();
  const load = useCallback((session) => typeof id === 'string' ? api.adminSensor(session, id) : {}, [id]);
  const state = useResource(load);
  return <Screen back>
    <Heading kicker="Administração" title={id ? 'Editar equipamento' : 'Novo equipamento'} />
    <Resource state={state}>{(sensor) => <EquipmentForm key={sensor.id ?? 'new'} sensor={sensor} />}</Resource>
  </Screen>;
}

function readNumber(value) {
  const clean = value.trim().replace(',', '.');
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) ? Number(clean) : NaN;
}

function equipmentInput(fields) {
  const prefix = fields.prefix.trim().toUpperCase();
  const name = fields.name.trim();
  const neighborhood = fields.neighborhood.trim();
  const address = fields.address.trim();
  const equipmentType = fields.equipmentType.trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(prefix)) throw new Error('Use de 2 a 30 letras, números, hífens ou sublinhados no prefixo.');
  if (!name || !neighborhood || !address || !equipmentType) throw new Error('Preencha nome, bairro, endereço e tipo.');
  const latitude = readNumber(fields.latitude);
  const longitude = readNumber(fields.longitude);
  if (!(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) {
    throw new Error('Informe latitude entre -90 e 90 e longitude entre -180 e 180.');
  }
  const capacity = readNumber(fields.capacity);
  const limit = readNumber(fields.limit);
  const radiusMeters = readNumber(fields.radiusMeters);
  if (!(Number.isFinite(capacity) && capacity > 0 && limit > 0 && limit <= capacity)) {
    throw new Error('Informe uma capacidade positiva e um limite entre zero e a capacidade.');
  }
  if (!(Number.isFinite(radiusMeters) && radiusMeters > 0)) throw new Error('Informe um raio de cobertura positivo.');
  const data = { prefix, name, address, neighborhood, equipmentType, coordinate: { latitude, longitude }, capacity, limit, radiusMeters };
  if (!demoMode) return data;
  const simulatedVolume = fields.volume.trim() ? readNumber(fields.volume) : null;
  if (simulatedVolume != null && !(simulatedVolume >= 0 && simulatedVolume <= capacity)) {
    throw new Error('O volume simulado deve estar entre zero e a capacidade.');
  }
  return { ...data, simulatedVolume };
}

function EquipmentForm({ sensor }) {
  const router = useRouter();
  const { session } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fields, setFields] = useState({
    prefix: sensor.prefix ?? '', name: sensor.name ?? '', address: sensor.address ?? '',
    neighborhood: sensor.neighborhood ?? '', equipmentType: sensor.equipmentType ?? 'Reservatório com sensor de nível',
    latitude: String(sensor.coordinate?.latitude ?? ''), longitude: String(sensor.coordinate?.longitude ?? ''),
    capacity: String(sensor.capacity ?? ''), limit: String(sensor.limit ?? ''), radiusMeters: String(sensor.radiusMeters ?? 200),
    volume: sensor.status === 'offline' ? '' : String(sensor.volume ?? ''),
  });
  const field = (key, label, props) => <Field label={label} value={fields[key]} editable={!busy}
    onChangeText={(value) => setFields((current) => ({ ...current, [key]: value }))} {...props} />;
  const decimal = { keyboardType: 'numbers-and-punctuation' };

  async function submit(remove = false) {
    setError('');
    setBusy(true);
    try {
      if (remove) await api.deleteEquipment(session, sensor.id);
      else await api.saveEquipment(session, equipmentInput(fields), sensor.id);
      router.dismissTo('/equipamentos');
    } catch (failure) {
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
      {field('neighborhood', 'Bairro ou região', { maxLength: 80 })}
      {field('address', 'Endereço ou referência', { maxLength: 160 })}
      {field('latitude', 'Latitude', decimal)}
      {field('longitude', 'Longitude', decimal)}
      {demoMode && <Button title="Usar coordenadas de exemplo" secondary disabled={busy}
        onPress={() => setFields((current) => ({ ...current,
          latitude: String(demoCenter.latitude), longitude: String(demoCenter.longitude) }))} />}
    </Card>
    <Card>
      {field('capacity', 'Capacidade (L)', decimal)}
      {field('limit', 'Limite operacional (L)', decimal)}
      {field('radiusMeters', 'Raio de cobertura (m)', decimal)}
      {demoMode && <>
        {field('volume', 'Volume simulado (L)', decimal)}
        <Body>Deixe vazio para simular falta de comunicação. O alerta começa em 85% do limite e o alarme começa no limite.</Body>
      </>}
      {liveIotDemo && sensor.id === 'S07' && <Notice text="Com a ponte IoT ativa, as leituras e os limites operacionais do S07 vêm da configuração da ponte." />}
    </Card>
    <Notice error text={error} />
    <Button title="Salvar equipamento" icon="save" busy={busy && !confirmDelete}
      disabled={confirmDelete} onPress={() => submit()} />
    {!!sensor.id && (confirmDelete ? <Card>
      <Notice text="Confirme a retirada deste equipamento do mapa e do catálogo." />
      <Button title="Confirmar exclusão" danger busy={busy} onPress={() => submit(true)} />
      <Button title="Cancelar exclusão" secondary disabled={busy} onPress={() => setConfirmDelete(false)} />
    </Card> : <Button title="Excluir equipamento" icon="trash-2" danger disabled={busy}
      onPress={() => setConfirmDelete(true)} />)}
  </>;
}
