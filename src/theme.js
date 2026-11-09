export const colors = {
  ink: '#192E2B', primary: '#17694F', mint: '#BEE3CF', surface: '#FFFFFF',
  canvas: '#F5F7F6', muted: '#63716C', line: '#DFE6E2', soft: '#EAF3ED',
  danger: '#B34438', dangerBg: '#FBEFEC', blue: '#366582', blueBg: '#ECF3F8',
  grayBg: '#EDF0EE', warning: '#93631B', warningBg: '#FCF4E4',
};

export const roleLabels = {
  resident: 'Morador',
  operator: 'Operadora de saneamento',
  admin: 'Administrador',
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
