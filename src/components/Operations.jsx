import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { reportOrder } from '../report-policy';
import { categories, colors, equipmentStatus, reportDate, reportStatus, sensorStatus } from '../theme';
import { Body, ListItem, Notice, styles } from '../ui';

const equipmentFilters = [['all', 'Todos'], ...Object.entries(sensorStatus).map(([key, item]) => [key, item.label])];
const categoryFilters = [['all', 'Todos'], ...categories.map((category) => [category, category])];
const coverageFilters = [['all', 'Todos'], ['nearby', 'Com equipamento próximo'], ['none', 'Sem equipamento próximo']];
const assessmentFilters = [['all', 'Todos'], ['requested', 'Avaliação solicitada'], ['none', 'Sem avaliação solicitada']];

export function Filters({ label, options, value, onChange }) {
  return <View accessibilityRole={label ? 'tablist' : undefined} accessibilityLabel={label} style={styles.wrap}>
    {options.map(([id, label]) => <Pressable key={id} accessibilityRole="tab"
      accessibilityLabel={label} accessibilityState={{ selected: value === id }}
      onPress={() => onChange(id)} style={[filterStyle.chip, value === id && filterStyle.active]}>
      <Text style={[filterStyle.text, value === id && filterStyle.activeText]}>{label}</Text>
    </Pressable>)}
  </View>;
}

export function EquipmentFilters({ value, onChange }) {
  return <Filters options={equipmentFilters} value={value} onChange={onChange} />;
}

export const filterEquipment = (equipment, status) => status === 'all'
  ? equipment : equipment.filter((sensor) => equipmentStatus(sensor) === status);

export function EquipmentRows({ equipment }) {
  const router = useRouter();
  if (!equipment.length) return <Notice text="Nenhum equipamento neste filtro." />;
  return equipment.map((sensor) => {
    const status = sensorStatus[equipmentStatus(sensor)];
    return <ListItem key={sensor.id} title={`${sensor.prefix || sensor.id} · ${sensor.name}`}
      description={sensor.address} icon="activity" badge={status?.label} tone={status?.tone}
      onPress={() => router.push({ pathname: '/sensor/[id]', params: { id: sensor.id } })} />;
  });
}

export function ReportQueue({ reports, operator = false }) {
  const router = useRouter();
  const [category, setCategory] = useState('all');
  const [coverage, setCoverage] = useState('all');
  const [assessment, setAssessment] = useState('all');
  const openedAt = (report) => {
    const date = Date.parse(report.createdAt);
    return Number.isFinite(date) ? date : Infinity;
  };
  const visible = reports.filter((report) => {
    const inCategory = category === 'all' || report.category === category;
    const inCoverage = coverage === 'all' || Boolean(report.sensorId) === (coverage === 'nearby');
    const inAssessment = assessment === 'all' || Boolean(report.assessment) === (assessment === 'requested');
    return inCategory && inCoverage && inAssessment;
  }).sort(operator ? (a, b) => openedAt(a) - openedAt(b) : reportOrder);
  return <>
    {operator && <Text style={filterStyle.label}>Categoria</Text>}
    <Filters label={operator ? 'Categoria' : undefined} options={categoryFilters} value={category} onChange={setCategory} />
    {operator && <>
      <Text style={filterStyle.label}>Cobertura</Text>
      <Filters label="Cobertura" options={coverageFilters} value={coverage} onChange={setCoverage} />
      <Text style={filterStyle.label}>Avaliação técnica</Text>
      <Filters label="Avaliação técnica" options={assessmentFilters} value={assessment} onChange={setAssessment} />
      <Body style={{ fontSize: 13 }}>Mais antigos primeiro · {visible.length} {visible.length === 1 ? 'relato' : 'relatos'}</Body>
    </>}
    {visible.length === 0 && <Body>{operator ? 'Nenhum relato com estes filtros.' : 'Nenhum relato nesta categoria.'}</Body>}
    {visible.map((report) => {
      const status = reportStatus[report.status];
      const priority = operator && report.previousReportId && report.status !== 'closed';
      return <ListItem key={report.id} title={report.category}
        description={`${report.protocol} · ${report.address}`} icon="file-text"
        metadata={operator ? `Aberto em ${reportDate(report.createdAt)}\n${report.sensorId ? 'Com equipamento próximo' : 'Sem equipamento próximo'}${report.assessment ? ' · Avaliação solicitada' : ''}` : undefined}
        badge={priority ? `Prioridade · ${status.label}` : status.label} tone={priority ? 'red' : status.tone}
        onPress={() => router.push({ pathname: '/relato/[id]', params: { id: report.id } })} />;
    })}
  </>;
}

const filterStyle = StyleSheet.create({
  label: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  chip: { paddingHorizontal: 12, paddingVertical: 9, minHeight: 36, justifyContent: 'center',
    borderRadius: 10, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  active: { backgroundColor: colors.soft, borderColor: colors.primary },
  text: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  activeText: { color: colors.primary },
});
