import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, liters, reportDate, sensorStatus } from '../theme';
import { Badge, Body, Button, Card, Heading, styles } from '../ui';
import { EquipmentInsights } from './EquipmentInsights';
import { Filters } from './Operations';

const plotHeight = 138;
const pageSize = 12;
const periods = [['all', 'Todos'], ['today', 'Hoje'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias']];

function periodRange(period, lastReadingAt) {
  const until = new Date(Math.max(Date.now(), Date.parse(lastReadingAt) || 0));
  if (period === 'all') return { period, to: until.toISOString() };
  const from = new Date(until);
  if (period === 'today') from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - Number.parseInt(period, 10));
  return { period, from: from.toISOString(), to: until.toISOString() };
}

export function ReadingFields({ items }) {
  return items.map(([label, value]) => (
    <View key={label} style={history.field}>
      <Text style={history.label}>{label}</Text>
      <Text selectable style={history.fieldValue}>{value}</Text>
    </View>
  ));
}

function formatChange(value) {
  if (!Number.isFinite(value)) return 'Sem leitura anterior';
  if (value === 0) return 'Sem variação';
  return `${value > 0 ? '+' : '−'}${liters(Math.abs(value))}`;
}

function normalizeSamples(sensor) {
  const dated = (sensor.samples || []).filter((reading) => Number.isFinite(reading.volume));
  if (dated.length) return dated.sort((a, b) => (Date.parse(a.at) || Infinity) - (Date.parse(b.at) || Infinity));
  return (sensor.readings || []).filter(Number.isFinite).map((volume) => ({ volume }));
}

function shortTime(at) {
  return Number.isFinite(Date.parse(at))
    ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export function EquipmentReadings({ sensor }) {
  const [active, setActive] = useState(null);
  const [page, setPage] = useState(0);
  const [requestedPeriod, setPeriod] = useState('today');
  const scroll = useRef(null);
  const all = normalizeSamples(sensor);
  const hasDates = all.some(({ at }) => Number.isFinite(Date.parse(at)));
  const period = hasDates ? requestedPeriod : 'all';
  // Recalcula o limite superior ao receber uma nova ficha, incluindo novas amostras.
  const range = useMemo(() => periodRange(period, sensor.lastReadingAt), [period, sensor.lastReadingAt]);
  const from = range.from ? Date.parse(range.from) : -Infinity;
  const to = Date.parse(range.to);
  const filtered = all.map((reading, index) => ({ reading, index })).filter(({ reading }) => {
    const at = Date.parse(reading.at);
    return Number.isFinite(at) ? at >= from && at <= to : period === 'all';
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const end = Math.max(0, filtered.length - currentPage * pageSize);
  const offset = Math.max(0, end - pageSize);
  const visible = filtered.slice(offset, end);
  const maximum = visible.reduce((max, { reading }) => Math.max(max, reading.volume), Math.max(sensor.capacity || 0, sensor.limit || 0, 1));

  function changePeriod(next) {
    setActive(null);
    setPage(0);
    setPeriod(next);
  }

  return <><Card>
    <Text style={styles.section}>Histórico de leituras</Text>
    <Filters label="Período das leituras" options={hasDates ? periods : periods.slice(0, 1)} value={period} onChange={changePeriod} />
    {!hasDates && all.length > 0 && <Body>O histórico disponível não informa datas, por isso só é possível ver todos os registros.</Body>}
    <Body>{visible.length > 0
      ? `Leituras ${offset + 1} a ${end} de ${filtered.length} no período. Toque em uma barra para abrir a medição.`
      : 'Nenhuma leitura disponível neste período.'}</Body>
    {visible.length > 0 && <>
      <ScrollView key={`${period}-${currentPage}`} ref={scroll} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={visible.length > 5}
        onContentSizeChange={() => { if (visible.length > 6 && currentPage === 0 && !active) scroll.current?.scrollToEnd({ animated: false }); }}
        contentContainerStyle={history.chartScroll}>
        <View style={[history.chartInner, { minWidth: visible.length * 44 + 16 }]}>
          <View style={history.plot}>
            {visible.map(({ reading, index }, position) => {
              const limitReached = Number.isFinite(sensor.limit) && reading.volume >= sensor.limit;
              const sampleState = sensorStatus[reading.status];
              const tone = limitReached || sampleState?.tone === 'red' ? colors.danger
                : sampleState?.tone === 'yellow' ? colors.warning : colors.primary;
              return <Pressable key={reading.id || index}
                accessibilityRole="button"
                accessibilityLabel={`Leitura ${offset + position + 1}: ${liters(reading.volume)}`}
                accessibilityHint={reportDate(reading.at)}
                onPress={() => setActive({ sensor, reading, previous: all[index - 1], index: offset + position + 1 })}
                style={({ pressed }) => [history.barHit, pressed && { backgroundColor: colors.soft }]}>
                <View style={[history.bar, {
                  height: Math.max(3, Math.min(plotHeight, reading.volume / maximum * plotHeight)),
                  backgroundColor: tone,
                }]} />
              </Pressable>;
            })}
            {sensor.limit > 0 && <View pointerEvents="none" style={[history.threshold, {
              bottom: Math.round(sensor.limit / maximum * plotHeight),
            }]} />}
          </View>
          <View style={history.axis}>
            {visible.map(({ reading, index }, position) => (
              <Text key={reading.id || index} style={history.tick}>
                {!Number.isFinite(Date.parse(reading.at)) ? `#${offset + position + 1}` : period === 'today'
                  ? shortTime(reading.at) : new Date(reading.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.wrap}>
        <Badge label="Volume em litros" tone="green" />
        {sensor.limit > 0 && <Badge label={`Linha pontilhada: ${liters(sensor.limit)}`} tone="yellow" />}
      </View>
      {offset > 0 && <Button secondary title="Leituras anteriores" icon="arrow-left" onPress={() => setPage(currentPage + 1)} />}
      {currentPage > 0 && <Button secondary title="Leituras mais recentes" icon="arrow-right" onPress={() => setPage(currentPage - 1)} />}
    </>}
    <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActive(null)}>
      {active && <ReadingDetail {...active} close={() => setActive(null)} />}
    </Modal>
  </Card>
    <EquipmentInsights key={period} sensor={sensor} readings={filtered.map(({ reading }) => reading)} range={range} />
  </>;
}

function ReadingDetail({ sensor, reading, previous, index, close }) {
  const capacity = reading.capacity ?? sensor.capacity;
  const limit = reading.limit ?? sensor.limit;
  const state = sensorStatus[reading.status];
  const occupied = capacity > 0 ? `${Math.round(reading.volume / capacity * 100)}% da capacidade` : 'Capacidade não informada';
  const margin = Number.isFinite(limit) ? limit - reading.volume : null;
  const change = previous ? reading.volume - previous.volume : null;
  const elapsed = Date.parse(reading.at) - Date.parse(previous?.at);
  return <SafeAreaView style={history.modal} accessibilityViewIsModal>
    <ScrollView contentContainerStyle={history.modalContent}>
      <Heading kicker={sensor.prefix || sensor.id} title="Detalhes da leitura" subtitle={`Amostra ${index} · ${reportDate(reading.at)}`} />
      <Button secondary title="Fechar leitura" icon="x" onPress={close} />
      <Card>
        {state && <Badge label={state.label} tone={state.tone} />}
        <Text style={history.volume}>{liters(reading.volume)}</Text>
        <Body>Volume estimado · {occupied}</Body>
        <ReadingFields items={[
          ['Nível medido', Number.isFinite(reading.levelCm) ? `${reading.levelCm.toLocaleString('pt-BR')} cm` : 'Não informado'],
          [reading.capacity == null ? 'Capacidade atual de referência' : 'Capacidade registrada', liters(capacity)],
          [reading.limit == null ? 'Limite atual de referência' : 'Limite registrado', liters(limit)],
          ['Distância até o limite', margin == null ? 'Não informada'
            : margin < 0 ? `${liters(-margin)} acima` : margin === 0 ? 'No limite' : `${liters(margin)} abaixo`],
          ['Variação desde a leitura anterior', formatChange(change)],
          ['Volume anterior', previous ? liters(previous.volume) : 'Sem leitura anterior'],
          ['Horário da leitura anterior', previous?.at ? reportDate(previous.at) : 'Não informado'],
          ['Intervalo desde a leitura anterior', Number.isFinite(elapsed) && elapsed >= 0
            ? `${(elapsed / 60_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min` : 'Não informado'],
          ['Origem da medição', reading.source || 'Não informada'],
        ]} />
        {!!reading.note && <Body>{reading.note}</Body>}
      </Card>
    </ScrollView>
  </SafeAreaView>;
}

const history = StyleSheet.create({
  field: { gap: 4, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8 },
  label: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  fieldValue: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  chartScroll: { flexGrow: 1 },
  chartInner: { flexGrow: 1, backgroundColor: colors.canvas, borderRadius: 12, padding: 8, paddingTop: 14 },
  plot: { height: plotHeight, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  barHit: { flex: 1, minWidth: 44, height: plotHeight, paddingHorizontal: 7, justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  threshold: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.warning },
  axis: { flexDirection: 'row' },
  tick: { flex: 1, minWidth: 44, textAlign: 'center', paddingVertical: 7, fontSize: 10, color: colors.muted },
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalContent: { padding: 20, paddingBottom: 32, gap: 14 },
  volume: { fontSize: 30, color: colors.ink, fontWeight: '800' },
});
