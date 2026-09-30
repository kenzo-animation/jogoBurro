# Decisões técnicas

- Plataforma inicial: Android, porque o requisito de conexão entre dois celulares precisa de aparelhos físicos e permissões nativas específicas.
- Arquitetura: host autoritativo. O anfitrião embaralha, valida turno e carta, aplica a troca e transmite apenas a mão de cada jogador.
- Topologia: estrela, com todos os clientes conectados ao anfitrião.
- Persistência: serviço isolado. O protótipo web usa `localStorage`; o adaptador Android em `src/services/database/sqlite.ts` usa `@capacitor-community/sqlite` com as tabelas `partidas` e `participantes`.
- Bluetooth: decisão pendente de prova de conceito. O plugin só será aprovado se suportar anunciar/aceitar conexões como periférico e conectar como central. O simulador local não é evidência de compatibilidade nativa.
- Reconexão: o contrato já reserva `RECONEXAO`; até a prova em dois aparelhos, uma queda deve marcar a partida como interrompida e salvar o registro.
