const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

function readCep(value) {
  const text = value.trim();
  if (!/^\d{5}-?\d{3}$/.test(text)) throw new Error('Informe um CEP de 8 dígitos.');
  return text.replace('-', '');
}

async function fetchPostalJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const result = await response.json();
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function postalCoordinate(point) {
  const read = (value) => typeof value === 'number' || (typeof value === 'string' && value.trim())
    ? Number(value) : NaN;
  const latitude = read(point?.latitude);
  const longitude = read(point?.longitude);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0)
    ? { latitude, longitude } : null;
}

export async function lookupCep(value) {
  const digits = readCep(value);
  const cep = `${digits.slice(0, 5)}-${digits.slice(5)}`;
  const primary = await fetchPostalJson(`https://brasilapi.com.br/api/cep/v2/${digits}`);
  if (primary?.cep === digits) {
    return { cep, street: primary.street || '', neighborhood: primary.neighborhood || '',
      city: primary.city || '', state: primary.state || '', coordinate: postalCoordinate(primary.location?.coordinates) };
  }
  const result = await fetchPostalJson(`https://viacep.com.br/ws/${digits}/json/`);
  if (!result) throw new Error('A busca por CEP está indisponível. Você pode preencher o endereço manualmente.');
  if (result.erro) throw new Error('CEP não encontrado. Confira os dígitos e tente novamente.');
  return { cep, street: result.logradouro || '', neighborhood: result.bairro || '',
    city: result.localidade || '', state: result.uf || '', coordinate: null };
}

export function equipmentAddress(fields, sensor) {
  const neighborhood = fields.neighborhood.trim();
  const { cep, street, number, city, state, complement } = fields;
  // Equipamentos antigos podem conservar o endereço livre até serem atualizados.
  if (sensor.id && !sensor.postalAddress && ![cep, street, number, city, state, complement].some((value) => value.trim())) {
    if (!neighborhood) throw new Error('Informe o bairro ou região.');
    return { address: sensor.address, neighborhood };
  }
  const postalAddress = { cep: readCep(cep), street: street.trim(), number: number.trim(), neighborhood,
    city: city.trim(), state: state.trim().toUpperCase(), complement: complement.trim() || null };
  if (!postalAddress.street || !postalAddress.number || !neighborhood || !postalAddress.city) {
    throw new Error('Preencha logradouro, número, bairro e cidade. Use S/N quando o local não tiver número.');
  }
  if (!states.includes(postalAddress.state)) throw new Error('Informe uma UF válida, por exemplo SP.');
  const { cep: digits, street: streetName, number: streetNumber, city: cityName, state: uf } = postalAddress;
  const streetAddress = [streetName, streetNumber, postalAddress.complement].filter(Boolean).join(', ');
  return { neighborhood, postalAddress,
    address: `${streetAddress} · ${neighborhood} · ${cityName}/${uf} · CEP ${digits.slice(0, 5)}-${digits.slice(5)}` };
}
