# Decisões técnicas

- Plataforma inicial: Android, porque o requisito de conexão entre dois celulares precisa de aparelhos físicos e permissões nativas específicas.
- Arquitetura: host autoritativo. O anfitrião embaralha, valida turno e carta, aplica a troca e transmite apenas a mão de cada jogador.
- Topologia: estrela, com todos os clientes conectados ao anfitrião.
- Persistência: serviço isolado. O protótipo web usa `localStorage`; o adaptador Android em `src/services/database/sqlite.ts` usa `@capacitor-community/sqlite` com as tabelas `partidas` e `participantes`.
- Bluetooth: `@capgo/capacitor-bluetooth-low-energy@8.2.1`, compatível com Capacitor 8. A API instalada expõe `initialize({ mode: 'peripheral' | 'central' })`, `addGattService`, `startAdvertising`, `startScan`, conexão, notificações e eventos de central conectado/desconectado. A prova de conceito está em `src/services/bluetooth/blePoc.ts`; a aprovação final ainda depende de teste em dois Android físicos.
- Protocolo da PoC: `SERVICE_UUID` anuncia a sala; `RX_UUID` recebe texto do cliente; `TX_UUID` notifica respostas do anfitrião. O cliente deve enviar JSON e o anfitrião validar antes de alterar a sala.
- Reconexão: o contrato já reserva `RECONEXAO`; até a prova em dois aparelhos, uma queda deve marcar a partida como interrompida e salvar o registro.
