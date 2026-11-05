export const colors = {
  ink: '#132E36', primary: '#007665', mint: '#A4EBD3', surface: '#FFFFFF',
  canvas: '#F1F6F4', muted: '#48656B', line: '#D7E5E0', soft: '#E0F2EC',
  danger: '#A53329', dangerBg: '#FBECE9', blue: '#1E617C', blueBg: '#E7F2F8',
  grayBg: '#E9EFEE', warning: '#8A5700', warningBg: '#FFF1BF',
};

export const reportStatus = {
  received: { label: 'Recebido', tone: 'blue' },
  in_progress: { label: 'Em atendimento', tone: 'green' },
  closed: { label: 'Encerrado', tone: 'neutral' },
};

export const sensorStatus = {
  normal: { label: 'OK', tone: 'green' },
  alarm: { label: 'Alarme', tone: 'red' },
  warning: { label: 'Alerta', tone: 'yellow' },
  offline: { label: 'Sem comunicação', tone: 'neutral' },
};

export function equipmentStatus(sensor) {
  if (sensor.status !== 'priority') return sensor.status;
  return sensor.volume != null && sensor.limit != null && sensor.volume >= sensor.limit ? 'alarm' : 'warning';
}

export const areaName = (item) => item.neighborhood?.trim() || 'Bairro não informado';
export const areaKey = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const categories = ['Retorno de esgoto', 'Vazamento', 'Mau cheiro', 'Outro problema'];
export const liters = (value) => value == null ? '—' : `${new Intl.NumberFormat('pt-BR').format(value)} L`;
export const dateTime = (value) => value ? new Date(value).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : 'Sem leitura';
export const reportDate = (value) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Data não informada';
