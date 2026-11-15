// Contas do treino, sem tela e sem servidor (dá para testar com node --test).

/** "42,5" ou "42.5" → 42.5; vazio → null. */
export function lerNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** 42.5 → "42,5"; 40 → "40". */
export function kg(n) {
  if (n === null || n === undefined) return '–';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/**
 * Repetições planejadas para cada série a partir do texto da ficha.
 * "6 / 8 / 12" → [6, 8, 12]; "15" → [15, 15, 15]; "10 + 10" → [10, 10, 10]; "Máxima" → [null...]
 */
export function repsPorSerie(texto, series) {
  const n = Math.max(1, series || 1);
  const t = String(texto || '').trim();
  const partes = t.split('/').map((p) => p.trim()).filter(Boolean);
  if (partes.length > 1) {
    return Array.from({ length: n }, (_, i) => primeiroInteiro(partes[Math.min(i, partes.length - 1)]));
  }
  const unico = primeiroInteiro(t);
  return Array.from({ length: n }, () => unico);
}

function primeiroInteiro(t) {
  if (/min|seg|\bs\b/i.test(t)) return null; // tempo, não repetições
  const m = String(t).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Séries da última vez que o exercício foi feito (mais recente primeiro). */
export function ultimaVez(historico, exercicioId) {
  const sessoes = [...historico.sessoes].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  for (const s of sessoes) {
    const ser = historico.series
      .filter((x) => x.sessao_id === s.id && x.exercicio_id === exercicioId)
      .sort((a, b) => a.ordem - b.ordem);
    if (ser.length) return { sessao: s, series: ser };
  }
  return null;
}

/** Monta as séries do treino de hoje, já preenchidas com o que faz sentido. */
export function planejarSeries(item, ultima) {
  const reps = repsPorSerie(item.reps_atuais || item.reps_prescritas, item.series);
  return reps.map((r, i) => {
    const antes = ultima && ultima.series[i] ? ultima.series[i] : null;
    const carga = antes && antes.carga_kg != null ? antes.carga_kg : item.carga_atual_kg ?? item.carga_prescrita_kg ?? null;
    return {
      carga: carga,
      reps: antes && antes.reps != null ? antes.reps : r,
      antes: antes ? { carga: antes.carga_kg, reps: antes.reps } : null,
      feita: false,
    };
  });
}

/** Ao terminar o exercício: sugere subir a carga atual (ou a meta de repetições) da ficha. */
export function sugestaoProgresso(item, series) {
  const feitas = series.filter((s) => s.feita);
  if (!feitas.length) return null;
  const maior = Math.max(...feitas.map((s) => s.carga ?? 0));
  const base = item.carga_atual_kg ?? item.carga_prescrita_kg ?? 0;
  if (maior > 0 && maior > base) return { campo: 'carga_atual_kg', valor: maior, anterior: base || null };
  const metaReps = repsPorSerie(item.reps_atuais || item.reps_prescritas, item.series);
  const subiuReps = feitas.length === series.length && feitas.every((s, i) => s.reps != null && metaReps[i] != null && s.reps > metaReps[i]);
  if (subiuReps && maior === base) {
    return { campo: 'reps_atuais', valor: feitas.map((s) => s.reps).join(' / '), anterior: item.reps_atuais || item.reps_prescritas || null };
  }
  return null;
}

/** Próxima ficha: a que vem depois da última feita, na ordem das fichas ativas. */
export function proximaFicha(fichas, historico) {
  const ativas = fichas.filter((f) => f.ativa).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  if (!ativas.length) return null;
  const ultima = [...historico.sessoes].filter((s) => s.ficha_id).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
  if (!ultima) return ativas[0];
  const i = ativas.findIndex((f) => f.id === ultima.ficha_id);
  return i < 0 ? ativas[0] : ativas[(i + 1) % ativas.length];
}

/** Força estimada para 1 repetição (fórmula de Epley). Só com 1 a 12 repetições. */
export function umaRepeticao(carga, reps) {
  if (!carga || !reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? carga : Math.round(carga * (1 + reps / 30) * 10) / 10;
}

/**
 * Pontos do gráfico de um exercício: um por sessão.
 * medida: 'carga' (maior carga) ou '1rm' (maior 1RM estimado).
 * desdeIso: corta o que for mais antigo (plano grátis: último mês).
 */
export function pontosExercicio(historico, exercicioId, medida = 'carga', desdeIso = null) {
  const porSessao = new Map();
  for (const s of historico.series) {
    if (s.exercicio_id !== exercicioId || s.carga_kg == null) continue;
    const v = medida === '1rm' ? umaRepeticao(s.carga_kg, s.reps) : s.carga_kg;
    if (v == null) continue;
    const atual = porSessao.get(s.sessao_id);
    if (!atual || v > atual.valor) porSessao.set(s.sessao_id, { valor: v, carga: s.carga_kg, reps: s.reps });
  }
  const sessoes = new Map(historico.sessoes.map((s) => [s.id, s]));
  return [...porSessao.entries()]
    .map(([id, p]) => ({ data: sessoes.get(id)?.inicio, ...p }))
    .filter((p) => p.data && (!desdeIso || p.data >= desdeIso))
    .sort((a, b) => (a.data < b.data ? -1 : 1));
}

/** Recordes: maior carga já usada em cada exercício. */
export function recordes(historico) {
  const sessoes = new Map(historico.sessoes.map((s) => [s.id, s]));
  const r = new Map();
  for (const s of historico.series) {
    if (s.carga_kg == null || !sessoes.has(s.sessao_id)) continue;
    const atual = r.get(s.exercicio_id);
    if (!atual || s.carga_kg > atual.carga) r.set(s.exercicio_id, { carga: s.carga_kg, reps: s.reps, data: sessoes.get(s.sessao_id).inicio });
  }
  return r;
}

/** ID de vídeo do YouTube a partir do link (mesma regra do servidor). */
export function idYoutube(url) {
  const m = String(url || '').trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/);
  return m ? m[1] : null;
}

export function novoId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-');
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const data = (iso) => (iso ? fmtData.format(new Date(iso)) : '');
export const dataCurta = (iso) => (iso ? fmtCurta.format(new Date(iso)) : '');
export const hora = (iso) => (iso ? fmtHora.format(new Date(iso)) : '');

export function duracao(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
