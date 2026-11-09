# Saneia Mobile

O Saneia recebe relatos de saneamento dos moradores, organiza o atendimento da operadora e permite que a administração gerencie o catálogo de equipamentos. O app usa React Native, Expo SDK 58 e Expo Router, com AsyncStorage no modo local. A integração prevê duas APIs, **Java (Spring Boot)** e **.NET (ASP.NET Core)**, com persistência no Oracle.

## Interface e acesso

O fluxo principal usa autenticação na API Java. A página de acesso tem login e cadastro de morador. Cada perfil recebe sua própria navegação, com menu lateral em telas maiores e navegação inferior no celular.

A visão geral mostra os totais retornados pela API, os equipamentos que precisam de atenção e os últimos relatos. O cadastro administrativo usa CEP para preencher endereço e localização. As coordenadas podem ser ajustadas, e o volume é recebido pelo monitoramento. O mapa web usa Leaflet com base OpenStreetMap e os mapas nativos continuam disponíveis no Android e no iOS. A base cartográfica e a busca de CEP exigem conexão com a internet.

Para usar a API local com um catálogo vazio, configure `SEED_DEMO_DATA=false` no processo Java antes de iniciá-lo. Essa configuração mantém as contas provisionadas e permite cadastrar os equipamentos e relatos pelo aplicativo.

## Quem implementa o quê

| API | Responsabilidade | Rotas consumidas pelo mobile após a integração |
| --- | --- | --- |
| **Java** | Contas e permissões, cadastro de equipamentos, cobertura geográfica e todo o atendimento dos moradores. | `POST /auth/login`, `POST /auth/signup`, `GET /admin/users`, CRUD em `/admin/sensors`, `GET /coverage` e rotas de `/reports` |
| **.NET** | Monitoramento da operadora. Junta o catálogo do Java com o último estado, o volume, o histórico e os eventos de cada equipamento. Depois recebe as leituras do IoT. | `GET /sensors` e `GET /sensors/{id}`, quando a segunda base estiver integrada |

### Java — negócio e administração

1. Autenticar e cadastrar moradores, listar usuários para o administrador e aplicar as permissões dos três perfis.
2. Manter o catálogo oficial dos equipamentos, incluindo endereço, coordenadas, capacidade, limite operacional e raio de cobertura. O Java gera o `id` estável que as outras partes usam.
3. Resolver a cobertura em `GET /coverage?latitude=…&longitude=…` e vincular o equipamento ao protocolo. Manter criação, edição, exclusão, fotos, complementos, avaliação técnica e atendimento dos relatos.
4. Fornecer ao .NET a leitura do catálogo ativo. Se a API Java já tiver `GET /sensors` e `GET /sensors/{id}`, reaproveite essas rotas entre os serviços. Preserve o contrato das demais rotas já implementadas.

### .NET — monitoramento e telemetria

1. Implementar `GET /sensors` para o mapa da operadora e `GET /sensors/{id}` para a ficha, unindo o cadastro lido do Java ao histórico no Oracle pelo `id` do equipamento.
2. Testar com leituras fictícias gravadas no Oracle. Para equipamentos sem leituras, retornar `offline`, com `volume` e `lastReadingAt` nulos e listas de histórico vazias.
3. Na etapa seguinte, receber as leituras do **Wokwi via HiveMQ**, associar o dispositivo ao equipamento cadastrado, evitar duplicatas por dispositivo e `sampleId`, gravar as medições e calcular os estados e eventos de alarme.
4. Disponibilizar os dados necessários para os indicadores e a análise, conforme o contrato entre as equipes. A funcionalidade com Spring AI permanece no Java para atender ao enunciado de Java Advanced.

### Integração entre as equipes

- **Um login.** O mobile autentica no Java e envia o mesmo token Bearer nas duas APIs. Alinhem com o responsável pelo Java como o .NET validará o token e o papel `operator` antes de liberar o monitoramento. O contrato detalha o caminho para JWT e para token opaco.
- **Um catálogo.** O .NET lê os equipamentos ativos do Java. No Oracle, o Java grava contas, catálogo e relatos. O .NET grava leituras e eventos vinculados ao ID do Java. Quando um equipamento é retirado, sai do mapa e da cobertura, e o histórico permanece.
- **Dois fluxos independentes.** Cadastro, cobertura e atendimento continuam disponíveis quando a telemetria estiver indisponível. Um alarme do equipamento gera um evento no .NET. O status do protocolo é atualizado pela operadora no Java.

O [contrato das APIs](docs/api.md) detalha rotas, campos e erros. A integração atual usa o [backend Java do Saneia](https://github.com/2TDSPO-JPG/API-Java-Global-Solutions) como referência.

## Regras que o Java precisa aplicar

- **Contas e acesso.** O login devolve `token` e `user: { id, name, email, role }`. Os papéis são `resident`, `operator` e `admin`. O cadastro público cria moradores. Provisione contas de operadora e administrador pelo backend. Valide o token Bearer, o papel e a propriedade de cada relato no servidor. Retorne `401` para sessão inválida e `403` para conta autenticada sem a permissão exigida.
- **Catálogo e cobertura.** Use um ID estável e um prefixo único por equipamento. Em novos cadastros, valide `postalAddress` com CEP, logradouro, número, bairro, cidade e UF. O complemento é opcional. O app consulta a BrasilAPI para preencher o endereço e, quando disponível, uma posição aproximada pelo CEP. Se a BrasilAPI estiver indisponível, o ViaCEP pode preencher o endereço. O administrador pode usar o GPS no local da instalação ou ajustar as coordenadas. O app envia `coordinate` ao Java junto com os demais campos. Valide também capacidade, limite operacional e raio de cobertura. A cobertura usa o equipamento ativo mais próximo dentro do seu raio e devolve `{ sensorId, status }`, com ambos `null` quando não há cobertura. Ao excluir um equipamento, retire-o do catálogo ativo, do mapa e da cobertura, preservando os vínculos dos protocolos e o histórico.
- **Relatos.** Gere o protocolo e a data de abertura no servidor. O morador vê os próprios relatos e pode editar ou excluir apenas em `received`. A operadora vê a fila e atualiza de `received` para `in_progress` e depois para `closed`, com desfecho. O app envia as categorias `Retorno de esgoto`, `Vazamento`, `Mau cheiro` e `Outro problema`. Use datas em ISO 8601 e IDs em texto nas respostas.
- **Recorrência.** Na criação, verifique na mesma transação o intervalo de 20 dias para o mesmo morador, a mesma categoria e ocorrências a até 75 m. Siga o contrato para exclusões e protocolos encerrados. Se bloquear, retorne `409` com `code: "REPORT_COOLDOWN"`, `message` e `existingReportId` quando houver protocolo em aberto. Fora do intervalo, vincule o novo relato ao anterior ainda aberto.
- **Fotos e complementos.** O app envia JSON quando há apenas texto. Com foto, envia `multipart/form-data` com o JSON na parte textual `report` e o arquivo na parte `photo`. Ao editar sem nova foto, preserve a anterior. Devolva uma `photoUrl` acessível pelo componente de imagem, por exemplo, uma URL assinada. Complementos são adicionados ao histórico de um protocolo em aberto, sem criar outro.

As listas são retornadas como arrays JSON. Os erros usam `{ "message": "..." }` e as exclusões bem-sucedidas respondem com `204` sem corpo.

## Ordem para integrar e testar

1. **Java.** Entrar com os três perfis, cadastrar um equipamento como administrador e abrir um relato dentro da cobertura como morador. Como operadora, consultar e atualizar o protocolo.
2. **.NET.** Com a mesma sessão de operadora, verificar se o equipamento cadastrado no Java aparece no mapa e se a ficha exibe as leituras de teste. Na aba **Relatos por bairro**, verificar o endereço do equipamento pelo `sensorId` do relato.
3. **IoT e IA.** Depois de validar as duas APIs por HTTP, publicar uma leitura no HiveMQ e verificar o histórico no app. A análise usa o endpoint Java com Spring AI. Com o Gemini configurado no backend, a resposta indica `aiGenerated: true`.

### Testar o Java com o app

1. No repositório Java, rode `.\mvnw.cmd spring-boot:run` no Windows. O perfil `local` usa H2 em memória e provisiona as três contas de teste abaixo. A API inicia por padrão em `http://localhost:8080/api`, com Swagger em `/api/swagger-ui.html`.
2. No mobile, use Node.js 22.13 ou superior e execute `npm ci`. Crie `.env.local` a partir do [.env.example](.env.example) e configure `EXPO_PUBLIC_API_URL=http://localhost:8080/api`. Para testar no celular, troque `localhost` pelo IP do computador na rede local. Na nuvem, use a URL HTTPS real da API com o sufixo `/api`.
3. Rode `npx expo start`, pressione **w** e entre com uma conta da API. Reinicie o Expo após alterar a URL. Se restringir o CORS do Java, inclua a origem do Expo e exponha o cabeçalho `X-Total-Pages`.

O [cliente HTTP](src/services/api.js) usa o JWT do Java, percorre as páginas das listas e envia fotos de relatos e complementos via multipart. O app lê `GET /sensors` e `GET /sensors/{id}` do Java provisoriamente para manter o catálogo, os endereços e a ficha acessíveis. O botão **Gerar análise com IA** consome `POST /sensors/{id}/insights` do Java e usa os dados do período escolhido. A segunda base HTTP e a ingestão IoT ficam para a etapa .NET. `EXPO_PUBLIC_IOT_URL` é uma configuração opcional do ambiente local.

### Ajustes pendentes no backend

- **Endereço estruturado do equipamento.** O Java atual aceita e devolve `address`, `neighborhood` e `coordinate`. Para reabrir o formulário com CEP, número, cidade e UF preenchidos, adicione `postalAddress` às entradas de `POST /admin/sensors` e `PATCH /admin/sensors/{id}`, salve o objeto e devolva-o nas consultas do catálogo. Enquanto isso, o app envia o endereço completo formatado, limitado aos 200 caracteres do DTO Java.
- **Login compartilhado com o .NET.** Antes da segunda API, alinhe a validação do JWT. O Java atual usa HS256. A opção descrita no contrato é um endpoint interno de validação no Java. Esse ajuste pertence à etapa .NET.

## Consultar o fluxo local

Para a avaliação de persistência local da disciplina Mobile, defina `EXPO_PUBLIC_LOCAL_MODE=true` e deixe `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_IOT_URL` vazias. O acesso é feito por e-mail e senha. Uma instalação nova começa com listas vazias, e os registros existentes no aparelho são preservados. No fluxo principal, configure a URL do Java e mantenha `EXPO_PUBLIC_LOCAL_MODE=false`.

As contas abaixo pertencem ao ambiente de desenvolvimento e também são provisionadas pelo perfil `local` do Java. No ambiente publicado, use as contas provisionadas pelo responsável pelo backend.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@saneia.test` | `Saneia2026!` |
| Operadora | `operadora@saneia.test` | `Saneia2026!` |
| Administrador | `admin@saneia.test` | `Saneia2026!` |
