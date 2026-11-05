const interval = 20 * 24 * 60 * 60 * 1000;

export function reportEligibility(lastOpenedAt, now = Date.now()) {
  const next = new Date(lastOpenedAt).getTime() + interval;
  return next > now ? { allowed: false, nextEligibleAt: new Date(next).toISOString() }
    : { allowed: true, nextEligibleAt: null };
}

export function distanceMeters(from, to) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const angle = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude))
    * Math.cos(rad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, angle)));
}

function matchesOccurrence(item, input) {
  return item.category === input.category && item.coordinate && input.coordinate
    && distanceMeters(input.coordinate, item.coordinate) <= 75;
}

export function previousOpenReport(reports, input) {
  if (!input.coordinate) return null;
  return reports.filter((item) => !item.deletedAt && item.status !== 'closed' && matchesOccurrence(item, input))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

export function occurrenceEligibility(reports, input, now = Date.now()) {
  const latest = reports.filter((item) => item.status !== 'closed' && matchesOccurrence(item, input))
    .reduce((match, item) => !match || Date.parse(item.createdAt) > Date.parse(match.createdAt) ? item : match, null);
  return { ...reportEligibility(latest?.createdAt, now), existingReportId: previousOpenReport(reports, input)?.id ?? null };
}

export function reportOrder(a, b) {
  const priority = (item) => Number(item.status !== 'closed' && Boolean(item.previousReportId));
  return priority(b) - priority(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function eligibilityMessage(eligibility) {
  const date = new Date(eligibility.nextEligibleAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `Um novo protocolo para este problema e local poderá ser aberto em ${date}. Você pode complementar um protocolo em aberto sem esperar.`;
}
