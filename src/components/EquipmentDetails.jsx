import { StyleSheet, Text, View } from 'react-native';
import { areaName, colors, equipmentStatus, liters, reportDate, sensorStatus } from '../theme';
import { Badge, Body, Button, Card, Heading, Notice, styles } from '../ui';
import { EquipmentReadings, ReadingFields } from './EquipmentReadings';

export function EquipmentDetails({ sensor, automatic, onRefresh }) {
  const current = equipmentStatus(sensor);
  const status = sensorStatus[current];
  const hasVolume = Number.isFinite(sensor.volume);
  const hasCapacity = sensor.capacity > 0;
  const percent = hasCapacity && hasVolume ? Math.round(sensor.volume / sensor.capacity * 100) : null;
  const margin = hasVolume && Number.isFinite(sensor.limit) ? sensor.limit - sensor.volume : null;
  const coordinate = sensor.coordinate;
  const interval = sensor.expectedIntervalMinutes;
  const timeToLimit = sensor.etaHours == null ? null : sensor.etaHours < 1
    ? `${Math.max(1, Math.round(sensor.etaHours * 60))} min` : `${sensor.etaHours} h`;
  const events = [...(sensor.events || [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return <>
    <Heading kicker={sensor.prefix || sensor.id} title={sensor.name} subtitle={sensor.address || areaName(sensor)} />
    <Card>
      <Text style={styles.section}>Estado do equipamento</Text>
      <View style={styles.wrap}>
        <Badge label={status?.label || 'Estado desconhecido'} tone={status?.tone} />
        {automatic && <Badge label="Consulta automática a cada 5 s" tone="green" />}
      </View>
      <Text style={details.value}>{liters(sensor.volume)}</Text>
      <Body>{current === 'offline' ? 'Último volume estimado antes da perda de comunicação' : 'Volume estimado'}
        {percent == null ? '' : ` · ${percent}% da capacidade`}</Body>
      {percent != null && <View style={details.track}>
        <View style={[details.fill, {
          width: `${Math.max(0, Math.min(percent, 100))}%`,
          backgroundColor: status?.tone === 'red' ? colors.danger : status?.tone === 'yellow' ? colors.warning : colors.primary,
        }]} />
      </View>}
      {!!sensor.reason && <Notice text={sensor.reason} error={current === 'alarm'} />}
      <ReadingFields items={[
        ['Capacidade total', liters(sensor.capacity)],
        ['Espaço disponível', hasCapacity && hasVolume ? liters(Math.max(0, sensor.capacity - sensor.volume)) : 'Não informado'],
        ['Limite operacional', liters(sensor.limit)],
        ['Margem até o limite', margin == null ? 'Não informada'
          : margin < 0 ? `${liters(-margin)} acima` : margin === 0 ? 'No limite' : `${liters(margin)} abaixo`],
        ['Última leitura recebida', reportDate(sensor.lastReadingAt)],
      ]} />
    </Card>

    <EquipmentReadings sensor={sensor} />

    <Card>
      <Text style={styles.section}>Eventos do equipamento</Text>
      <Body>Alarmes nos últimos seis meses: {sensor.alarmsSixMonths ?? 'indisponível'}</Body>
      {events.length ? events.map((event, index) => (
        <View key={event.id || index} style={details.event}>
          <Badge label={sensorStatus[event.status]?.label || 'Evento'} tone={sensorStatus[event.status]?.tone} />
          <Body>{reportDate(event.at)}</Body>
          <Text style={details.eventText}>{event.message}</Text>
        </View>
      )) : <Body>Sem eventos recentes registrados.</Body>}
    </Card>

    <Card>
      <Text style={styles.section}>Previsão e contexto</Text>
      <Body>{current === 'offline' ? 'Estimativa suspensa enquanto o equipamento estiver sem comunicação.'
        : margin != null && margin <= 0 ? 'O limite operacional já foi atingido.'
          : timeToLimit ? `Se o ritmo atual continuar, o nível pode atingir o limite em cerca de ${timeToLimit}.`
            : 'Estimativa indisponível para este ponto.'}</Body>
      {!!sensor.summary && <Notice text={sensor.summary} />}
    </Card>

    <Card>
      <Text style={styles.section}>Cadastro e localização</Text>
      <ReadingFields items={[
        ['Prefixo do equipamento', sensor.prefix || sensor.id],
        ['Identificador do sensor', sensor.id],
        ['Tipo', sensor.equipmentType || 'Não informado'],
        ['Bairro ou setor', areaName(sensor)],
        ['Endereço ou referência', sensor.address || 'Não informado'],
        ['Coordenadas', coordinate ? `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}` : 'Não informadas'],
        ['Raio de cobertura estimada', sensor.radiusMeters != null ? `${sensor.radiusMeters} m` : 'Não informado'],
      ]} />
    </Card>

    <Card>
      <Text style={styles.section}>Comunicação e origem dos dados</Text>
      <ReadingFields items={[
        ['Comunicação', current === 'offline' ? 'Sem comunicação' : status ? 'Em operação' : 'Não informada'],
        ['Origem', sensor.source || 'Não informada'],
        ['Intervalo de leitura previsto', interval == null ? 'Não informado' : interval < 1
          ? `${Math.round(interval * 60)} s` : `${interval} min`],
      ]} />
    </Card>
    {!automatic && <Button secondary title="Atualizar leituras" icon="refresh-cw" onPress={onRefresh} />}
  </>;
}

const details = StyleSheet.create({
  value: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  track: { height: 9, borderRadius: 8, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { height: 9, borderRadius: 8 },
  event: { gap: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  eventText: { color: colors.ink, fontSize: 15, lineHeight: 21 },
});
