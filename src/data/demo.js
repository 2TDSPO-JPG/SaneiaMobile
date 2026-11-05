const time = (hoursAgo) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
const historicalVolumes = [[120, 0.44], [52, 0.94], [25, 0.91], [14, 0.70], [5, 0.96], [2, 0.82]];

function demoSample(sensor, id, at, volume, status) {
  return {
    id: `${sensor.id}-${id}`, at, volume,
    levelCm: Math.round(volume / sensor.capacity * 2000) / 10,
    capacity: sensor.capacity, limit: sensor.limit,
    status: volume >= sensor.limit ? 'alarm' : status,
    source: 'Dados de demonstração',
  };
}
export const demoCenter = { latitude: -23.5515, longitude: -46.6357 };
export const demoSensors = [
  { id: 'S07', prefix: 'RES-07', name: 'Reservatório 07', neighborhood: 'Setor Norte', address: 'Setor Norte · ponto 07', coordinate: { latitude: -23.5492, longitude: -46.637 }, status: 'warning', capacity: 2000, limit: 1800, volume: 1600, lastReadingAt: time(0.05), etaHours: 8, radiusMeters: 220, reason: 'Previsão dentro da janela de atendimento', alarmsSixMonths: 3, readings: [1430, 1465, 1510, 1550, 1600], events: [{ status: 'warning', at: time(0.5), message: 'Previsão de atingir o limite em 8 horas.' }] },
  { id: 'S09', prefix: 'RES-09', name: 'Reservatório 09', neighborhood: 'Setor Norte', address: 'Setor Norte · ponto 09', coordinate: { latitude: -23.5504, longitude: -46.6318 }, status: 'alarm', capacity: 2000, limit: 1800, volume: 1880, lastReadingAt: time(0.05), etaHours: null, radiusMeters: 220, reason: 'Limite operacional atingido', alarmsSixMonths: 2, readings: [1540, 1660, 1740, 1810, 1880], events: [{ status: 'alarm', at: time(0.3), message: 'O volume ultrapassou 1.800 L.' }] },
  { id: 'S12', prefix: 'RES-12', name: 'Reservatório 12', neighborhood: 'Setor Central', address: 'Setor Central · ponto 12', coordinate: { latitude: -23.5521, longitude: -46.6336 }, status: 'normal', capacity: 1500, limit: 1250, volume: 650, lastReadingAt: time(0.03), etaHours: null, radiusMeters: 210, alarmsSixMonths: 1, readings: [440, 490, 530, 610, 650] },
  { id: 'S19', prefix: 'RES-19', name: 'Reservatório 19', neighborhood: 'Setor Sul', address: 'Setor Sul · ponto 19', coordinate: { latitude: -23.554, longitude: -46.6364 }, status: 'offline', capacity: 2200, limit: 1950, volume: 720, lastReadingAt: time(11), etaHours: null, radiusMeters: 200, alarmsSixMonths: 0, readings: [600, 625, 660, 690, 720], events: [{ status: 'offline', at: time(10), message: 'O equipamento deixou de enviar leituras.' }] },
].map((sensor) => ({
  ...sensor,
  equipmentType: 'Reservatório com sensor de nível',
  source: 'Dados de demonstração',
  expectedIntervalMinutes: 30,
  samples: [
    ...historicalVolumes.map(([days, fraction]) => demoSample(sensor, `d${days}`, time(days * 24), Math.round(sensor.capacity * fraction), 'normal')),
    ...sensor.readings.map((volume, index, readings) => demoSample(sensor, index + 1,
      new Date(Date.parse(sensor.lastReadingAt) - (readings.length - 1 - index) * 30 * 60_000).toISOString(), volume,
      sensor.status === 'warning' && index === readings.length - 1 ? 'warning' : 'normal')),
  ],
}));

export const demoReports = [
  { id: 'R1', protocol: 'SAN-0001', ownerId: 'demo-resident', category: 'Vazamento', neighborhood: 'Setor Leste', description: 'Há água com cheiro forte saindo na calçada, perto do ponto de ônibus.', address: 'Setor Leste · próximo ao ponto de ônibus', coordinate: { latitude: -23.5514, longitude: -46.6309 }, status: 'received', createdAt: time(30 * 24), photoUrl: null, sensorId: null, resolution: null },
  { id: 'R2', protocol: 'SAN-0002', ownerId: 'demo-resident', category: 'Mau cheiro', neighborhood: 'Setor Norte', description: 'O cheiro aparece à tarde perto da entrada da viela.', address: 'Setor Norte · entrada da viela', coordinate: { latitude: -23.5495, longitude: -46.6373 }, status: 'in_progress', createdAt: time(21 * 24), photoUrl: null, sensorId: 'S07', resolution: null, progressNote: 'A equipe aguarda a próxima vistoria no local.' },
];
