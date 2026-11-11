# Contrato das APIs Java e .NET

As rotas abaixo são relativas à base de cada serviço. O Java autentica e emite a sessão. As APIs recebem `Authorization: Bearer <token>` nas rotas protegidas e validam autenticação e papel. O Java também verifica a propriedade dos relatos. Erros retornam JSON com `message`. O app usa `EXPO_PUBLIC_API_URL` para o Java e `EXPO_PUBLIC_MONITORING_API_URL` para as duas consultas .NET. Se a segunda URL estiver vazia, o app consulta o monitoramento no Java. Veja o [README](../README.md).

## Java — rotas para o mobile

| Método e rota | Entrada | Saída |
| --- | --- | --- |
| POST /auth/signup | name, email, password | Session. Cadastro público cria morador. |
| POST /auth/login | email, password | Session |
| POST /sensors/{id}/insights | period, from, to | Insights do equipamento para a operadora |
| GET /reports | — | Report[]. Morador vê os próprios relatos. |
| GET /reports/{id} | — | Report |
| POST /reports | Campos de ReportInput | Report, com protocolo gerado no servidor |
| PATCH /reports/{id} | Campos de ReportInput | Report atualizado |
| DELETE /reports/{id} | — | 204 sem corpo |
| PATCH /reports/{id}/status | status, resolution, progressNote | Report atualizado |
| POST /reports/{id}/updates | note e/ou photo | Report atualizado com o complemento |
| POST /reports/{id}/assessment | note | Report atualizado com assessment |
| GET /coverage?latitude=…&longitude=… | Coordenadas | { sensorId, status }. Sem cobertura, ambos null. Com cobertura e sem estado disponível, status pode ser null. |
| GET /admin/users | — | User[] com id, name, email e role |
| GET /admin/sensors | — | Sensor[] com os equipamentos ativos |
| GET /admin/sensors/{id} | — | Sensor |
| POST /admin/sensors | SensorInput | Sensor criado |
| PATCH /admin/sensors/{id} | SensorInput | Sensor atualizado |
| DELETE /admin/sensors/{id} | — | 204 sem corpo |

As listas paginadas do Java retornam arrays JSON, recebem `page` e `size` e informam o total de páginas no cabeçalho `X-Total-Pages`. O backend expõe esse cabeçalho via CORS.

## .NET — rotas para o mobile

| Método e rota | Entrada | Saída |
| --- | --- | --- |
| GET /sensors | page a partir de 0, size de 1 a 200 | Sensor[] com os equipamentos ativos e cabeçalho `X-Total-Pages` |
| GET /sensors/{id} | — | Sensor com histórico, para a ficha do equipamento |

O monitoramento exige o papel `operator`. O .NET monta as respostas com dados do catálogo Java e da telemetria em SQLite no perfil Development ou Oracle no ambiente configurado. Um equipamento recém-cadastrado tem `status: "offline"`, `volume: null`, `lastReadingAt: null` e histórico vazio. O endpoint `POST /sensors/{id}/readings` registra medições de teste via Swagger ou cliente HTTP, usando a sessão da operadora. O app apenas consulta o .NET.

### Análise com Spring AI no Java

`POST /sensors/{id}/insights` é consumido na base Java com o mesmo token da operadora e recebe `period`, `from` e `to`. Retorna `summary`, `aiGenerated`, `telemetrySource` e os indicadores calculados. Com `DOTNET_TELEMETRY_URL` configurada no Java, os indicadores vêm do .NET para o período solicitado. O Spring AI permanece no Java.

### Comunicação entre as APIs

- O Java atual emite JWT HS256 com emissor `saneia-api`, claim `role` e sem audiência. O .NET usa `Jwt__SharedSecret` com o mesmo valor de `JWT_SECRET` do Java e valida assinatura, emissor, identificador, expiração e papel. O segredo é configurado somente nos servidores. A aplicação faz um único login.
- O .NET encaminha o token da operadora ao consultar `GET /sensors` e `GET /sensors/{id}` no Java. Para receber MQTT, consulta `GET /internal/catalog/sensors/by-prefix/{prefix}` com `X-Saneia-Integration-Key`. O mesmo `id` do catálogo identifica o equipamento no monitoramento e no vínculo do relato.
- O Java consulta `GET /internal/telemetry/sensors/{id}/summary` no .NET com a mesma credencial de integração. O resumo aplica os limites `from` e `to` e agrega os dados no banco .NET. A chave fica nas variáveis dos servidores.
- O Java é responsável pelas tabelas de usuários, equipamentos e relatos. O .NET é responsável pelas tabelas de medições e eventos. No IoT, identifique o dispositivo no catálogo e grave cada `sampleId` uma vez por dispositivo. A retirada de um equipamento afeta as consultas ao catálogo ativo e preserva o histórico.

## Formatos e regras de negócio

- **Session** contém `token` e `user: { id, name, email, role }`, com papel `resident`, `operator` ou `admin`.
- **ReportInput** contém `category`, `description`, `address`, `neighborhood` e `coordinate: { latitude, longitude }`. O app usa JSON sem foto. Com foto, usa multipart com a parte textual `report` contendo o JSON e a parte binária `photo`. Em edição, a ausência de uma nova foto mantém a anterior.
- **Report** contém os campos de ReportInput mais `id`, `protocol`, `status`, `createdAt`, `photoUrl`, `sensorId` e `resolution`. As três últimas propriedades aceitam null. A foto deve usar URL acessível ao destinatário autorizado, por exemplo, URL assinada.
- **Sensor** inclui `id`, `prefix`, `name`, `address`, `neighborhood`, `coordinate`, `status`, `capacity`, `limit`, `volume`, `lastReadingAt`, `etaHours`, `alarmsSixMonths` e `readings`. `summary`, `reason` e `events: [{ id, status, at, message }]` são opcionais. Volumes são em litros, datas em ISO 8601 e `readings` é uma lista de volumes em ordem cronológica. Estados: `normal` (OK), `warning` (alerta), `alarm` (limite atingido) e `offline`.
- **Ficha do equipamento** pode incluir `equipmentType`, `source`, `expectedIntervalMinutes` e `radiusMeters`. Para abrir o detalhe de cada barra, prefira `samples: [{ id, at, volume, levelCm, status, capacity, limit, source, note }]`. Cada amostra tem identificador, horário ISO 8601 e volume. Nível em centímetros, estado naquele momento, capacidade e limite vigentes na leitura, origem e observação são opcionais. Com apenas `readings`, o app mostra os volumes e as variações sem atribuir datas ou estados históricos.
- **Insights** usam `period` (`today`, `7d`, `30d`, `90d` ou `all`) e limites inclusivos em ISO 8601. O filtro Hoje começa à meia-noite no fuso do dispositivo. Para `all`, `from` é omitido. O Java autoriza o acesso ao equipamento, calcula os indicadores e usa Spring AI com Gemini. A chave fica no servidor. Os estados do equipamento seguem as regras da telemetria.

O morador edita ou exclui apenas os próprios relatos em `received`. A operadora avança para `in_progress` e encerra com `closed` e um desfecho. A mudança do estado do sensor não encerra protocolos. A cobertura por raio indica um sensor candidato e o vínculo final pode ser revisado pela operadora em uma próxima etapa.

A operadora pode registrar uma solicitação de avaliação técnica por protocolo aberto, com motivo de 1 a 600 caracteres. A API registra `assessment: { requestedAt, note }`, com data ISO 8601 gerada no servidor. A ausência de equipamento próximo não cria uma solicitação automaticamente. O registro permanece vinculado ao relato original e o campo `assessment` deve ser retornado somente à operadora.

O servidor deve verificar o intervalo de 20 dias na mesma transação da criação. A regra compara protocolos do mesmo morador, da mesma categoria e a até 75 m. Protocolos encerrados não bloqueiam novas ocorrências. A exclusão deve ocultar o protocolo e manter os dados mínimos da abertura para a regra. Dentro do intervalo, responda 409 com `code: REPORT_COOLDOWN`, `message` contendo a data de liberação e `existingReportId` se houver protocolo aberto que possa ser complementado. Passado o prazo, vincule um protocolo anterior ainda aberto via `previousReportId` e `previousProtocol`. A operadora pode informar `progressNote` sem alterar o status.

O morador pode complementar seus protocolos em aberto sem esperar 20 dias. A operação é aditiva e não altera a data de abertura nem o status. Recebe JSON com `note` de até 600 caracteres ou multipart com parte textual `report` contendo o JSON e parte binária `photo`. Exige pelo menos um dos dois. O retorno de detalhe do protocolo inclui `updates: [{ id, createdAt, note, photoUrl }]` para o dono e a operadora.

## Administração

As rotas `/admin/*` exigem o papel `admin` validado no Spring Boot. Retorne 401 para sessão ausente ou inválida e 403 para uma conta autenticada sem permissão. A conta administrativa é provisionada no servidor. O cadastro público cria apenas moradores. A lista de usuários retorna somente `id`, `name`, `email` e `role`.

**SensorInput** contém `prefix`, `name`, `equipmentType`, `address`, `neighborhood`, `postalAddress`, `coordinate: { latitude, longitude }`, `capacity`, `limit` e `radiusMeters`. O prefixo tem de 2 a 30 caracteres e deve ser único sem distinção de maiúsculas e minúsculas. Use 409 com `message` para prefixo duplicado. A capacidade e o limite são em litros, com `0 < limit <= capacity`. O raio é positivo e medido em metros. Latitude e longitude são números nos intervalos de -90 a 90 e -180 a 180, respectivamente.

**PostalAddress** contém `cep` (texto de oito dígitos, preservando zeros iniciais), `street`, `number` (texto, aceita `S/N`), `neighborhood`, `city`, `state` (UF com duas letras) e `complement` (texto ou `null`). Exija o objeto na criação e na alteração de endereço. Edições de equipamentos legados podem preservar o endereço livre existente enquanto `postalAddress` estiver ausente. `address` continua sendo o endereço formatado para exibição, e `neighborhood` continua disponível no nível principal para os filtros. Inclua os três campos nas respostas do catálogo administrativo e do monitoramento. O app consulta a BrasilAPI para endereço e coordenadas aproximadas e usa o ViaCEP como alternativa para o endereço. O app envia as coordenadas em `coordinate`, seja pela busca do CEP, pelo GPS ou pelo ajuste manual.

O cliente envia `postalAddress` no cadastro e na edição. O Java persiste o objeto, normaliza o CEP e a UF e o devolve nas consultas. O .NET repassa esses campos do catálogo Java. O número aceita até 10 caracteres, o complemento até 80 e o endereço formatado até 200. Erros de validação trazem `errors[].field` e `errors[].message` para exibição no formulário. O Java exige o objeto nos novos cadastros com `SANEIA_REQUIRE_POSTAL_ADDRESS=true`.

A operadora usa `GET /reports` no Java e `GET /sensors` no .NET para pesquisar endereços, bairros, cidades e CEPs na lista e na tela do bairro. O app vincula as informações pelo `sensorId` do relato. Endereços de relatos sem equipamento continuam pesquisáveis pelo texto informado pelo morador.

O Java gera um `id` estável e a edição atualiza apenas os campos do catálogo. A exclusão retira o equipamento do catálogo, do mapa e da busca de cobertura, preservando as leituras e o vínculo de protocolos existentes. O .NET consulta o mesmo catálogo ativo para exibir o monitoramento da operadora.
