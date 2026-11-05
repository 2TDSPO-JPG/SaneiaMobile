# Saneia Mobile

Aplicativo React Native com Expo Router para o projeto CitizenTech da FIAP. O morador relata ocorrências de saneamento e acompanha seus protocolos. A operadora consulta sensores, prioriza alertas e registra o atendimento.

## Executar para a entrega de Mobile

1. Abra o terminal nesta pasta com Node.js 22.13 ou superior.
2. Execute `npm ci`.
3. Execute `npx expo start` e pressione **w** para abrir o app no navegador.

O fluxo avaliado usa **React Native, Expo SDK 58, Expo Router e AsyncStorage**. Ele roda com dados locais. Se já houver um `.env.local` de integração, você pode ignorá-lo para a demonstração executando `$env:EXPO_NO_DOTENV = '1'` no PowerShell antes de iniciar o Expo.

### Contas de teste

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@saneia.test` | `Saneia2026!` |
| Operadora | `operadora@saneia.test` | `Saneia2026!` |
| Administrador | `admin@saneia.test` | `Saneia2026!` |

### Fluxo para demonstrar

1. Entre com a conta de morador usando **Entrar**.
2. Abra a aba **Relatos** para ver a lista de protocolos.
3. Use **Registrar relato** na tela inicial para cadastrar uma ocorrência. Preencha o formulário e use **Marcar ponto de exemplo** se quiser testar sem GPS.
4. Toque em **Enviar e gerar protocolo**. A tela de detalhe mostra o número do protocolo, o endereço, a descrição e o status.
5. Recarregue o app, entre novamente e abra **Relatos**. O protocolo cadastrado permanece salvo no navegador. No aplicativo nativo, os dados ficam no dispositivo.

**Vídeo da entrega** — link do YouTube a preencher depois da gravação. O vídeo deve ter até três minutos e pode ser público ou não listado.

### Preparar equipamentos para a apresentação

1. Entre como administrador e abra **Equipamentos**.
2. Toque em **Cadastrar equipamento**. Informe prefixo, nome, bairro, endereço, coordenadas, capacidade, limite e raio de cobertura. O formulário oferece coordenadas de exemplo.
3. Para uma demonstração com limite de 1.800 L, use 1.000 L para **OK**, 1.600 L para **Alerta**, 1.800 L para **Alarme** ou deixe o volume vazio para **Sem comunicação**.
4. Salve e entre como operadora no mesmo dispositivo ou navegador para conferir o equipamento no mapa. Para editar ou excluir, volte à conta de administrador e abra o equipamento no catálogo.

O catálogo local é salvo em AsyncStorage e compartilhado entre os perfis no mesmo dispositivo ou navegador. A aba **Usuários** lista as três contas de teste em modo local e as contas retornadas pelo Spring Boot quando a API está ativa. O volume editável faz parte da simulação local.

## Executar no Expo Go

1. Abra o terminal nesta pasta. Use Node.js 22.13 ou superior.
2. Rode `npm ci` (ou `npm install` se ainda não houver lockfile).
3. Rode `npm start -- --clear` e escaneie o novo QR Code com o Expo Go em um celular na mesma rede. O projeto usa o SDK 58. Use o Expo Go para SDK 58.
4. Na tela inicial, entre com uma conta de teste ou escolha um perfil de demonstração.

`npm run web` abre a versão de revisão no navegador, com mapa esquemático. Em Android e iOS o app usa o mapa nativo. `npm run lint` valida o código.

## O que esta etapa permite demonstrar

- Login com três contas de teste locais. O cadastro de moradores usa a API quando configurada.
- Morador com início, novo relato, foto da galeria, GPS ou ponto no mapa, consulta de cobertura e protocolos.
- CRUD de relatos. O morador pode editar ou excluir enquanto estiver em **Recebido**.
- Operadora com visão geral, mapa e filtros, detalhes dos sensores, volume estimado, capacidade, limite, previsão e histórico.
- Menu Relatos da operadora com todos os protocolos, filtros por categoria e consulta por bairro. Mapa e detalhes de equipamentos exibem apenas informações de monitoramento.
- Atendimento de **Recebido** a **Em atendimento** e **Encerrado**, com desfecho visível ao morador.
- Administração com lista de usuários por perfil e cadastro, edição e exclusão de equipamentos.
- Perfil, logout e tela **Sobre o App**. O hash é lido do Git na geração da configuração ou informado por `SANEIA_COMMIT_HASH`.

Os relatos e complementos são salvos no dispositivo ou navegador na demonstração. O intervalo de 20 dias se aplica à mesma categoria e a locais a até 75 m para o mesmo morador. Outros problemas podem ser relatados sem espera. Abra o protocolo fictício de mau cheiro do Setor Norte e toque em **Relatar que o problema continua** para testar o vínculo e a prioridade. Se o novo protocolo estiver dentro do prazo, use **Adicionar informação ou foto** no protocolo em aberto. A operadora vê os complementos no histórico do mesmo protocolo. O ambiente integrado depende da validação no Spring Boot.

## Integrações opcionais

Para usar Wokwi, HiveMQ e Gemini, consulte o README do projeto complementar `saneia-iot`. Com a ponte ativa, as leituras e os limites do equipamento S07 vêm da ponte. Os demais equipamentos do catálogo local usam dados de demonstração.

### Integrar com o Java

Copie `.env.example` para `.env.local`, informe `EXPO_PUBLIC_API_URL` e reinicie o Expo. A URL precisa estar acessível pelo celular. Em rede local, informe o endereço do computador em vez de `localhost`. Com a URL definida, a interface usa `fetch` e habilita cadastro e login via API. Consulte [Contrato da API](docs/api.md).

## Enviar pelo Portal FIAP

O prazo informado é **19/11/2026, às 23h55**. Envie um arquivo `.txt` com nome do grupo, nome completo e RM de cada integrante, link do vídeo e link do GitHub. O repositório deve conter o código-fonte, este README com o link do vídeo e os commits da equipe ao longo do desenvolvimento.
