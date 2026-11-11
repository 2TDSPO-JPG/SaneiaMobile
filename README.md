# Saneia Mobile

O Saneia recebe relatos de saneamento dos moradores, organiza o atendimento da operadora e permite que a administração gerencie o catálogo de equipamentos. O app usa React Native, Expo SDK 58 e Expo Router, com AsyncStorage no modo local. O fluxo conectado usa **Java (Spring Boot)** para atendimento e cadastro e **.NET (ASP.NET Core)** para monitoramento.

## Interface e acesso

O fluxo principal usa autenticação na API Java. A página de acesso tem login e cadastro de morador. Cada perfil recebe sua própria navegação, com menu lateral em telas maiores e navegação inferior no celular.

A visão geral mostra os totais retornados pela API, os equipamentos que precisam de atenção e os últimos relatos. O cadastro administrativo usa CEP para preencher endereço e localização. As coordenadas podem ser ajustadas, e o volume é recebido pelo monitoramento. O mapa web usa Leaflet com base OpenStreetMap e os mapas nativos continuam disponíveis no Android e no iOS. A base cartográfica e a busca de CEP exigem conexão com a internet.

Para usar a API local com um catálogo vazio, configure `SEED_DEMO_DATA=false` no processo Java antes de iniciá-lo. Essa configuração mantém as contas provisionadas e permite cadastrar os equipamentos e relatos pelo aplicativo.

## Quem implementa o quê

| API | Responsabilidade | Rotas consumidas pelo mobile |
| --- | --- | --- |
| **Java** | Contas e permissões, cadastro de equipamentos, cobertura, relatos e análise com Spring AI. | `POST /auth/login`, `POST /auth/signup`, `GET /admin/users`, CRUD em `/admin/sensors`, `GET /coverage`, rotas de `/reports` e `POST /sensors/{id}/insights` |
| **.NET** | Monitoramento da operadora. Junta o catálogo do Java com o último estado, o volume, o histórico e os eventos de cada equipamento. | `GET /sensors` e `GET /sensors/{id}` |

### Java — negócio e administração

1. Autenticar e cadastrar moradores, listar usuários para o administrador e aplicar as permissões dos três perfis.
2. Manter o catálogo oficial dos equipamentos, incluindo endereço, coordenadas, capacidade, limite operacional e raio de cobertura. O Java gera o `id` estável que as outras partes usam.
3. Resolver a cobertura em `GET /coverage?latitude=…&longitude=…` e vincular o equipamento ao protocolo. Manter criação, edição, exclusão, fotos, complementos, avaliação técnica e atendimento dos relatos.
4. Fornecer ao .NET o catálogo ativo via `GET /sensors` e `GET /sensors/{id}` e gerar a análise em `POST /sensors/{id}/insights`.

### .NET — monitoramento e telemetria

1. Fornecer `GET /sensors` para o mapa da operadora e `GET /sensors/{id}` para a ficha, unindo o cadastro lido do Java à telemetria pelo `id` do equipamento.
2. Guardar as medições e os eventos. O perfil de desenvolvimento usa SQLite. Em Oracle, prepare o esquema com o script do repositório .NET. Um equipamento sem leituras aparece como `offline`.
3. Receber medições de teste por `POST /sensors/{id}/readings`, usando o JWT da operadora e o prefixo como `deviceId`. O backend deduplica por dispositivo e `sampleId`.
4. Receber leituras do **Wokwi via HiveMQ** e disponibilizar ao Java o resumo da telemetria por período.

### Integração entre as equipes

- **Um login.** O mobile autentica no Java e envia o mesmo token Bearer nas duas APIs. O .NET valida a assinatura HS256 com o segredo compartilhado entre os servidores, o emissor `saneia-api`, a expiração e o papel de operadora. O Expo recebe apenas as URLs públicas.
- **Um catálogo.** O .NET encaminha o Bearer da operadora ao Java para consultar os equipamentos ativos. O Java grava contas, catálogo e relatos. O .NET grava leituras e eventos vinculados ao ID do Java. Quando um equipamento é retirado, sai do mapa e da cobertura, e o histórico permanece.
- **Dois fluxos independentes.** Cadastro, cobertura e atendimento continuam disponíveis quando a telemetria estiver indisponível. Um alarme do equipamento gera um evento no .NET. O status do protocolo é atualizado pela operadora no Java.

O [contrato das APIs](docs/api.md) detalha rotas, campos e erros. O código dos serviços está nos repositórios [Java](https://github.com/2TDSPO-JPG/API-Java-Global-Solutions) e [.NET](https://github.com/2TDSPO-JPG/API-DotNet-Global-Solutions).

## Endpoints e forma de acesso

As rotas abaixo são relativas à base de cada serviço. No desenvolvimento, `EXPO_PUBLIC_API_URL` aponta para `http://localhost:8080/api` e `EXPO_PUBLIC_MONITORING_API_URL` para `http://localhost:5085/api`. Se a variável do monitoramento estiver vazia, o app consulta mapa e ficha pelo Java.

O mobile faz login no Java e usa o `token` retornado no cabeçalho `Authorization: Bearer <token>` das chamadas protegidas. As duas APIs devem aceitar a mesma sessão, com validação de expiração e papel no servidor. Para JSON, o app envia `Content-Type: application/json`. Para fotos, envia multipart com a parte textual `report` e o arquivo `photo`.

### Rotas do Java

| Método e rota | Quem acessa | Entrada ou resultado esperado |
| --- | --- | --- |
| `POST /auth/login` | Público | Recebe `email` e `password`. Retorna `token`, `expiresAt` e `user` |
| `POST /auth/signup` | Público | Recebe `name`, `email` e `password`. Cria morador e retorna a sessão |
| `GET /admin/users` | Administrador | Retorna usuários com `id`, `name`, `email` e `role` |
| `GET /admin/sensors` | Administrador | Lista o catálogo ativo |
| `GET /admin/sensors/{id}` | Administrador | Consulta o cadastro de um equipamento |
| `POST /admin/sensors` | Administrador | Cria equipamento com endereço, coordenadas, capacidade, limite e raio |
| `PATCH /admin/sensors/{id}` | Administrador | Atualiza o cadastro e preserva as leituras |
| `DELETE /admin/sensors/{id}` | Administrador | Retira o equipamento ativo. Responde `204` |
| `GET /coverage?latitude=…&longitude=…` | Morador | Retorna `{ sensorId, status }` para as coordenadas informadas |
| `GET /reports` | Morador e operadora | Morador recebe os próprios relatos. Operadora recebe a fila |
| `GET /reports/{id}` | Dono do relato e operadora | Retorna detalhe, fotos e complementos. A avaliação técnica aparece para a operadora |
| `POST /reports` | Morador | Cria relato e retorna o protocolo |
| `PATCH /reports/{id}` | Dono do relato | Atualiza um relato em `received` |
| `DELETE /reports/{id}` | Dono do relato | Exclui um relato em `received`. Responde `204` |
| `POST /reports/{id}/updates` | Dono do relato | Acrescenta texto e/ou foto a um protocolo aberto |
| `PATCH /reports/{id}/status` | Operadora | Recebe `status`, `progressNote` e `resolution` |
| `POST /reports/{id}/assessment` | Operadora | Recebe `note` e registra a avaliação técnica |
| `POST /sensors/{id}/insights` | Operadora | Recebe o período e retorna `summary`, `aiGenerated` e indicadores via Spring AI |

Os papéis retornados em `user.role` são `resident`, `operator` e `admin`. O app seleciona a área a partir desse campo.

### Rotas do .NET

| Método e rota | Quem acessa | Uso no app |
| --- | --- | --- |
| `GET /sensors` | Operadora | Mapa, filtros, totais por estado e endereços dos equipamentos vinculados aos relatos |
| `GET /sensors/{id}` | Operadora | Ficha completa, leituras do gráfico e eventos do equipamento |

Essas consultas usam o Bearer obtido no Java. O app consulta o mapa e a ficha a cada cinco segundos enquanto a tela estiver em foco. A lista retorna um array JSON paginado e a ficha inclui até 500 medições e 100 eventos recentes. O .NET usa os IDs do catálogo Java e retorna o formato `Sensor` descrito no [contrato](docs/api.md).

O endereço completo fica em `address`, o bairro em `neighborhood` e os campos separados ficam em `postalAddress`, quando disponíveis. Os estados são `normal`, `warning`, `alarm` e `offline`. Um equipamento sem leitura tem `status: "offline"`, `volume: null`, `lastReadingAt: null` e listas de histórico vazias.

### Exemplo do login no Java

```http
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "operadora@saneia.test",
  "password": "Saneia2026!"
}
```

Com o token dessa resposta, consulte o monitoramento na base .NET. O exemplo usa o ID `21` do catálogo Java.

```http
GET http://localhost:5085/api/sensors/21
Accept: application/json
Authorization: Bearer <token retornado pelo Java>
```

As duas APIs devem permitir a origem do Expo no CORS, os métodos utilizados, os cabeçalhos `Authorization` e `Content-Type` e o preflight `OPTIONS`. Listas paginadas usam `page` e `size`, retornam arrays e expõem `X-Total-Pages` no CORS para o cliente percorrer todas as páginas. Erros seguem `{ "message": "..." }`, com `401` para sessão inválida ou expirada e `403` para falta de permissão.

## Regras que o Java precisa aplicar

- **Contas e acesso.** O login devolve `token` e `user: { id, name, email, role }`. Os papéis são `resident`, `operator` e `admin`. O cadastro público cria moradores. Provisione contas de operadora e administrador pelo backend. Valide o token Bearer, o papel e a propriedade de cada relato no servidor. Retorne `401` para sessão inválida e `403` para conta autenticada sem a permissão exigida.
- **Catálogo e cobertura.** Use um ID estável e um prefixo único por equipamento. Em novos cadastros, valide `postalAddress` com CEP, logradouro, número, bairro, cidade e UF. O complemento é opcional. O app consulta a BrasilAPI para preencher o endereço e, quando disponível, uma posição aproximada pelo CEP. Se a BrasilAPI estiver indisponível, o ViaCEP pode preencher o endereço. O administrador pode usar o GPS no local da instalação ou ajustar as coordenadas. O app envia `coordinate` ao Java junto com os demais campos. Valide também capacidade, limite operacional e raio de cobertura. A cobertura usa o equipamento ativo mais próximo dentro do seu raio e devolve `{ sensorId, status }`, com ambos `null` quando não há cobertura. Ao excluir um equipamento, retire-o do catálogo ativo, do mapa e da cobertura, preservando os vínculos dos protocolos e o histórico.
- **Relatos.** Gere o protocolo e a data de abertura no servidor. O morador vê os próprios relatos e pode editar ou excluir apenas em `received`. A operadora vê a fila e atualiza de `received` para `in_progress` e depois para `closed`, com desfecho. O app envia as categorias `Retorno de esgoto`, `Vazamento`, `Mau cheiro` e `Outro problema`. Use datas em ISO 8601 e IDs em texto nas respostas.
- **Recorrência.** Na criação, verifique na mesma transação o intervalo de 20 dias para o mesmo morador, a mesma categoria e ocorrências a até 75 m. Siga o contrato para exclusões e protocolos encerrados. Se bloquear, retorne `409` com `code: "REPORT_COOLDOWN"`, `message` e `existingReportId` quando houver protocolo em aberto. Fora do intervalo, vincule o novo relato ao anterior ainda aberto.
- **Fotos e complementos.** O app envia JSON quando há apenas texto. Com foto, envia `multipart/form-data` com o JSON na parte textual `report` e o arquivo na parte `photo`. Ao editar sem nova foto, preserve a anterior. Devolva uma `photoUrl` acessível pelo componente de imagem, por exemplo, uma URL assinada. Complementos são adicionados ao histórico de um protocolo em aberto, sem criar outro.

As listas são retornadas como arrays JSON. Os erros usam `{ "message": "..." }` e as exclusões bem-sucedidas respondem com `204` sem corpo.

## Executar com Java e .NET

1. No repositório Java, rode `.\mvnw.cmd spring-boot:run` no Windows. O perfil `local` usa H2 em memória e provisiona as três contas de teste abaixo. A API atende em `http://localhost:8080/api`, com Swagger em `/api/swagger-ui.html`.
2. No repositório .NET, use o SDK .NET 8. Configure `Java__BaseUrl=http://localhost:8080/api` e `Jwt__SharedSecret` com o mesmo valor de `JWT_SECRET` do Java. Se o Java estiver usando a configuração padrão do perfil local, consulte o segredo de desenvolvimento nesse perfil. Rode `dotnet run --project src/Saneia.Api`. O perfil Development usa SQLite e atende em `http://localhost:5085/api`, com Swagger em `/swagger`. Se usar Expo Web na porta 8082, configure `Cors__Origins__0=http://localhost:8082` no .NET ou informe a origem exata usada pelo navegador.
3. No mobile, use Node.js 22.13 ou superior, execute `npm ci` e crie `.env.local` a partir do [.env.example](.env.example). Configure as duas URLs e rode `npx expo start --port 8082`. Pressione **w** para o navegador. Para testar no Expo Go, use nas duas URLs o IP do computador e configure os servidores para ouvir nesse endereço. No .NET, use `dotnet run --project src/Saneia.Api -- --urls http://0.0.0.0:5085`. Reinicie o Expo após editar as variáveis.
4. Entre como administrador e cadastre um equipamento com CEP. Entre como operadora e abra o mapa. Use o Swagger .NET ou o arquivo `requests.http` daquele repositório para gravar uma medição de teste com o JWT da operadora. Confira a leitura no mapa e na ficha. Em **Relatos por bairro**, o app cruza o `sensorId` do relato com o catálogo do monitoramento.

O cliente envia `postalAddress` ao Java no cadastro e na edição e usa o mesmo objeto ao reabrir o formulário. Equipamentos legados podem preservar o endereço livre. O endereço formatado aceita até 200 caracteres, o número até 10 e o complemento até 80. Para exigir o objeto nos novos cadastros, configure `SANEIA_REQUIRE_POSTAL_ADDRESS=true` no Java.

### Testar Wokwi e análise com o mesmo histórico

1. Nos dois backends, defina a mesma `SANEIA_INTEGRATION_KEY` de pelo menos 32 bytes. Defina `DOTNET_TELEMETRY_URL=http://localhost:5085/api` no Java e `Mqtt__Enabled=true` no .NET. Use o mesmo JWT entre os backends, conforme o procedimento acima.
2. No app, cadastre como administrador o equipamento `RES-07` com capacidade de 2.000 L e limite de 1.800 L. O .NET usa esse prefixo para associar as leituras do sketch Wokwi `S07` ao ID cadastrado.
3. Inicie o Wokwi com os [arquivos do circuito](https://github.com/2TDSPO-JPG/API-DotNet-Global-Solutions/tree/main/wokwi) e, como operadora, abra a ficha. A distância de 17 cm gera aproximadamente 1.850 L e deve abrir um alarme. O app consulta o .NET a cada cinco segundos. O broker público da configuração de demonstração recebe somente leituras fictícias.
4. Toque em **Gerar análise com IA**. O Java consulta o mesmo histórico no .NET, e o app indica **Histórico da API .NET**. Com `GEMINI_API_KEY` configurada no Java, confira `aiGenerated: true` na resposta.

Os detalhes de broker, credenciais e calibração ficam no [README do .NET](https://github.com/2TDSPO-JPG/API-DotNet-Global-Solutions#saneia--api-net-de-monitoramento).

## Consultar o fluxo local

Para a avaliação de persistência local da disciplina Mobile, defina `EXPO_PUBLIC_LOCAL_MODE=true` e deixe `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_MONITORING_API_URL` e `EXPO_PUBLIC_IOT_URL` vazias. O acesso é feito por e-mail e senha. Uma instalação nova começa com listas vazias, e os registros existentes no aparelho são preservados. No fluxo conectado, configure as URLs das APIs e mantenha `EXPO_PUBLIC_LOCAL_MODE=false`.

As contas abaixo pertencem ao ambiente de desenvolvimento e também são provisionadas pelo perfil `local` do Java. No ambiente publicado, use as contas provisionadas pelo responsável pelo backend.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@saneia.test` | `Saneia2026!` |
| Operadora | `operadora@saneia.test` | `Saneia2026!` |
| Administrador | `admin@saneia.test` | `Saneia2026!` |
