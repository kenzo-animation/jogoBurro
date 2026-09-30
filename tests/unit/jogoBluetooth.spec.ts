import { describe, expect, it } from 'vitest';
import { JogoBluetoothHost } from '@/services/bluetooth/jogoBluetooth';
import { criarMensagem, desserializarMensagem, serializarMensagem } from '@/types/bluetooth';

describe('host Bluetooth autoritativo', () => {
  it('aceita jogadores, inicia e envia apenas a mão do destinatário', async () => {
    const enviados: Array<{ deviceId: string; texto: string }> = [];
    const host = new JogoBluetoothHost('Ana', { enviar: async (deviceId, texto) => enviados.push({ deviceId: deviceId || 'host', texto }) }, 'partida-teste');
    await host.receber('device-bia', serializarMensagem(criarMensagem('SOLICITAR_ENTRADA', 'partida-teste', 'jogador-bia', { nome: 'Bia' })));
    await host.iniciar();

    const estadosBia = enviados.filter((item) => item.deviceId === 'device-bia')
      .map((item) => desserializarMensagem(item.texto))
      .filter((mensagem) => mensagem?.tipo === 'TROCA_REALIZADA');
    expect(host.sala.map((jogador) => jogador.nome)).toEqual(['Ana', 'Bia']);
    expect(estadosBia).toHaveLength(1);
    expect(estadosBia[0]?.payload.mao).toHaveLength(4);
    expect(estadosBia[0]?.payload.mao).toEqual(host.estado?.jogadores[1].mao);
  });

  it('recusa entrada depois do início e ignora partida ou formato inválido', async () => {
    const enviados: string[] = [];
    const host = new JogoBluetoothHost('Ana', { enviar: async (_, texto) => enviados.push(texto) }, 'partida-teste');
    await host.receber('device-bia', serializarMensagem(criarMensagem('SOLICITAR_ENTRADA', 'partida-teste', 'jogador-bia', { nome: 'Bia' })));
    await host.iniciar();
    await host.receber('device-caio', serializarMensagem(criarMensagem('SOLICITAR_ENTRADA', 'partida-teste', 'jogador-caio', { nome: 'Caio' })));
    await host.receber('device-duda', '{invalido');
    const resposta = enviados.map((texto) => desserializarMensagem(texto)).find((mensagem) => mensagem?.tipo === 'RESPOSTA_ENTRADA' && mensagem.jogadorId === 'jogador-caio');
    expect(resposta?.payload.aceita).toBe(false);
    expect(host.sala).toHaveLength(2);
  });
});
