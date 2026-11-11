import { useState } from 'react';
import { Text } from 'react-native';
import { api, demoMode, dotNetMonitoring } from '../services/api';
import { useErrorText, useSession } from '../session';
import { liters, reportDate } from '../theme';
import { Body, Button, Card, Notice, styles } from '../ui';

export function EquipmentInsights({ sensor, readings, range }) {
  const { session } = useSession();
  const errorText = useErrorText();
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const peak = readings.reduce((highest, item) => !highest || item.volume > highest.volume ? item : highest, null);
  const dated = readings.filter(({ at }) => Number.isFinite(Date.parse(at)));
  const change = dated.length >= 2 ? dated.at(-1).volume - dated[0].volume : null;
  const compared = readings.filter((item) => Number.isFinite(item.limit ?? sensor.limit));
  const reached = compared.filter((item) => item.volume >= (item.limit ?? sensor.limit)).length;
  const usesCurrentLimit = compared.some((item) => item.limit == null);

  async function analyze() {
    setBusy(true);
    setError('');
    try {
      const result = await api.sensorInsights(session, sensor.id, range);
      if (typeof result.summary !== 'string' || !result.summary.trim()) {
        throw new Error('A análise está indisponível para este período. Tente novamente.');
      }
      setSummary({ text: result.summary.trim(), to: range.to, generated: result.aiGenerated !== false });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return <Card>
    <Text style={styles.section}>Insights do período</Text>
    {!peak ? <Body>Sem leituras no recorte para calcular indicadores.</Body> : <>
      <Body>{`${readings.length} ${readings.length === 1 ? 'leitura analisada' : 'leituras analisadas'}`}</Body>
      <Body>Maior volume: {liters(peak.volume)}{Number.isFinite(Date.parse(peak.at)) ? ` · ${reportDate(peak.at)}` : ''}</Body>
      {change != null ? <Body>{change === 0 ? 'O volume foi o mesmo na primeira e na última leitura do período.'
        : `Entre a primeira e a última leitura do período, o volume ${change > 0 ? 'subiu' : 'caiu'} ${liters(Math.abs(change))}.`}</Body>
        : <Body>São necessárias pelo menos duas leituras com data para comparar a variação no período.</Body>}
      {compared.length > 0 && <Body>{reached} de {compared.length} leituras comparáveis atingiram ou passaram do limite
        {usesCurrentLimit ? ', usando o limite atual quando o histórico não informa o valor vigente' : ''}.</Body>}
      {demoMode && !sensor.liveTelemetry ? <Body>A análise está disponível para equipamentos com leituras recebidas.</Body>
        : <Button secondary title={summary ? 'Atualizar análise com IA' : 'Gerar análise com IA'}
          icon="activity" onPress={analyze} busy={busy} disabled={dated.length === 0} />}
      {dotNetMonitoring && <Body>A análise com IA usa as leituras disponíveis no Java.</Body>}
      <Notice error text={error} />
      {summary ? <><Text style={styles.section}>Análise do período</Text>
        {summary.generated === false && <Body style={{ fontSize: 12 }}>Resumo calculado a partir dos indicadores.</Body>}
        <Body>Considera as leituras até {reportDate(summary.to)}.</Body><Body>{summary.text}</Body></> : null}
    </>}
  </Card>;
}
