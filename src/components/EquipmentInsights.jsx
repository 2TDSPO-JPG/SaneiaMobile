import { useState } from 'react';
import { Text } from 'react-native';
import { api, demoMode } from '../services/api';
import { useErrorText } from '../session';
import { liters, reportDate } from '../theme';
import { Body, Button, Card, Notice, styles } from '../ui';

export function EquipmentInsights({ sensor, readings, range }) {
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
      const result = await api.sensorInsights(sensor.id, range);
      if (typeof result.summary !== 'string' || !result.summary.trim()) {
        throw new Error('A API não retornou uma análise para este período.');
      }
      setSummary({ text: result.summary.trim(), to: range.to });
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
      {!sensor.liveTelemetry ? <Body>{demoMode
        ? 'Estes indicadores usam dados de exemplo. A análise do Gemini está disponível em equipamentos conectados à ponte IoT.'
        : 'A análise com IA será disponibilizada pela API .NET.'}</Body>
        : <Button secondary title={summary ? 'Atualizar análise com IA' : 'Gerar análise com IA'}
          icon="activity" onPress={analyze} busy={busy} disabled={dated.length === 0} />}
      <Notice error text={error} />
      {summary ? <><Text style={styles.section}>Análise por IA</Text>
        <Body>Considera as leituras até {reportDate(summary.to)}.</Body><Body>{summary.text}</Body></> : null}
    </>}
  </Card>;
}
