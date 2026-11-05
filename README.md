# Saneia Mobile

Esta versão do aplicativo é a referência para **iniciar a criação da API em Java com Spring Boot e Oracle**. O Saneia recebe relatos de saneamento dos moradores, organiza o atendimento da operadora e permite que a administração gerencie o catálogo de equipamentos. O app usa React Native, Expo SDK 58 e Expo Router. Os fluxos locais usam AsyncStorage, e as chamadas HTTP do modo integrado já estão no [cliente da API](src/services/api.js).

**Nesta etapa**, implemente a API de contas, equipamentos, cobertura, relatos e consulta ao monitoramento. **Depois da API, ainda faltará integrar o IoT** para receber as leituras do Wokwi via HiveMQ, gravar o histórico no Oracle e disponibilizar a telemetria ao app pelo Spring Boot. A geração de insights com Gemini fica para essa etapa, a partir das medições armazenadas.

## Escopo inicial da API

| Ordem | Implementar | O que validar no aplicativo |
| --- | --- | --- |
| 1 | `POST /auth/login` e `POST /auth/signup` | Cadastro de morador e login direcionando cada conta para sua área |
| 2 | `GET /admin/users` e CRUD em `/admin/sensors` | Administrador consulta usuários e cadastra, edita ou retira equipamentos |
| 3 | `GET /coverage?latitude=…&longitude=…` e CRUD em `/reports` | Morador consulta cobertura, abre um relato, recebe o protocolo e consulta o detalhe |
| 4 | `PATCH /reports/{id}/status`, `POST /reports/{id}/updates` e `POST /reports/{id}/assessment` | Operadora registra o atendimento e solicita avaliação. Morador acompanha e complementa o protocolo |
| 5 | `GET /sensors` e `GET /sensors/{id}` | Operadora consulta no mapa e na ficha os mesmos equipamentos ativos do catálogo |

O [contrato da API](docs/api.md) descreve os métodos, os campos de entrada e saída, os erros esperados e o endpoint de insights previsto para depois.

## Regras que o backend precisa aplicar

- **Contas e acesso.** O login devolve `token` e `user: { id, name, email, role }`. Os papéis são `resident`, `operator` e `admin`. O cadastro público cria moradores. Provisione contas de operadora e administrador pelo backend. Valide o token Bearer, o papel e a propriedade de cada relato no servidor. Retorne `401` para sessão inválida e `403` para conta autenticada sem a permissão exigida.
- **Catálogo e cobertura.** Use um ID estável e um prefixo único por equipamento. Em novos cadastros, valide `postalAddress` com CEP, logradouro, número, bairro, cidade e UF. O complemento é opcional. O app consulta a BrasilAPI para preencher o endereço e, quando disponível, uma posição aproximada pelo CEP. Se a BrasilAPI estiver indisponível, o ViaCEP pode preencher o endereço. O administrador pode usar o GPS no local da instalação ou ajustar as coordenadas. O app envia `coordinate` ao Java junto com os demais campos. Valide também capacidade, limite operacional e raio de cobertura. A cobertura usa o equipamento ativo mais próximo dentro do seu raio e devolve `{ sensorId, status }`, com ambos `null` quando não há cobertura. Ao excluir um equipamento, retire-o do catálogo ativo, do mapa e da cobertura, preservando os vínculos dos protocolos e o histórico.
- **Relatos.** Gere o protocolo e a data de abertura no servidor. O morador vê os próprios relatos e pode editar ou excluir apenas em `received`. A operadora vê a fila e atualiza de `received` para `in_progress` e depois para `closed`, com desfecho. O app envia as categorias `Retorno de esgoto`, `Vazamento`, `Mau cheiro` e `Outro problema`. Use datas em ISO 8601 e IDs em texto nas respostas.
- **Recorrência.** Na criação, verifique na mesma transação o intervalo de 20 dias para o mesmo morador, a mesma categoria e ocorrências a até 75 m. Siga o contrato para exclusões e protocolos encerrados. Se bloquear, retorne `409` com `code: "REPORT_COOLDOWN"`, `message` e `existingReportId` quando houver protocolo em aberto. Fora do intervalo, vincule o novo relato ao anterior ainda aberto.
- **Fotos e complementos.** O app envia JSON quando há apenas texto. Com foto, envia `multipart/form-data` com o JSON na parte textual `report` e o arquivo na parte `photo`. Ao editar sem nova foto, preserve a anterior. Devolva uma `photoUrl` acessível pelo componente de imagem, por exemplo, uma URL assinada. Complementos são adicionados ao histórico de um protocolo em aberto, sem criar outro.
- **Monitoramento antes do IoT.** Um equipamento recém-cadastrado começa em `offline`, com `volume` e `lastReadingAt` nulos e listas de leituras vazias até receber uma medição. O app consulta o mapa e a ficha a cada cinco segundos no modo integrado. A inclusão de equipamentos no catálogo funciona antes da ingestão de telemetria.

As listas são retornadas como arrays JSON. Os erros usam `{ "message": "..." }` e as exclusões bem-sucedidas respondem com `204` sem corpo. No Oracle, separe o catálogo dos equipamentos do histórico de medições para receber novas leituras sem alterar os dados cadastrais.

Na aba **Relatos** e em **Relatos por bairro**, a operadora pode buscar por rua, bairro, cidade ou CEP. A busca compara os endereços disponíveis no relato e no equipamento vinculado. O detalhe do bairro também lista os equipamentos cadastrados naquele bairro. Para alimentar essas telas, retorne `address`, `neighborhood` e `postalAddress` no catálogo e mantenha `sensorId` nos relatos vinculados.

## Rodar o app com a API local

1. Use Node.js 22.13 ou superior e execute `npm ci` na raiz do projeto.
2. Crie `.env.local` a partir de [.env.example](.env.example) e aponte para o Spring Boot, incluindo o prefixo da API se houver.

   ```dotenv
   EXPO_PUBLIC_API_URL=http://localhost:8080/api
   ```

3. Execute `npx expo start` e pressione **w** para abrir no navegador. Configure o CORS do Spring para a origem exibida pelo Expo e permita os cabeçalhos `Authorization` e `Content-Type` e o preflight `OPTIONS`. Se testar pelo Expo Go no celular, use o IP do computador na rede local no lugar de `localhost`.
4. Use as contas cadastradas no backend. Como administrador, cadastre um equipamento usando **Buscar CEP** e complete o número. Para um CEP com localização disponível, o formulário preenche as coordenadas automaticamente. Como morador, abra um relato dentro da área de cobertura. Como operadora, procure pelo endereço em **Relatos por bairro** e atualize o protocolo.

Reinicie o Expo após alterar a URL. Com `EXPO_PUBLIC_API_URL` configurada, o app usa o Spring Boot para autenticação, relatos e equipamentos. Os registros locais do AsyncStorage ficam separados dos dados do Oracle.

## Consultar o fluxo local

Para conhecer as telas antes de implementar a API, deixe `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_IOT_URL` vazias. Rode `npx expo start` e pressione **w**. Estas contas pertencem ao modo local.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@saneia.test` | `Saneia2026!` |
| Operadora | `operadora@saneia.test` | `Saneia2026!` |
| Administrador | `admin@saneia.test` | `Saneia2026!` |
