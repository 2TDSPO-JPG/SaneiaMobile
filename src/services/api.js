import { readDemo, updateDemo } from '../data/demo-persistence';
import { distanceMeters, eligibilityMessage, occurrenceEligibility, previousOpenReport, reportOrder } from '../report-policy';
import { deleteLocalEquipment, localEquipment, localSensor, saveLocalEquipment } from './demo-equipment';

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const iotUrl = process.env.EXPO_PUBLIC_IOT_URL?.trim().replace(/\/+$/, '');
const iotToken = process.env.EXPO_PUBLIC_IOT_DEMO_TOKEN?.trim();
export const demoMode = !baseUrl;
export const liveIotDemo = demoMode && Boolean(iotUrl);
const demoUsers = [
  { id: 'demo-resident', name: 'Morador', email: 'morador@saneia.test', role: 'resident' },
  { id: 'demo-operator', name: 'Equipe operadora', email: 'operadora@saneia.test', role: 'operator' },
  { id: 'demo-admin', name: 'Administrador', email: 'admin@saneia.test', role: 'admin' },
];
export const demoSession = (role) => ({ token: 'demo', user: demoUsers.find((user) => user.role === role) });

// A ponte Wokwi atual publica apenas o equipamento S07.
const bridgeSensorId = 'S07';

async function request(path, { token, method = 'GET', body, apiUrl = baseUrl } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const form = body instanceof FormData;
    const response = await fetch(`${apiUrl}${path}`, {
      method, signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
      },
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return undefined;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || `Não foi possível concluir a ação (${response.status}).`);
      error.status = liveIotDemo && apiUrl === iotUrl && response.status === 401 ? 403 : response.status;
      if (data?.code === 'REPORT_COOLDOWN') {
        error.code = data.code;
        error.existingReportId = data.existingReportId;
      }
      throw error;
    }
    if (data === null) throw new Error('A API retornou uma resposta inválida.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.');
    if (error instanceof TypeError) throw new Error('Não foi possível conectar à API. Verifique a rede e tente novamente.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const pathFor = (id) => `/reports/${encodeURIComponent(id)}`;
const adminSensorPath = (id) => id ? `/admin/sensors/${encodeURIComponent(id)}` : '/admin/sensors';
const iotRequest = (path, options) => request(path, { ...options, apiUrl: iotUrl, token: iotToken });
const visibleReports = ({ reports }, { user }) => reports
  .filter((report) => !report.deletedAt && (user.role === 'operator' || report.ownerId === user.id)).sort(reportOrder);

function findReport(state, session, id) {
  const report = visibleReports(state, session).find((item) => item.id === id);
  if (!report) throw new Error('Relato não encontrado.');
  return report;
}

function replaceDemoReport(state, report) {
  const reports = state.reports.map((item) => item.id === report.id ? report : item);
  return { state: { ...state, reports }, result: report };
}

function requireAdmin(session) {
  if (session?.user.role !== 'admin') throw new Error('Acesso exclusivo da administração.');
}

function withTelemetry(sensor, telemetry) {
  const { prefix, name, address, neighborhood, postalAddress, coordinate, equipmentType, radiusMeters } = sensor;
  return { ...telemetry, prefix, name, address, neighborhood, postalAddress, coordinate, equipmentType, radiusMeters, liveTelemetry: true };
}

export function nearestSensor(coordinate, sensors) {
  return sensors.map((sensor) => ({ sensor, meters: distanceMeters(coordinate, sensor.coordinate) }))
    .filter(({ sensor, meters }) => meters <= sensor.radiusMeters)
    .sort((a, b) => a.meters - b.meters)[0]?.sensor ?? null;
}

function reportBody({ photo, ...fields }) {
  if (!photo) return fields;
  const form = new FormData();
  form.append('report', JSON.stringify(fields));
  if (photo.file) {
    form.append('photo', photo.file, photo.fileName || 'relato.jpg');
  } else {
    form.append('photo', {
      uri: photo.uri, name: photo.fileName || 'relato.jpg', type: photo.mimeType || 'image/jpeg',
    });
  }
  return form;
}

export const api = {
  async login(input) {
    if (!demoMode) return request('/auth/login', { method: 'POST', body: input });
    const user = demoUsers.find((account) => account.email === input.email);
    if (!user || input.password !== 'Saneia2026!') throw new Error('E-mail ou senha incorretos.');
    return demoSession(user.role);
  },
  async signup(input) {
    if (demoMode) throw new Error('Para entrar no modo local, use uma conta de teste do README.');
    return request('/auth/signup', { method: 'POST', body: input });
  },
  async coverage(session, coordinate) {
    if (!demoMode) {
      const query = `latitude=${encodeURIComponent(coordinate.latitude)}&longitude=${encodeURIComponent(coordinate.longitude)}`;
      return request(`/coverage?${query}`, session);
    }
    const sensor = nearestSensor(coordinate, await localEquipment());
    return { sensorId: sensor?.id ?? null, status: sensor?.status ?? null };
  },
  async listReports(session) {
    return demoMode ? visibleReports(await readDemo(), session) : request('/reports', session);
  },
  async report(session, id) {
    if (!demoMode) return request(pathFor(id), session);
    return findReport(await readDemo(), session, id);
  },
  async saveReport(session, input, id) {
    if (!demoMode) {
      return request(id ? pathFor(id) : '/reports', {
        token: session.token, method: id ? 'PATCH' : 'POST', body: await reportBody(input),
      });
    }
    const coverageSensors = await localEquipment();
    return updateDemo((state) => {
      const old = id ? findReport(state, session, id) : null;
      if (session.user.role !== 'resident' || (old && old.status !== 'received')) {
        throw new Error('O relato já está em atendimento.');
      }
      const openedAt = new Date().toISOString();
      if (!old) {
        const ownReports = state.reports.filter((item) => item.ownerId === session.user.id);
        const eligibility = occurrenceEligibility(ownReports, input, Date.parse(openedAt));
        if (!eligibility.allowed) {
          const error = new Error(eligibilityMessage(eligibility));
          error.code = 'REPORT_COOLDOWN';
          error.existingReportId = eligibility.existingReportId;
          throw error;
        }
      }
      const sequence = state.sequence + Number(!old);
      const { photo, ...fields } = input;
      const changedOccurrence = !old || fields.category !== old.category
        || distanceMeters(fields.coordinate, old.coordinate) > 75;
      const previous = changedOccurrence ? previousOpenReport(visibleReports(state, session)
        .filter((item) => Date.parse(item.createdAt) < Date.parse(old?.createdAt || openedAt)), fields) : null;
      const report = {
        ...(old || { id: `R${sequence}`, protocol: `SAN-${String(sequence).padStart(4, '0')}`,
          ownerId: session.user.id, createdAt: openedAt, status: 'received', resolution: null }),
        ...(changedOccurrence ? { previousReportId: previous?.id ?? null, previousProtocol: previous?.protocol ?? null } : {}),
        ...fields,
        sensorId: nearestSensor(fields.coordinate, coverageSensors)?.id ?? null,
        photoUrl: photo?.uri ?? old?.photoUrl ?? null,
      };
      const reports = old ? state.reports.map((item) => item.id === id ? report : item) : [report, ...state.reports];
      return { state: { ...state, sequence, reports }, result: report };
    });
  },
  async deleteReport(session, id) {
    if (!demoMode) return request(pathFor(id), { token: session.token, method: 'DELETE' });
    return updateDemo((state) => {
      const report = findReport(state, session, id);
      if (session.user.role !== 'resident' || report.status !== 'received') throw new Error('O relato não pode mais ser excluído.');
      const { ownerId, category, coordinate, createdAt } = report;
      const removed = { id, ownerId, category, coordinate, createdAt, deletedAt: new Date().toISOString() };
      return replaceDemoReport(state, removed);
    });
  },
  async addReportUpdate(session, id, { note, photo }) {
    if (!demoMode) return request(`${pathFor(id)}/updates`, {
      token: session.token, method: 'POST', body: reportBody({ note, photo }),
    });
    return updateDemo((state) => {
      const report = state.reports.find((item) => item.id === id && !item.deletedAt && item.ownerId === session.user.id);
      if (session.user.role !== 'resident' || !report || report.status === 'closed') {
        throw new Error('O complemento só pode ser enviado pelo morador em um protocolo em aberto.');
      }
      const detail = note.trim();
      if ((!detail && !photo) || detail.length > 600) throw new Error('Inclua uma foto ou descreva a atualização em até 600 caracteres.');
      if (photo && (!photo.base64 || photo.base64.length > 2_000_000)) {
        throw new Error('A foto é grande demais para salvar na demonstração. Selecione uma foto menor ou envie um texto.');
      }
      const updates = report.updates || [];
      const update = {
        id: `${id}-${updates.length + 1}`, createdAt: new Date().toISOString(), note: detail,
        photoUrl: photo ? `data:image/jpeg;base64,${photo.base64}` : null,
      };
      return replaceDemoReport(state, { ...report, updates: [...updates, update] });
    });
  },
  async updateStatus(session, id, input) {
    if (!demoMode) return request(`${pathFor(id)}/status`, { token: session.token, method: 'PATCH', body: input });
    return updateDemo((state) => {
      const report = findReport(state, session, id);
      if (session.user.role !== 'operator' || report.status === 'closed') throw new Error('Este atendimento já foi encerrado.');
      return replaceDemoReport(state, { ...report, ...input });
    });
  },
  async requestAssessment(session, id, note) {
    if (!demoMode) return request(`${pathFor(id)}/assessment`, { token: session.token, method: 'POST', body: { note } });
    if (session.user.role !== 'operator') throw new Error('A avaliação é registrada pela operadora.');
    const detail = note.trim();
    return updateDemo((state) => {
      const report = state.reports.find((item) => item.id === id && !item.deletedAt);
      if (!report || report.status === 'closed') throw new Error('Selecione um protocolo em aberto para solicitar uma avaliação.');
      if (report.assessment) throw new Error('Já existe uma avaliação solicitada para este protocolo.');
      if (!detail || detail.length > 600) throw new Error('Informe o motivo da avaliação em até 600 caracteres.');
      return replaceDemoReport(state, { ...report, assessment: { note: detail, requestedAt: new Date().toISOString() } });
    });
  },
  async sensors(session) {
    if (!demoMode) return request('/sensors', session);
    const sensors = await localEquipment();
    if (!liveIotDemo || !sensors.some((sensor) => sensor.id === bridgeSensorId)) return sensors;
    const live = await iotRequest('/sensors');
    return sensors.map((sensor) => {
      const telemetry = live.find((item) => item.id === sensor.id);
      return telemetry ? withTelemetry(sensor, telemetry) : sensor;
    });
  },
  sensorInsights(session, id, range) {
    const path = `/sensors/${encodeURIComponent(id)}/insights`;
    if (liveIotDemo) return iotRequest(path, { method: 'POST', body: range });
    return request(path, { token: session.token, method: 'POST', body: range });
  },
  async sensor(session, id) {
    const path = `/sensors/${encodeURIComponent(id)}`;
    if (!demoMode) return request(path, session);
    const sensor = await localSensor(id);
    return liveIotDemo && id === bridgeSensorId ? withTelemetry(sensor, await iotRequest(path)) : sensor;
  },
  async adminUsers(session) {
    requireAdmin(session);
    return demoMode ? demoUsers : request('/admin/users', session);
  },
  async adminEquipment(session) {
    requireAdmin(session);
    return demoMode ? localEquipment() : request(adminSensorPath(), session);
  },
  async adminSensor(session, id) {
    requireAdmin(session);
    return demoMode ? localSensor(id) : request(adminSensorPath(id), session);
  },
  async saveEquipment(session, input, id) {
    requireAdmin(session);
    if (demoMode) return saveLocalEquipment(input, id);
    return request(adminSensorPath(id), { token: session.token, method: id ? 'PATCH' : 'POST', body: input });
  },
  async deleteEquipment(session, id) {
    requireAdmin(session);
    if (demoMode) return deleteLocalEquipment(id);
    return request(adminSensorPath(id), { token: session.token, method: 'DELETE' });
  },
};
