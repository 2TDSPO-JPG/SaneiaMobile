const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

function readCep(value) {
  const text = value.trim();
  if (!/^\d{5}-?\d{3}$/.test(text)) throw new Error('Informe um CEP de 8 dígitos.');
  return text.replace('-', '');
}

export async function lookupCep(value) {
  const cep = readCep(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let result;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
    if (!response.ok) throw new Error();
    result = await response.json();
    if (!result || typeof result !== 'object') throw new Error();
  } catch {
    throw new Error('A busca por CEP está indisponível. Você pode preencher o endereço manualmente.');
  } finally {
    clearTimeout(timeout);
  }
  if (result.erro) throw new Error('CEP não encontrado. Confira os dígitos e tente novamente.');
  return { cep: `${cep.slice(0, 5)}-${cep.slice(5)}`, street: result.logradouro || '',
    neighborhood: result.bairro || '', city: result.localidade || '', state: result.uf || '' };
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
