import { demoSensors } from '../data/demo';
import { readDemo, updateDemo } from '../data/demo-persistence';

const catalog = (state) => state.sensors ?? demoSensors;

export async function localEquipment() {
  return catalog(await readDemo());
}

export async function localSensor(id) {
  const sensor = (await localEquipment()).find((item) => item.id === id);
  if (!sensor) throw new Error('Equipamento não encontrado.');
  return sensor;
}

export function saveLocalEquipment(input, id) {
  return updateDemo((state) => {
    const sensors = catalog(state);
    const previous = id ? sensors.find((sensor) => sensor.id === id) : null;
    if (id && !previous) throw new Error('Equipamento não encontrado.');
    if (sensors.some((sensor) => sensor.id !== id && sensor.prefix.toUpperCase() === input.prefix)) {
      throw new Error('Já existe um equipamento com esse prefixo.');
    }
    const sequence = (state.sensorSequence ?? 0) + Number(!previous);
    const { simulatedVolume, ...fields } = input;
    const status = simulatedVolume == null ? 'offline' : simulatedVolume >= fields.limit ? 'alarm'
      : simulatedVolume >= fields.limit * 0.85 ? 'warning' : 'normal';
    const changedReading = simulatedVolume != null && (simulatedVolume !== previous?.volume
      || status !== previous?.status || fields.capacity !== previous.capacity || fields.limit !== previous.limit);
    const at = new Date().toISOString();
    const sensorId = previous?.id ?? `demo-sensor-${sequence}`;
    const source = 'Cadastro local';
    const samples = previous?.samples ?? [];
    const readings = previous?.readings ?? [];
    const events = previous?.events ?? [];
    const result = {
      ...previous, ...fields, id: sensorId, source, status,
      volume: simulatedVolume ?? previous?.volume ?? null,
      lastReadingAt: changedReading ? at : previous?.lastReadingAt ?? null,
      etaHours: changedReading || status === 'offline' ? null : previous?.etaHours ?? null,
      reason: status === 'offline' ? 'Aguardando a primeira leitura do equipamento.' : null,
      alarmsSixMonths: (previous?.alarmsSixMonths ?? 0) + Number(status === 'alarm' && previous?.status !== 'alarm'),
      samples: changedReading ? [...samples, {
        id: `${sensorId}-${samples.length + 1}-${at}`, at, volume: simulatedVolume, status,
        capacity: fields.capacity, limit: fields.limit, source,
      }] : samples,
      readings: changedReading ? [...readings, simulatedVolume] : readings,
      events: status !== previous?.status ? [...events, {
        id: `${sensorId}-event-${events.length + 1}`, status, at, message: 'Situação atualizada.',
      }] : events,
    };
    const next = previous ? sensors.map((sensor) => sensor.id === id ? result : sensor) : [...sensors, result];
    return { state: { ...state, sensorSequence: sequence, sensors: next }, result };
  });
}

export function deleteLocalEquipment(id) {
  return updateDemo((state) => {
    const sensors = catalog(state);
    if (!sensors.some((sensor) => sensor.id === id)) throw new Error('Equipamento não encontrado.');
    return { state: { ...state, sensors: sensors.filter((sensor) => sensor.id !== id) } };
  });
}
