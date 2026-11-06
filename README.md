# Saneia Mobile

O Saneia recebe relatos de saneamento dos moradores, organiza o atendimento da operadora e permite que a administração gerencie o catálogo de equipamentos. O app usa React Native, Expo SDK 58 e Expo Router, com AsyncStorage no modo local. A integração prevê duas APIs, **Java (Spring Boot)** e **.NET (ASP.NET Core)**, com persistência no Oracle.

## Quem implementa o quê

| API | Responsabilidade | Rotas consumidas pelo mobile após a integração |
| --- | --- | --- |
| **Java** | Contas e permissões, cadastro de equipamentos, cobertura geográfica e todo o atendimento dos moradores. | `POST /auth/login`, `POST /auth/signup`, `GET /admin/users`, CRUD em `/admin/sensors`, `GET /coverage` e rotas de `/reports` |
| **.NET** | Monitoramento da operadora. Junta o catálogo do Java com o último estado, o volume, o histórico e os eventos de cada equipamento. Depois recebe as leituras do IoT e gera insights. | `GET /sensors`, `GET /sensors/{id}` e, na etapa de IoT e IA, `POST /sensors/{id}/insights` |

### Java — negócio e administração

1. Autenticar e cadastrar moradores, listar usuários para o administrador e aplicar as permissões dos três perfis.
2. Manter o catálogo oficial dos equipamentos, incluindo endereço, coordenadas, capacidade, limite operacional e raio de cobertura. O Java gera o `id` estável que as outras partes usam.
3. Resolver a cobertura em `GET /coverage?latitude=…&longitude=…` e vincular o equipamento ao protocolo. Manter criação, edição, exclusão, fotos, complementos, avaliação técnica e atendimento dos relatos.
4. Fornecer ao .NET a leitura do catálogo ativo. Se a API Java já tiver `GET /sensors` e `GET /sensors/{id}`, reaproveite essas rotas entre os serviços. Preserve o contrato das demais rotas já implementadas.

### .NET — monitoramento e telemetria

1. Implementar `GET /sensors` para o mapa da operadora e `GET /sensors/{id}` para a ficha, unindo o cadastro lido do Java ao histórico no Oracle pelo `id` do equipamento.
2. Testar com leituras fictícias gravadas no Oracle. Para equipamentos sem leituras, retornar `offline`, com `volume` e `lastReadingAt` nulos e listas de histórico vazias.
3. Na etapa seguinte, receber as leituras do **Wokwi via HiveMQ**, associar o dispositivo ao equipamento cadastrado, evitar duplicatas por dispositivo e `sampleId`, gravar as medições e calcular os estados e eventos de alarme.
4. Implementar `POST /sensors/{id}/insights` quando houver histórico. O .NET calcula os indicadores e usa o Gemini para resumir o período.

### Integração entre as equipes

- **Um login.** O mobile autentica no Java e envia o mesmo token Bearer nas duas APIs. Alinhem com o responsável pelo Java como o .NET validará o token e o papel `operator` antes de liberar o monitoramento. O contrato detalha o caminho para JWT e para token opaco.
- **Um catálogo.** O .NET lê os equipamentos ativos do Java. No Oracle, o Java grava contas, catálogo e relatos. O .NET grava leituras e eventos vinculados ao ID do Java. Quando um equipamento é retirado, sai do mapa e da cobertura, e o histórico permanece.
- **Dois fluxos independentes.** Cadastro, cobertura e atendimento continuam disponíveis quando a telemetria estiver indisponível. Um alarme do equipamento gera um evento no .NET. O status do protocolo é atualizado pela operadora no Java.

O [contrato das APIs](docs/api.md) detalha rotas, campos e erros. Confiram os endpoints do Java existente pelo Swagger ou pelo código do backend antes de ligar o mobile às duas bases.

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
3. **IoT e IA.** Depois de validar as duas APIs por HTTP, publicar uma leitura no HiveMQ, verificar se ela entra no histórico e aparece no app e, por último, gerar o insight do período.

### Configuração atual do mobile

O [cliente HTTP atual](src/services/api.js) usa `EXPO_PUBLIC_API_URL` para o Java e ainda encaminha as rotas de monitoramento para essa mesma base quando está integrado. A próxima alteração no mobile será adicionar uma base própria para o .NET e encaminhar `/sensors` e insights para ela. `EXPO_PUBLIC_IOT_URL` pertence à ponte da demonstração local.

Para testar o Java com o app atual, use Node.js 22.13 ou superior, execute `npm ci` e configure `EXPO_PUBLIC_API_URL=http://localhost:8080/api` em `.env.local`, conforme o [.env.example](.env.example). Rode `npx expo start` e pressione **w**. Configure o CORS da API para a origem do Expo, incluindo `Authorization`, `Content-Type` e o preflight `OPTIONS`. No celular, use o IP do computador na rede local. Reinicie o Expo ao alterar a URL.

## Consultar o fluxo local

Para conhecer as telas antes de implementar a API, deixe `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_IOT_URL` vazias. Rode `npx expo start` e pressione **w**. Estas contas pertencem ao modo local.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@saneia.test` | `Saneia2026!` |
| Operadora | `operadora@saneia.test` | `Saneia2026!` |
| Administrador | `admin@saneia.test` | `Saneia2026!` |
