import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import MonitorMap from '../components/MonitorMap';
import { EquipmentDetails } from '../components/EquipmentDetails';
import { EquipmentFilters, EquipmentRows, filterEquipment } from '../components/Operations';
import { demoCenter } from '../data/demo';
import { api, demoMode, liveIotDemo } from '../services/api';
import { useSession } from '../session';
import { areaKey, equipmentStatus, reportDate, sensorStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Button, Field, Heading, Notice, Resource, Screen, styles } from '../ui';

const telemetryPollMs = liveIotDemo || !demoMode ? 5000 : 0;

export function MapScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { status } = useLocalSearchParams();
  const filter = typeof status === 'string' && Object.hasOwn(sensorStatus, status) ? status : 'all';
  const [search, setSearch] = useState('');
  const [visibleRows, setVisibleRows] = useState(24);
  const state = useResource(loadEquipment, telemetryPollMs);
  if (session?.user.role !== 'operator') return <Screen back><Notice error text="Mapa disponível para a operadora." /></Screen>;
  const openSensor = (id) => router.push({ pathname: '/sensor/[id]', params: { id } });

  return <Screen tabs>
    <Heading kicker="Área da operadora" title="Mapa de monitoramento" subtitle="Acompanhe os equipamentos e filtre por estado." />
    <EquipmentFilters value={filter} onChange={(value) => {
      setVisibleRows(24);
      router.setParams({ status: value });
    }} />
    <Field label="Buscar equipamento ou local" value={search} placeholder="Prefixo, bairro, rua ou CEP"
      onChangeText={(value) => { setSearch(value); setVisibleRows(24); }} />
    <Resource state={state}>{(sensors) => {
      const terms = areaKey(search).split(/\s+/).filter(Boolean);
      const visibleSensors = filterEquipment(sensors, filter).filter((sensor) => {
        const location = areaKey([sensor.prefix, sensor.name, sensor.address, sensor.neighborhood,
          sensor.postalAddress?.cep].join(' '));
        return terms.every((term) => location.includes(term) || location.includes(term.replace(/-/g, '')));
      });
      const compact = visibleSensors.length > 35;
      const markers = visibleSensors.map((sensor) => ({
        id: sensor.id, prefix: sensor.prefix || sensor.id, compact,
        title: `${sensor.prefix || sensor.id} · ${sensorStatus[equipmentStatus(sensor)]?.label || 'Estado desconhecido'}`,
        coordinate: sensor.coordinate, status: equipmentStatus(sensor), onPress: () => openSensor(sensor.id),
      }));
      return <>
        {liveIotDemo && sensors.filter((sensor) => sensor.liveTelemetry).map((sensor) => (
          <Notice key={sensor.id} text={sensor.lastReadingAt
            ? `${sensor.prefix || sensor.id} · ${sensor.status === 'offline' ? 'Sem dados novos. ' : ''}Última leitura: ${reportDate(sensor.lastReadingAt)}.`
            : `${sensor.prefix || sensor.id} · Aguardando a primeira leitura do equipamento.`} />
        ))}
        {filter !== 'all' && visibleSensors.length === 0 && sensors.length > 0 && (
          <Button secondary title="Ver todos os equipamentos" onPress={() => router.setParams({ status: 'all' })} />
        )}
        <MonitorMap key={filter} markers={markers} center={markers[0]?.coordinate || demoCenter} />
        <View style={styles.wrap}>
          <Badge label="! Alarme" tone="red" /><Badge label="! Alerta" tone="yellow" />
          <Badge label="? Sem comunicação" />
        </View>
        {telemetryPollMs
          ? <Badge label="Consulta automática a cada 5 s" tone="green" />
          : <Button secondary title="Atualizar mapa" icon="refresh-cw" onPress={state.retry} />}
        <Text style={styles.section}>Equipamentos no mapa · {visibleSensors.length}</Text>
        <EquipmentRows equipment={visibleSensors.slice(0, visibleRows)} />
        {visibleRows < visibleSensors.length && <Button secondary title="Mostrar mais equipamentos"
          onPress={() => setVisibleRows((count) => count + 24)} />}
      </>;
    }}</Resource>
  </Screen>;
}

function loadEquipment(session) {
  return session.user.role === 'operator' ? api.sensors(session) : Promise.resolve([]);
}

export function SensorScreen() {
  const { id } = useLocalSearchParams();
  const { session } = useSession();
  const load = useCallback((current) => current.user.role === 'operator'
    ? api.sensor(current, id) : Promise.resolve(null), [id]);
  const state = useResource(load, telemetryPollMs);
  if (session?.user.role !== 'operator') return <Screen back><Notice error text="Leituras disponíveis para a operadora." /></Screen>;

  return <Screen back><Resource state={state}>{(sensor) => (
    <EquipmentDetails key={sensor.id} sensor={sensor} automatic={telemetryPollMs > 0} onRefresh={state.retry} />
  )}</Resource></Screen>;
}
