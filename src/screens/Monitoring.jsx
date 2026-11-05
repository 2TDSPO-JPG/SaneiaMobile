import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import MonitorMap from '../components/MonitorMap';
import { EquipmentDetails } from '../components/EquipmentDetails';
import { EquipmentFilters, EquipmentRows, filterEquipment } from '../components/Operations';
import { demoCenter } from '../data/demo';
import { api, demoMode, liveIotDemo } from '../services/api';
import { useSession } from '../session';
import { equipmentStatus, reportDate, sensorStatus } from '../theme';
import { useResource } from '../use-resource';
import { Badge, Button, Heading, Notice, Resource, Screen, styles } from '../ui';

const telemetryPollMs = liveIotDemo || !demoMode ? 5000 : 0;

export function MapScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { status } = useLocalSearchParams();
  const filter = typeof status === 'string' && Object.hasOwn(sensorStatus, status) ? status : 'all';
  const state = useResource(loadEquipment, telemetryPollMs);
  if (session?.user.role !== 'operator') return <Screen back><Notice error text="Mapa disponível para a operadora." /></Screen>;
  const openSensor = (id) => router.push({ pathname: '/sensor/[id]', params: { id } });

  return <Screen tabs>
    <Heading kicker="Área da operadora" title="Mapa de monitoramento" subtitle="Acompanhe os equipamentos e filtre por estado." />
    <EquipmentFilters value={filter} onChange={(value) => router.setParams({ status: value })} />
    <Resource state={state}>{(sensors) => {
      const visibleSensors = filterEquipment(sensors, filter);
      const markers = visibleSensors.map((sensor) => ({
        id: sensor.id, prefix: sensor.prefix || sensor.id,
        title: `${sensor.prefix || sensor.id} · ${sensorStatus[equipmentStatus(sensor)]?.label || 'Estado desconhecido'}`,
        coordinate: sensor.coordinate, status: equipmentStatus(sensor), onPress: () => openSensor(sensor.id),
      }));
      return <>
        {liveIotDemo && sensors.map((sensor) => (
          <Notice key={sensor.id} text={sensor.lastReadingAt
            ? `${sensor.prefix || sensor.id} · ${sensor.status === 'offline' ? 'Sem dados novos. ' : ''}Última leitura: ${reportDate(sensor.lastReadingAt)}.`
            : `${sensor.prefix || sensor.id} · A ponte está conectada ao app. Aguardando a primeira leitura do sensor.`} />
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
        <Text style={styles.section}>Equipamentos no mapa</Text>
        <EquipmentRows equipment={visibleSensors} />
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
