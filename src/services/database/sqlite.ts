import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { RegistroHistorico } from '@/types/game';

const conexao = new SQLiteConnection(CapacitorSQLite);
let banco: SQLiteDBConnection | undefined;

export async function inicializarBanco(): Promise<SQLiteDBConnection> {
  if (banco) return banco;
  banco = await conexao.createConnection('jogo_burro', false, 'no-encryption', 1, false);
  await banco.open();
  await banco.execute(`
    CREATE TABLE IF NOT EXISTS partidas (
      id TEXT PRIMARY KEY NOT NULL, inicio TEXT NOT NULL, fim TEXT,
      status TEXT NOT NULL, motivo_encerramento TEXT, vencedor TEXT,
      penalizado TEXT, rodadas INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS participantes (
      partida_id TEXT NOT NULL, nome TEXT NOT NULL, ordem INTEGER NOT NULL,
      resultado TEXT NOT NULL, FOREIGN KEY(partida_id) REFERENCES partidas(id)
    );
  `);
  return banco;
}

export async function salvarRegistroNoBanco(registro: RegistroHistorico): Promise<void> {
  const db = await inicializarBanco();
  await db.run('INSERT OR REPLACE INTO partidas (id, inicio, fim, status, motivo_encerramento, vencedor, penalizado, rodadas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [registro.id, registro.inicio, registro.fim || null, registro.status, registro.motivoEncerramento || null, registro.vencedor || null, registro.penalizado || null, registro.rodadas]);
  await db.run('DELETE FROM participantes WHERE partida_id = ?', [registro.id]);
  for (const participante of registro.participantes) {
    await db.run('INSERT INTO participantes (partida_id, nome, ordem, resultado) VALUES (?, ?, ?, ?)', [registro.id, participante.nome, participante.ordem, participante.resultado]);
  }
}

export async function listarRegistrosNoBanco(): Promise<RegistroHistorico[]> {
  const db = await inicializarBanco();
  const partidas = await db.query('SELECT id, inicio, fim, status, motivo_encerramento AS motivoEncerramento, vencedor, penalizado, rodadas FROM partidas ORDER BY inicio DESC');
  const registros: RegistroHistorico[] = [];
  for (const partida of (partidas.values || []) as Array<Omit<RegistroHistorico, 'participantes'>>) {
    registros.push(await buscarRegistroNoBanco(String(partida.id)) as RegistroHistorico);
  }
  return registros;
}

export async function buscarRegistroNoBanco(id: string): Promise<RegistroHistorico | undefined> {
  const db = await inicializarBanco();
  const partida = await db.query('SELECT id, inicio, fim, status, motivo_encerramento AS motivoEncerramento, vencedor, penalizado, rodadas FROM partidas WHERE id = ?', [id]);
  const dados = partida.values?.[0] as Omit<RegistroHistorico, 'participantes'> | undefined;
  if (!dados) return undefined;
  const participantes = await db.query('SELECT nome, ordem, resultado FROM participantes WHERE partida_id = ? ORDER BY ordem', [id]);
  return { ...dados, participantes: (participantes.values || []) as RegistroHistorico['participantes'] };
}

export async function excluirRegistroNoBanco(id: string): Promise<void> {
  const db = await inicializarBanco();
  await db.run('DELETE FROM participantes WHERE partida_id = ?', [id]);
  await db.run('DELETE FROM partidas WHERE id = ?', [id]);
}

export async function limparBanco(): Promise<void> {
  const db = await inicializarBanco();
  await db.execute('DELETE FROM participantes; DELETE FROM partidas;');
}
