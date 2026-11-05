# Contrato inicial com o Spring Boot

O prefixo da API pode fazer parte de `EXPO_PUBLIC_API_URL` (por exemplo, `http://192.168.1.20:8080/api`). Rotas protegidas recebem `Authorization: Bearer <token>`. O servidor valida autenticação, papel e propriedade. Erros retornam JSON com `message`.

| Método e rota | Entrada | Saída |
| --- | --- | --- |
| POST /auth/signup | name, email, password | Session. Cadastro público cria morador. |
| POST /auth/login | email, password | Session |
| GET /reports | — | Report[]. Morador vê os próprios relatos. |
| GET /reports/{id} | — | Report |
| POST /reports | Campos de ReportInput | Report, com protocolo gerado no servidor |
| PATCH /reports/{id} | Campos de ReportInput | Report atualizado |
| DELETE /reports/{id} | — | 204 sem corpo |
| PATCH /reports/{id}/status | status, resolution, progressNote | Report atualizado |
| POST /reports/{id}/updates | note e/ou photo | Report atualizado com o complemento |
| POST /reports/{id}/assessment | note | Report atualizado com assessment |
| GET /coverage?latitude=…&longitude=… | Coordenadas | { sensorId, status } ou ambos null |
| GET /sensors | — | Sensor[] |
| GET /sensors/{id} | — | Sensor |
| POST /sensors/{id}/insights | period, from, to | { summary } com análise textual |

- **Session** contém `token` e `user: { id, name, email, role }`, com papel `resident` ou `operator`.
- **ReportInput** contém `category`, `description`, `address`, `neighborhood` e `coordinate: { latitude, longitude }`. O app usa JSON sem foto. Com foto, usa multipart com a parte textual `report` contendo o JSON e a parte binária `photo`. Em edição, a ausência de uma nova foto mantém a anterior.
- **Report** contém os campos de ReportInput mais `id`, `protocol`, `status`, `createdAt`, `photoUrl`, `sensorId` e `resolution`. As três últimas propriedades aceitam null. A foto deve usar URL acessível ao destinatário autorizado, por exemplo, URL assinada.
- **Sensor** inclui `id`, `prefix`, `name`, `address`, `neighborhood`, `coordinate`, `status`, `capacity`, `limit`, `volume`, `lastReadingAt`, `etaHours`, `alarmsSixMonths` e `readings`. `summary`, `reason` e `events: [{ id, status, at, message }]` são opcionais. Volumes são em litros, datas em ISO 8601 e `readings` é uma lista de volumes em ordem cronológica. Estados: `normal` (OK), `warning` (alerta), `alarm` (limite atingido) e `offline`.
- **Ficha do equipamento** pode incluir `equipmentType`, `source`, `expectedIntervalMinutes` e `radiusMeters`. Para abrir o detalhe de cada barra, prefira `samples: [{ id, at, volume, levelCm, status, capacity, limit, source, note }]`. Cada amostra tem identificador, horário ISO 8601 e volume. Nível em centímetros, estado naquele momento, capacidade e limite vigentes na leitura, origem e observação são opcionais. Com apenas `readings`, o app mostra os volumes e as variações sem atribuir datas ou estados históricos.
- **Insights** usam `period` (`today`, `7d`, `30d`, `90d` ou `all`) e limites inclusivos em ISO 8601. O filtro Hoje começa à meia-noite no fuso do dispositivo. Para `all`, `from` é omitido. O Spring Boot deve autorizar o acesso ao equipamento, buscar as medições no Oracle, calcular os indicadores e usar o LLM para resumir esses dados e suas limitações. O modelo não define alarmes nem substitui as medições. O app não envia uma chave de IA nem solicita IA no modo demonstração.

O morador edita ou exclui apenas os próprios relatos em `received`. A operadora avança para `in_progress` e encerra com `closed` e um desfecho. A mudança do estado do sensor não encerra protocolos. A cobertura por raio indica um sensor candidato e o vínculo final pode ser revisado pela operadora em uma próxima etapa.

A operadora pode registrar uma solicitação de avaliação técnica por protocolo aberto, com motivo de 1 a 600 caracteres. A API registra `assessment: { requestedAt, note }`, com data ISO 8601 gerada no servidor. A ausência de equipamento próximo não cria uma solicitação automaticamente. O registro permanece vinculado ao relato original e o campo `assessment` deve ser retornado somente à operadora.

O servidor deve verificar o intervalo de 20 dias na mesma transação da criação. A regra compara protocolos do mesmo morador, da mesma categoria e a até 75 m. Protocolos encerrados não bloqueiam novas ocorrências. A exclusão deve ocultar o protocolo e manter os dados mínimos da abertura para a regra. Dentro do intervalo, responda 409 com `code: REPORT_COOLDOWN`, `message` contendo a data de liberação e `existingReportId` se houver protocolo aberto que possa ser complementado. Passado o prazo, vincule um protocolo anterior ainda aberto via `previousReportId` e `previousProtocol`. A operadora pode informar `progressNote` sem alterar o status.

O morador pode complementar seus protocolos em aberto sem esperar 20 dias. A operação é aditiva e não altera a data de abertura nem o status. Recebe JSON com `note` de até 600 caracteres ou multipart com parte textual `report` contendo o JSON e parte binária `photo`. Exige pelo menos um dos dois. O retorno de detalhe do protocolo inclui `updates: [{ id, createdAt, note, photoUrl }]` para o dono e a operadora.
