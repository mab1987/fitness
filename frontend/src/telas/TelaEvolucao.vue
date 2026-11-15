<script setup>
import { ref, computed, watch } from 'vue';
import { treinos, exercicioPorId, comentar, marcarComentariosVistos } from '../servicos/treinos.js';
import { sessao } from '../servicos/sessao.js';
import Comentarios from '../componentes/Comentarios.vue';
import { pontosExercicio, recordes, kg, data, hora, treinosPorSemana, volumePorGrupo, dataCurta } from '../servicos/calculos.js';
import PainelMedidas from '../componentes/PainelMedidas.vue';
import BotoesExportar from '../componentes/BotoesExportar.vue';
import GraficoLinha from '../componentes/GraficoLinha.vue';

const premium = computed(() => treinos.limites.plano === 'premium');
const semanas = computed(() => treinosPorSemana(treinos.historico.sessoes, premium.value ? 12 : 4));
const maxSemana = computed(() => Math.max(1, ...semanas.value.map((s) => s.treinos)));
const volume = computed(() => {
  if (!premium.value) return [];
  const agora = Date.now();
  const iso = (dias) => new Date(agora - dias * 864e5).toISOString();
  const atual = volumePorGrupo(treinos.historico, exercicioPorId.value, iso(30), iso(-1));
  const antes = volumePorGrupo(treinos.historico, exercicioPorId.value, iso(60), iso(30));
  const grupos = [...new Set([...atual.keys(), ...antes.keys()])];
  return grupos.map((g) => {
    const a = atual.get(g) || 0;
    const b = antes.get(g) || 0;
    return { grupo: g, atual: a, antes: b, variacao: b ? Math.round(((a - b) / b) * 100) : null };
  }).sort((x, y) => y.atual - x.atual);
});
const toneladas = (v) => (v >= 1000 ? kg(Math.round(v / 100) / 10) + ' t' : kg(Math.round(v)) + ' kg');
const exercicioId = ref('');
const medida = ref('carga');
const periodo = ref(90);
const mostrar = ref(20);
const abertos = ref(new Set());

// Exercícios com registro, os mais feitos primeiro.
const feitos = computed(() => {
  const cont = new Map();
  for (const s of treinos.historico.series) if (s.carga_kg != null) cont.set(s.exercicio_id, (cont.get(s.exercicio_id) || 0) + 1);
  return [...cont.entries()]
    .map(([id, n]) => ({ id, n, nome: exercicioPorId.value.get(id)?.nome || 'Exercício removido' }))
    .sort((a, b) => b.n - a.n);
});
watch(feitos, (l) => { if (l.length && !l.some((e) => e.id === exercicioId.value)) exercicioId.value = l[0].id; }, { immediate: true });

const diasGrafico = computed(() => (premium.value ? periodo.value : treinos.limites.dias_grafico || 30));
const desde = computed(() => (diasGrafico.value ? new Date(Date.now() - diasGrafico.value * 864e5).toISOString() : null));
const pontos = computed(() => (exercicioId.value ? pontosExercicio(treinos.historico, exercicioId.value, premium.value ? medida.value : 'carga', desde.value) : []));
const titulo = computed(() => `${medida.value === '1rm' && premium.value ? '1RM estimado' : 'Maior carga'} · ${exercicioPorId.value.get(exercicioId.value)?.nome || ''}`);
const textoVazio = computed(() =>
  premium.value && medida.value === '1rm'
    ? 'Sem séries com repetições registradas neste período. O 1RM aparece quando você anotar as repetições.'
    : 'Sem registros com carga neste período.');
const variacao = computed(() => {
  const p = pontos.value;
  if (p.length < 2) return null;
  return Math.round((p[p.length - 1].valor - p[0].valor) * 100) / 100;
});

const listaRecordes = computed(() => {
  const r = recordes(treinos.historico);
  return feitos.value.slice(0, 12).map((e) => ({ ...e, ...r.get(e.id) })).filter((e) => e.carga);
});

const sessoes = computed(() => [...treinos.historico.sessoes].sort((a, b) => (a.inicio < b.inicio ? 1 : -1)));
const seriesPorSessao = computed(() => {
  const m = new Map();
  for (const s of treinos.historico.series) {
    if (!m.has(s.sessao_id)) m.set(s.sessao_id, []);
    m.get(s.sessao_id).push(s);
  }
  return m;
});
const nomeFicha = (id) => treinos.fichas.find((f) => f.id === id)?.nome || 'Treino';
function detalheSessao(id) {
  const grupos = new Map();
  for (const s of [...(seriesPorSessao.value.get(id) || [])].sort((a, b) => a.ordem - b.ordem)) {
    if (!grupos.has(s.exercicio_id)) grupos.set(s.exercicio_id, []);
    grupos.get(s.exercicio_id).push(s);
  }
  return [...grupos.entries()].map(([exId, ser]) => ({
    nome: exercicioPorId.value.get(exId)?.nome || 'Exercício',
    texto: ser.map((s) => (s.carga_kg == null ? '–' : kg(s.carga_kg)) + (s.reps ? '×' + s.reps : '')).join(' · '),
  }));
}
function alternar(id) {
  const s = new Set(abertos.value);
  s.has(id) ? s.delete(id) : s.add(id);
  abertos.value = s;
  if (s.has(id) && comentariosDe(id).some((c) => !c.visto && c.autor_id !== sessao.perfil?.id)) marcarComentariosVistos().catch(() => {});
}
const comentariosDe = (id) => treinos.comentarios.filter((c) => c.sessao_id === id);
const novosDe = (id) => comentariosDe(id).filter((c) => !c.visto && c.autor_id !== sessao.perfil?.id).length;
</script>

<template>
  <div class="pilha">
    <h1>Evolução</h1>

    <section class="cartao pilha" aria-labelledby="t-graf">
      <h2 id="t-graf" class="visualmente-oculto">Gráfico</h2>
      <p v-if="!feitos.length" class="vazio">Quando você registrar treinos com carga, a evolução aparece aqui.</p>
      <template v-else>
        <div class="filtros">
          <div class="campo cresce">
            <label for="ex">Exercício</label>
            <select id="ex" v-model="exercicioId"><option v-for="e in feitos" :key="e.id" :value="e.id">{{ e.nome }}</option></select>
          </div>
          <div v-if="premium" class="campo">
            <label for="per">Período</label>
            <select id="per" v-model.number="periodo">
              <option :value="30">30 dias</option><option :value="90">3 meses</option><option :value="365">1 ano</option><option :value="0">Tudo</option>
            </select>
          </div>
          <div v-if="premium" class="campo">
            <span class="rotulo" id="rot-med">Medida</span>
            <div class="segmentado dois" role="group" aria-labelledby="rot-med">
              <button type="button" :aria-pressed="medida === 'carga'" @click="medida = 'carga'">Carga</button>
              <button type="button" :aria-pressed="medida === '1rm'" @click="medida = '1rm'">1RM</button>
            </div>
          </div>
        </div>
        <p class="mudo">
          {{ titulo }}<template v-if="variacao !== null"> · {{ variacao >= 0 ? '+' : '' }}{{ kg(variacao) }} kg no período</template>
        </p>
        <GraficoLinha :pontos="pontos" :titulo="titulo" :vazio="textoVazio" />
        <p v-if="!premium" class="mudo">No plano grátis o gráfico mostra o último mês. O histórico abaixo é completo.</p>
        <p v-else-if="medida === '1rm'" class="mudo">1RM estimado pela fórmula de Epley, só em séries de 1 a 12 repetições com repetições registradas.</p>
      </template>
    </section>

    <section class="cartao pilha" aria-labelledby="t-freq">
      <h2 id="t-freq">Treinos por semana</h2>
      <div class="barras" role="img" :aria-label="'Treinos por semana: ' + semanas.map((s) => s.treinos).join(', ')">
        <div v-for="s in semanas" :key="s.inicio" class="barra">
          <span class="num">{{ s.treinos }}</span>
          <span class="coluna" :style="{ height: (s.treinos / maxSemana) * 80 + 'px' }"></span>
          <span class="mudo dia">{{ dataCurta(s.inicio) }}</span>
        </div>
      </div>
      <p v-if="!premium" class="mudo">No premium: as últimas 12 semanas e o volume por grupo muscular.</p>
    </section>

    <section v-if="premium && volume.length" class="cartao pilha" aria-labelledby="t-vol">
      <h2 id="t-vol">Volume por grupo muscular</h2>
      <p class="mudo">Carga × repetições somadas: últimos 30 dias comparados aos 30 anteriores.</p>
      <div class="rolagem">
        <table>
          <thead><tr><th>Grupo</th><th>Últimos 30 dias</th><th>30 dias antes</th><th>Variação</th></tr></thead>
          <tbody>
            <tr v-for="v in volume" :key="v.grupo">
              <td>{{ v.grupo }}</td><td>{{ toneladas(v.atual) }}</td><td>{{ toneladas(v.antes) }}</td>
              <td>{{ v.variacao == null ? '—' : (v.variacao > 0 ? '+' : '') + v.variacao + '%' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="pilha" aria-labelledby="t-med">
      <h2 id="t-med" class="rotulo-secao">Medidas corporais</h2>
      <PainelMedidas :premium="premium" />
    </section>

    <section v-if="listaRecordes.length" class="pilha" aria-labelledby="t-rec">
      <h2 id="t-rec" class="rotulo-secao">Recordes de carga</h2>
      <div class="grade-recordes">
        <div v-for="r in listaRecordes" :key="r.id" class="cartao recorde">
          <span class="mudo">{{ r.nome }}</span>
          <strong>{{ kg(r.carga) }} kg<template v-if="r.reps"> × {{ r.reps }}</template></strong>
          <span class="mudo pequena">{{ data(r.data) }}</span>
        </div>
      </div>
    </section>

    <section class="pilha" aria-labelledby="t-hist">
      <h2 id="t-hist" class="rotulo-secao">Histórico · {{ sessoes.length }} treinos</h2>
      <div v-for="s in sessoes.slice(0, mostrar)" :key="s.id" class="cartao sessao">
        <button class="cab-sessao" type="button" :aria-expanded="abertos.has(s.id)" @click="alternar(s.id)">
          <span><strong>{{ nomeFicha(s.ficha_id) }}</strong> <span class="mudo">· {{ data(s.inicio) }}, {{ hora(s.inicio) }}</span></span>
          <span class="linha direita">
            <span v-if="novosDe(s.id)" class="selo">{{ novosDe(s.id) }} comentário(s) novo(s)</span>
            <span v-else-if="comentariosDe(s.id).length" class="mudo">{{ comentariosDe(s.id).length }} coment.</span>
            <span class="mudo">{{ (seriesPorSessao.get(s.id) || []).length }} séries</span>
          </span>
        </button>
        <div v-if="abertos.has(s.id)" class="pilha det">
          <p v-for="d in detalheSessao(s.id)" :key="d.nome" class="linha-ex"><span>{{ d.nome }}</span><span class="mudo">{{ d.texto }}</span></p>
          <p v-if="s.observacao" class="mudo">{{ s.observacao }}</p>
          <Comentarios v-if="comentariosDe(s.id).length || treinos.personal" :comentarios="comentariosDe(s.id)" :meu-id="sessao.perfil?.id"
            :enviar="sessao.verComo ? null : (t) => comentar(s.id, t)" :rotulo="treinos.personal ? 'Escrever para ' + treinos.personal.nome : 'Responder'" />
        </div>
      </div>
      <button v-if="sessoes.length > mostrar" class="botao secundario" type="button" @click="mostrar += 30">Mostrar mais</button>
    </section>

    <section class="cartao pilha" aria-labelledby="t-exp">
      <h2 id="t-exp">Exportar</h2>
      <BotoesExportar v-if="premium" />
      <p v-else class="mudo">Exportar para planilha é do <RouterLink to="/premium">premium</RouterLink>. Se precisar de uma cópia dos seus dados, peça ao administrador.</p>
    </section>
  </div>
</template>

<style scoped>
.filtros { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.cresce { flex: 1; min-width: 200px; }
.rotulo { font-size: 14px; font-weight: 600; }
.segmentado.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 160px; }
.barras { display: flex; align-items: flex-end; gap: 6px; height: 130px; }
.barra { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
.coluna { width: 100%; max-width: 36px; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; }
.num { font-size: 12px; font-weight: 600; }
.dia { font-size: 11px; white-space: nowrap; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; }
.grade-recordes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.recorde { display: flex; flex-direction: column; gap: 2px; padding: 12px; }
.recorde strong { font-size: 18px; }
.pequena { font-size: 12px; }
.sessao { padding: 0; }
.cab-sessao {
  width: 100%; display: flex; justify-content: space-between; gap: 8px; align-items: center; text-align: left;
  background: none; border: none; font: inherit; color: var(--text); padding: 14px 16px; cursor: pointer; min-height: 48px;
}
.det { padding: 0 16px 14px; gap: 6px; }
.direita { gap: 8px; flex-shrink: 0; }
.linha-ex { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.linha-ex .mudo { text-align: right; }
</style>
