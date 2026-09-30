import { completarJogador, criarPartida, trocarCarta } from '@/domain/jogo';
import { criarMensagem, desserializarMensagem, serializarMensagem, type MensagemBluetooth } from '@/types/bluetooth';
import type { Partida } from '@/types/game';

export interface BluetoothGateway {
  enviar(deviceId: string | undefined, texto: string): Promise<void>;
}

export interface JogadorConectado {
  id: string;
  nome: string;
  deviceId: string;
  ordem: number;
  conectado: boolean;
}

export class JogoBluetoothHost {
  readonly partidaId: string;
  readonly hostId: string;
  private readonly gateway: BluetoothGateway;
  private readonly onPartidaEncerrada?: (partida: Partida) => Promise<void> | void;
  private jogadores: JogadorConectado[];
  private partida: Partida | null = null;

  constructor(nomeHost: string, gateway: BluetoothGateway, partidaId = `partida-${Date.now()}`, onPartidaEncerrada?: (partida: Partida) => Promise<void> | void) {
    this.partidaId = partidaId;
    this.hostId = 'anfitriao';
    this.gateway = gateway;
    this.onPartidaEncerrada = onPartidaEncerrada;
    this.jogadores = [{ id: this.hostId, nome: nomeHost.trim(), deviceId: '', ordem: 0, conectado: true }];
  }

  get estado(): Partida | null { return this.partida; }
  get sala(): readonly JogadorConectado[] { return this.jogadores; }

  async receber(deviceId: string, texto: string): Promise<void> {
    const mensagem = desserializarMensagem(texto);
    if (!mensagem || mensagem.partidaId !== this.partidaId) return;
    if (mensagem.tipo === 'SOLICITAR_ENTRADA') return this.solicitarEntrada(deviceId, mensagem);
    if (mensagem.tipo === 'RECONEXAO') return this.reconectar(deviceId, mensagem);
    if (mensagem.tipo === 'JOGADA') return this.jogada(mensagem);
    if (mensagem.tipo === 'JOGADOR_COMPLETOU') return this.completou(mensagem);
  }

  async iniciar(): Promise<void> {
    if (this.partida) return;
    if (this.jogadores.length < 2) throw new Error('A sala precisa de pelo menos dois jogadores.');
    this.partida = criarPartida(this.jogadores.map((jogador) => jogador.nome), undefined, this.jogadores.map((jogador) => jogador.id));
    await this.broadcast('INICIAR_PARTIDA', { jogadores: this.jogadores.map((jogador) => jogador.id) });
    await this.enviarEstadosPrivados();
  }

  async marcarDesconexao(deviceId: string): Promise<void> {
    const jogador = this.jogadores.find((item) => item.deviceId === deviceId);
    if (!jogador) return;
    jogador.conectado = false;
    await this.broadcast('SALA_ATUALIZADA', { jogadores: this.resumoSala(), aceita: true });
  }

  private async solicitarEntrada(deviceId: string, mensagem: MensagemBluetooth<'SOLICITAR_ENTRADA'>) {
    const nome = mensagem.payload.nome.trim();
    const podeEntrar = !this.partida && !!nome && this.jogadores.length < 4 && !this.jogadores.some((jogador) => jogador.nome.toLowerCase() === nome.toLowerCase());
    if (!podeEntrar) {
      await this.responder(deviceId, mensagem.jogadorId, { aceita: false, motivo: this.partida ? 'A partida já começou.' : 'Sala cheia ou nome já usado.' });
      return;
    }
    const jogador = { id: mensagem.jogadorId, nome, deviceId, ordem: this.jogadores.length, conectado: true };
    this.jogadores.push(jogador);
    await this.responder(deviceId, jogador.id, { aceita: true, jogadorId: jogador.id });
    await this.broadcast('SALA_ATUALIZADA', { jogadores: this.resumoSala(), aceita: true });
  }

  private async reconectar(deviceId: string, mensagem: MensagemBluetooth<'RECONEXAO'>) {
    const jogador = this.jogadores.find((item) => item.id === mensagem.jogadorId);
    if (!jogador) return;
    jogador.deviceId = deviceId;
    jogador.conectado = true;
    await this.responder(deviceId, jogador.id, { aceita: true, jogadorId: jogador.id });
    if (this.partida) await this.enviarEstadoPara(jogador.id);
    await this.broadcast('SALA_ATUALIZADA', { jogadores: this.resumoSala(), aceita: true });
  }

  private async jogada(mensagem: MensagemBluetooth<'JOGADA'>) {
    if (!this.partida) return;
    try {
      this.partida = trocarCarta(this.partida, mensagem.jogadorId, mensagem.payload.cartaId);
      await this.enviarEstadosPrivados();
    } catch {
      await this.responder(this.deviceDo(mensagem.jogadorId), mensagem.jogadorId, { aceita: false, motivo: 'Jogada inválida ou fora do turno.' });
    }
  }

  private async completou(mensagem: MensagemBluetooth<'JOGADOR_COMPLETOU'>) {
    if (!this.partida || mensagem.payload.jogadorId !== mensagem.jogadorId) return;
    try {
      this.partida = completarJogador(this.partida, mensagem.jogadorId);
      if (this.partida.status === 'finalizada') {
        await this.broadcast('PARTIDA_FINALIZADA', { vencedor: this.partida.jogadores.find((jogador) => jogador.letrasBurro < 5)?.nome, penalizado: this.partida.jogadores.find((jogador) => jogador.letrasBurro >= 5)?.nome, motivo: this.partida.motivoEncerramento || 'Partida finalizada.' });
        await this.onPartidaEncerrada?.(this.partida);
      } else {
        await this.enviarEstadosPrivados();
      }
    } catch {
      await this.responder(this.deviceDo(mensagem.jogadorId), mensagem.jogadorId, { aceita: false, motivo: 'Grupo inválido.' });
    }
  }

  private async enviarEstadosPrivados() {
    if (!this.partida) return;
    for (const jogador of this.partida.jogadores) await this.enviarEstadoPara(jogador.id);
  }

  private async enviarEstadoPara(jogadorId: string) {
    if (!this.partida) return;
    const jogador = this.partida.jogadores.find((item) => item.id === jogadorId);
    if (!jogador) return;
    await this.enviar(this.deviceDo(jogadorId), criarMensagem('TROCA_REALIZADA', this.partidaId, jogadorId, { jogadorAtual: this.partida.jogadores[this.partida.jogadorAtual].id, mao: jogador.mao, rodada: this.partida.rodada }));
  }

  private async responder(deviceId: string | undefined, jogadorId: string, payload: { aceita: boolean; motivo?: string; jogadorId?: string }) {
    await this.enviar(deviceId, criarMensagem('RESPOSTA_ENTRADA', this.partidaId, jogadorId, payload));
  }

  private async broadcast(tipo: 'SALA_ATUALIZADA' | 'INICIAR_PARTIDA' | 'PARTIDA_FINALIZADA' | 'TROCA_REALIZADA', payload: any) {
    const mensagem = criarMensagem(tipo as any, this.partidaId, this.hostId, payload as any);
    for (const jogador of this.jogadores.filter((item) => item.conectado && item.deviceId)) await this.enviar(jogador.deviceId, mensagem);
  }

  private async enviar(deviceId: string | undefined, mensagem: MensagemBluetooth) { if (deviceId) await this.gateway.enviar(deviceId, serializarMensagem(mensagem)); }
  private deviceDo(jogadorId: string) { return this.jogadores.find((item) => item.id === jogadorId)?.deviceId; }
  private resumoSala() { return this.jogadores.map(({ id, nome, ordem, conectado }) => ({ id, nome, ordem, conectado })); }
}
