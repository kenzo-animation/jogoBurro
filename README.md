# Jogo Burro

Aplicativo Ionic + Vue 3 + TypeScript para jogar Burro entre celulares Android, com um modo local para validar as regras sem Bluetooth.

## Estado atual

- Motor puro com baralho proporcional ao número de jogadores, ordem circular, troca, grupo completo e penalidade BURRO.
- Nove telas navegáveis: início, nova partida, sala, jogo, resultado, histórico, detalhes, regras e configurações.
- Histórico persistido localmente no WebView (`localStorage`) para o protótipo.
- Protocolo JSON tipado com os nove tipos de mensagem e validação antes do consumo.

### Regra adotada

Quando um jogador completa quatro cartas do mesmo valor, os demais jogadores que ainda possuem uma carta daquele valor recebem uma letra de BURRO. Ao acumular as cinco letras, o jogador é eliminado. A partida termina quando resta um jogador sem eliminação. O anfitrião é a fonte da verdade.

## Executar

```bash
npm install
npm run dev
npm run test:unit -- --run
npm run build
```

## Bluetooth e próximos passos

Bluetooth exige dois celulares físicos e não funciona no emulador. A integração nativa ainda precisa da prova de conceito Android: permissões `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` e `BLUETOOTH_ADVERTISE`, conexão estrela host-cliente e reconexão. O adaptador deve implementar `MensagemBluetooth` em `src/types/bluetooth.ts` sem permitir que clientes alterem o estado localmente.

Antes de escolher o plugin final, valide que ele suporta simultaneamente central/cliente e periférico/servidor no Android. Plugins BLE que oferecem somente central não atendem ao anfitrião desta arquitetura; registre a escolha e o teste em `DECISOES.md`.
