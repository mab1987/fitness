// Estado de treino do aluno: catálogo, fichas, histórico, treino em andamento e fila para enviar.
// Tudo fica guardado no aparelho; o servidor é atualizado quando houver internet.
import { reactive, computed } from 'vue';
import { api, ErroApi } from './dados.js';
import { sessao } from './sessao.js';
import { ler, gravar, apagarComPrefixo } from './local.js';
import { planejarSeries, ultimaVez, novoId } from './calculos.js';

export const treinos = reactive({
  carregado: false,
  exercicios: [],
  fichas: [],
  limites: { plano: 'gratis', fichas_ativas: 3, dias_grafico: 30, exportar: false },
  historico: { sessoes: [], series: [] },
  historicoEm: null, // hora do servidor da última leitura do histórico
  atual: null, // treino em andamento
  fila: [], // lotes esperando envio
  enviando: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  erro: '',
});

export const pendentes = computed(() => treinos.fila.length);
export const exercicioPorId = computed(() => new Map(treinos.exercicios.map((e) => [e.id, e])));

const chave = (nome) => `u:${sessao.perfil?.id || 'anon'}:${nome}`;
let carregando = null;

/** Abre o que está no aparelho na hora e atualiza com o servidor em seguida. */
export function carregarTreinos(forcar = false) {
  if (carregando && !forcar) return carregando;
  carregando = (async () => {
    if (!treinos.carregado) {
      const [ex, fi, hi, at, fila] = await Promise.all(['exercicios', 'fichas', 'historico', 'atual', 'fila'].map((n) => ler(chave(n))));
      if (ex) treinos.exercicios = ex;
      if (fi) { treinos.fichas = fi.fichas; treinos.limites = fi.limites; }
      if (hi) { treinos.historico = hi.dados; treinos.historicoEm = hi.em; }
      if (!sessao.verComo) { treinos.atual = at || null; treinos.fila = fila || []; }
      treinos.carregado = true;
    }
    await atualizarDoServidor();
  })().finally(() => { carregando = null; });
  return carregando;
}

export async function atualizarDoServidor() {
  treinos.erro = '';
  try {
    await enviarFila();
    const [ex, fi] = await Promise.all([api.listarExercicios(), api.listarFichas()]);
    treinos.exercicios = ex;
    treinos.fichas = fi.fichas;
    treinos.limites = fi.limites;
    await atualizarHistorico();
    if (!sessao.verComo) {
      await gravar(chave('exercicios'), ex);
      await gravar(chave('fichas'), fi);
    }
    treinos.online = true;
  } catch (e) {
    if (e instanceof ErroApi && e.codigo === 'SEM_CONEXAO') treinos.online = false;
    else treinos.erro = e.message;
  }
}

async function atualizarHistorico() {
  // Primeira vez: tudo. Depois: só o que mudou.
  const desde = treinos.historicoEm && !sessao.verComo ? treinos.historicoEm : null;
  const h = await api.listarHistorico(desde ? { desde } : {});
  if (!desde) {
    treinos.historico = { sessoes: h.sessoes, series: h.series };
  } else {
    treinos.historico = {
      sessoes: mesclar(treinos.historico.sessoes, h.sessoes),
      series: mesclar(treinos.historico.series, h.series),
    };
  }
  treinos.historicoEm = h.servidor_em;
  if (!sessao.verComo) await gravar(chave('historico'), { dados: treinos.historico, em: treinos.historicoEm });
}

/** Junta pela id; registros excluídos saem da lista. */
function mesclar(lista, novos) {
  const m = new Map(lista.map((x) => [x.id, x]));
  for (const n of novos) {
    if (n.excluido_em) m.delete(n.id);
    else m.set(n.id, n);
  }
  return [...m.values()];
}

// ---------- fichas (precisam de internet: o limite do plano é conferido no servidor) ----------

export async function salvarFicha(ficha, itens) {
  await api.salvarFicha({ ficha, itens });
  await atualizarDoServidor();
}

export async function excluirFicha(id) {
  await api.excluirFicha({ id });
  await atualizarDoServidor();
}

export async function criarExercicio(dados) {
  const e = await api.criarExercicio(dados);
  treinos.exercicios = [...treinos.exercicios, e].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  await gravar(chave('exercicios'), treinos.exercicios);
  return e;
}

// ---------- treino em andamento (funciona sem internet) ----------

export async function iniciarTreino(ficha) {
  if (sessao.verComo) throw new Error('No modo "ver como" não dá para registrar treino.');
  if (treinos.atual) return treinos.atual;
  treinos.atual = {
    id: novoId(),
    ficha_id: ficha.id,
    nome: ficha.nome,
    inicio: new Date().toISOString(),
    exercicios: ficha.itens.map((item) => ({
      item_id: item.id,
      exercicio_id: item.exercicio_id,
      series: planejarSeries(item, ultimaVez(treinos.historico, item.exercicio_id)).map((s) => ({ ...s, id: novoId() })),
      concluido: false,
      ajuste: null, // { campo, valor, anterior, aceito }
    })),
    descanso: null, // { fim: ms, total: seg }
  };
  await guardarAtual();
  return treinos.atual;
}

export function guardarAtual() {
  return gravar(chave('atual'), treinos.atual);
}

export async function descartarTreino() {
  treinos.atual = null;
  await gravar(chave('atual'), null);
}

/** Fecha o treino: vira um lote na fila, entra no histórico do aparelho e tenta enviar. */
export async function finalizarTreino(observacao = '') {
  const t = treinos.atual;
  if (!t) return null;
  const fim = new Date().toISOString();
  const series = [];
  t.exercicios.forEach((ex, i) => {
    ex.series.forEach((s, j) => {
      if (!s.feita) return;
      series.push({ id: s.id, sessao_id: t.id, exercicio_id: ex.exercicio_id, ordem: (i + 1) * 100 + j + 1, tipo: 'normal', reps: s.reps ?? null, carga_kg: s.carga ?? null });
    });
  });
  const ajustes = t.exercicios
    .filter((ex) => ex.ajuste && ex.ajuste.aceito)
    .map((ex) => ({ id: novoId(), ficha_item_id: ex.item_id, campo: ex.ajuste.campo, valor_novo: ex.ajuste.valor }));
  const sessaoNova = { id: t.id, ficha_id: t.ficha_id, inicio: t.inicio, fim, observacao: String(observacao || '').slice(0, 500) };

  treinos.fila.push({ id: novoId(), sessoes: [sessaoNova], series, ajustes });
  treinos.historico = {
    sessoes: mesclar(treinos.historico.sessoes, [{ ...sessaoNova, aluno_id: sessao.perfil?.id }]),
    series: mesclar(treinos.historico.series, series),
  };
  // A ficha já mostra a carga nova, mesmo antes de enviar.
  for (const a of ajustes) {
    for (const f of treinos.fichas) {
      const it = f.itens.find((x) => x.id === a.ficha_item_id);
      if (it) it[a.campo] = a.valor_novo;
    }
  }
  treinos.atual = null;
  await Promise.all([
    gravar(chave('fila'), treinos.fila),
    gravar(chave('atual'), null),
    gravar(chave('historico'), { dados: treinos.historico, em: treinos.historicoEm }),
    gravar(chave('fichas'), { fichas: treinos.fichas, limites: treinos.limites }),
  ]);
  enviarFila().catch(() => {});
  return { series: series.length, ajustes: ajustes.length };
}

/** Envia os lotes guardados, um por vez. Para no primeiro problema de conexão e tenta depois. */
export async function enviarFila() {
  if (treinos.enviando || !treinos.fila.length || sessao.verComo) return;
  treinos.enviando = true;
  try {
    while (treinos.fila.length) {
      const lote = treinos.fila[0];
      try {
        await api.sincronizarTreino({ sessoes: lote.sessoes, series: lote.series, ajustes: lote.ajustes });
      } catch (e) {
        if (e instanceof ErroApi && ['SEM_CONEXAO', 'OCUPADO', 'RESPOSTA_INVALIDA', 'ERRO_INTERNO'].includes(e.codigo)) {
          treinos.online = e.codigo !== 'SEM_CONEXAO';
          throw e;
        }
        // Recusado pelo servidor (dado inválido): guarda à parte para não travar a fila.
        const recusados = (await ler(chave('recusados'))) || [];
        recusados.push({ lote, erro: e.message, em: new Date().toISOString() });
        await gravar(chave('recusados'), recusados);
        treinos.erro = 'Um treino não pôde ser enviado: ' + e.message;
      }
      treinos.fila.shift();
      await gravar(chave('fila'), treinos.fila);
      treinos.online = true;
    }
  } finally {
    treinos.enviando = false;
  }
}

/** Ao sair da conta: limpa o que é desta pessoa no aparelho. */
export async function limparDoAparelho() {
  const prefixo = chave('');
  Object.assign(treinos, {
    carregado: false, exercicios: [], fichas: [], historico: { sessoes: [], series: [] },
    historicoEm: null, atual: null, fila: [], erro: '',
  });
  await apagarComPrefixo(prefixo);
}

/** O modo "ver como" usa os dados do admin só na memória; ao sair dele, recarrega. */
export function recarregarTudo() {
  treinos.carregado = false;
  treinos.historicoEm = null;
  return carregarTreinos(true);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { treinos.online = true; enviarFila().catch(() => {}); });
  window.addEventListener('offline', () => { treinos.online = false; });
}
