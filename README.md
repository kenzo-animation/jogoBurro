# Jogo Burro

Aplicativo Ionic + Vue 3 + TypeScript para jogar Burro entre celulares Android, com um modo local para validar as regras sem Bluetooth.

## Estado atual

- Motor puro com baralho proporcional ao número de jogadores, ordem circular, troca, grupo completo e penalidade BURRO.
- Nove telas navegáveis: início, nova partida, sala, jogo, resultado, histórico, detalhes, regras e configurações.
- Histórico persistido localmente no WebView (`localStorage`) para o protótipo.
- Protocolo JSON tipado com os nove tipos de mensagem e validação antes do consumo.
- PoC BLE separada em periférico/host e central/cliente, com serviço GATT RX/TX, scan, conexão, notificações, MTU e desconexão.

### Regra adotada

Quando um jogador completa quatro cartas do mesmo valor, os demais jogadores que ainda possuem uma carta daquele valor recebem uma letra de BURRO. Ao acumular as cinco letras, o jogador é eliminado. A partida termina quando resta um jogador sem eliminação. O anfitrião é a fonte da verdade.

## Executar

```bash
npm install
npm run dev
npm run test:unit -- --run
npm run build
```

## Fases 0–3

- Fase 0: plugin escolhido e implementado em `src/services/bluetooth/blePoc.ts`; validar em dois Android físicos, porque emulador não comprova BLE.
- Fase 1: pastas de domínio, serviços, tipos, views e rotas estão separadas; o contrato Bluetooth rejeita mensagens sem `tipo`, `partidaId`, `jogadorId` ou `enviadoEm`.
- Fase 2: motor local e testes Vitest cobrem distribuição, turnos, troca, grupo completo, penalidade e fim.
- Fase 3: `@capacitor-community/sqlite` possui inicialização e CRUD em `src/services/database/sqlite.ts`; o modo web mantém `localStorage` como fallback para desenvolvimento no navegador.

## Bluetooth e próximos passos

Bluetooth exige dois celulares físicos e não funciona no emulador. A integração nativa ainda precisa da prova de conceito Android: permissões `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` e `BLUETOOTH_ADVERTISE`, conexão estrela host-cliente e reconexão. O adaptador deve implementar `MensagemBluetooth` em `src/types/bluetooth.ts` sem permitir que clientes alterem o estado localmente.

O teste de aceite da Fase 0 é: aparelho A toca “Ser anfitrião”, aparelho B encontra a partida, conecta e recebe uma notificação de texto; depois B envia um JSON pelo RX e A registra o pedido. Só então o protocolo de jogo deve ser ligado à PoC.
