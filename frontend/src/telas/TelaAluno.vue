<script setup>
// O personal acompanhando um aluno: treinos com comentários, fichas, ajustes feitos pelo aluno e evolução.
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao } from '../servicos/sessao.js';
import { kg, data, hora, novoId, pontosExercicio, recordes } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';
import EditorFicha from '../componentes/EditorFicha.vue';
import Comentarios from '../componentes/Comentarios.vue';
import GraficoLinha from '../componentes/GraficoLinha.vue';
import PainelMedidas from '../componentes/PainelMedidas.vue';
import BotoesExportar from '../componentes/BotoesExportar.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const d = ref(null);
const erro = ref('');
const aba = ref('treinos');
const fichaAberta = ref(null);
const mostrar = ref(15);
const abertos = ref(new Set());
const exercicioId = ref('');
const confirmarFim = ref(false);
const meuId = computed(() => sessao.perfil?.id);
const programas = ref([]);
const programaId = ref('');
const ok = ref('');
const livres = ref(0);
async function carregarExtras() {
  try {
    const [meus, pub, lic] = await Promise.all([api.meusProgramas(), api.programas(), api.licencasPersonal()]);
    const m = new Map();
    [...meus.filter((p) => p.autor_id === meuId.value), ...pub.filter((p) => !p.bloqueado)].forEach((p) => m.set(p.id, p));
    programas.value = [...m.values()];
    livres.value = lic.saldo.filter((x) => !x.atribuida_a).length;
  } catch { /* opcional */ }
}
async function aplicarPrograma() {
  erro.value = ''; ok.value = '';
  try {
    const r = await api.usarPrograma({ id: programaId.value, aluno_id: props.id });
    ok.value = `${r.fichas} ficha(s) aplicadas${r.arquivadas ? `, ${r.arquivadas} arquivada(s) pelo limite do plano grátis` : ''}.`;
    programaId.value = '';
    await carregar();
  } catch (e) { erro.value = e.message; }
}
async function darPremium() {
  erro.value = ''; ok.value = '';
  try { await api.atribuirLicenca({ aluno_id: props.id }); ok.value = 'Licença premium dada.'; await carregar(); await carregarExtras(); } catch (e) { erro.value = e.message; }
}

async function carregar() {
  erro.value = '';
  try { d.value = await api.lerAluno(props.id); } catch (e) { erro.value = e.message; }
}
onMounted(() => { carregar(); carregarExtras(); });

const exPorId = computed(() => new Map((d.value?.exercicios || []).map((e) => [e.id, e])));
const nomeEx = (id) => exPorId.value.get(id)?.nome || 'Exercício';
const sessoes = computed(() => [...(d.value?.historico.sessoes || [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1)));
const nomeFicha = (id) => d.value?.fichas.find((f) => f.id === id)?.nome || 'Treino';
const seriesDe = (id) => (d.value?.historico.series || []).filter((s) => s.sessao_id === id).sort((a, b) => a.ordem - b.ordem);
function detalhe(id) {
  const g = new Map();
  for (const s of seriesDe(id)) { if (!g.has(s.exercicio_id)) g.set(s.exercicio_id, []); g.get(s.exercicio_id).push(s); }
  return [...g.entries()].map(([ex, l]) => ({ nome: nomeEx(ex), texto: l.map((s) => (s.carga_kg == null ? '–' : kg(s.carga_kg)) + (s.reps ? '×' + s.reps : '')).join(' · ') }));
}
const comentariosDe = (id) => (d.value?.comentarios || []).filter((c) => c.sessao_id === id);
const novosDe = (id) => comentariosDe(id).filter((c) => !c.visto && c.autor_id !== meuId.value).length;
const ajustesNovos = computed(() => (d.value?.ajustes || []).filter((a) => !a.visto_pelo_personal).length);
const comentariosNovos = computed(() => (d.value?.comentarios || []).filter((c) => !c.visto && c.autor_id !== meuId.value).length);

async function alternar(id) {
  const s = new Set(abertos.value);
  s.has(id) ? s.delete(id) : s.add(id);
  abertos.value = s;
  if (s.has(id) && novosDe(id) && !sessao.verComo) {
    try {
      await api.comentariosVistos({ aluno_id: props.id });
      d.value.comentarios = d.value.comentarios.map((c) => (c.autor_id !== meuId.value ? { ...c, visto: true } : c));
    } catch { /* tenta de novo depois */ }
  }
}
async function comentar(sessaoId, texto) {
  const c = await api.criarComentario({ id: novoId(), sessao_id: sessaoId, texto });
  d.value.comentarios = [...d.value.comentarios, c];
}

async function ajustesVistos() {
  try {
    await api.ajustesVistos(props.id);
    d.value.ajustes = d.value.ajustes.map((a) => ({ ...a, visto_pelo_personal: true }));
  } catch (e) { erro.value = e.message; }
}

// fichas
function novaFicha() {
  fichaAberta.value = { id: novoId(), nome: '', ordem: (d.value.fichas.length || 0) + 1, ativa: true, itens: [], _nova: true };
}
async function salvarFicha(ficha, itens) {
  await api.salvarFichaAluno({ aluno_id: props.id, ficha, itens });
  await carregar();
  fichaAberta.value = d.value.fichas.find((f) => f.id === ficha.id) || null;
}
async function excluirFicha() {
  await api.excluirFichaAluno({ aluno_id: props.id, id: fichaAberta.value.id });
  fichaAberta.value = null;
  await carregar();
}
async function criarExercicio(dados) {
  const e = await api.criarExercicio(dados);
  d.value.exercicios = [...d.value.exercicios, e].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return e;
}

// evolução
const feitos = computed(() => {
  const cont = new Map();
  for (const s of d.value?.historico.series || []) if (s.carga_kg != null) cont.set(s.exercicio_id, (cont.get(s.exercicio_id) || 0) + 1);
  return [...cont.entries()].map(([id, n]) => ({ id, n, nome: nomeEx(id) })).sort((a, b) => b.n - a.n);
});
watch(feitos, (l) => { if (l.length && !l.some((e) => e.id === exercicioId.value)) exercicioId.value = l[0].id; });
const pontos = computed(() => (d.value && exercicioId.value ? pontosExercicio(d.value.historico, exercicioId.value) : []));
const listaRecordes = computed(() => {
  if (!d.value) return [];
  const r = recordes(d.value.historico);
  return feitos.value.slice(0, 12).map((e) => ({ ...e, ...r.get(e.id) })).filter((e) => e.carga);
});

async function encerrar() {
  try {
    const alunos = await api.listarAlunos();
    const a = alunos.find((x) => x.id === props.id);
    if (a) await api.encerrarVinculo(a.vinculo_id);
    router.replace('/painel/alunos');
  } catch (e) { erro.value = e.message; }
}
const CAMPOS = { carga_atual_kg: 'Carga', reps_atuais: 'Repetições' };
const valorAjuste = (a, v) => (a.campo === 'carga_atual_kg' && v !== '' ? kg(Number(v)) + ' kg' : v || '—');
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel/alunos">← Meus alunos</RouterLink>
    <Aviso :texto="erro" />
    <p v-if="!d && !erro" class="mudo">Carregando…</p>
    <template v-if="d">
      <div class="cabecalho-tela">
        <div>
          <h1>{{ d.aluno.nome }}</h1>
          <p class="mudo">{{ d.aluno.email }} · {{ d.aluno.plano.tipo === 'premium' ? 'Premium' + (d.aluno.plano.fim ? ' até ' + data(d.aluno.plano.fim) : '') : 'Plano grátis (até 3 fichas ativas)' }}</p>
        </div>
        <button v-if="d.aluno.plano.tipo !== 'premium' && livres" class="botao secundario" type="button" :disabled="!!sessao.verComo" @click="darPremium">Dar premium ({{ livres }} livre{{ livres > 1 ? 's' : '' }})</button>
      </div>

      <Aviso tipo="sucesso" :texto="ok" />
      <div class="abas" role="tablist">
        <button role="tab" type="button" :aria-selected="aba === 'treinos'" @click="aba = 'treinos'">Treinos <span v-if="comentariosNovos" class="selo">{{ comentariosNovos }}</span></button>
        <button role="tab" type="button" :aria-selected="aba === 'fichas'" @click="aba = 'fichas'">Fichas</button>
        <button role="tab" type="button" :aria-selected="aba === 'ajustes'" @click="aba = 'ajustes'">Ajustes <span v-if="ajustesNovos" class="selo">{{ ajustesNovos }}</span></button>
        <button role="tab" type="button" :aria-selected="aba === 'evolucao'" @click="aba = 'evolucao'">Evolução</button>
        <button role="tab" type="button" :aria-selected="aba === 'medidas'" @click="aba = 'medidas'">Medidas</button>
      </div>

      <!-- Treinos -->
      <section v-if="aba === 'treinos'" class="pilha" role="tabpanel">
        <p v-if="!sessoes.length" class="cartao vazio">Ainda sem treinos registrados.</p>
        <div v-for="s in sessoes.slice(0, mostrar)" :key="s.id" class="cartao sessao">
          <button class="cab-sessao" type="button" :aria-expanded="abertos.has(s.id)" @click="alternar(s.id)">
            <span><strong>{{ nomeFicha(s.ficha_id) }}</strong> <span class="mudo">· {{ data(s.inicio) }}, {{ hora(s.inicio) }}</span></span>
            <span class="linha direita">
              <span v-if="novosDe(s.id)" class="selo">{{ novosDe(s.id) }} novo(s)</span>
              <span v-else-if="comentariosDe(s.id).length" class="mudo">{{ comentariosDe(s.id).length }} coment.</span>
              <span class="mudo">{{ seriesDe(s.id).length }} séries</span>
            </span>
          </button>
          <div v-if="abertos.has(s.id)" class="pilha det">
            <p v-for="x in detalhe(s.id)" :key="x.nome" class="linha-ex"><span>{{ x.nome }}</span><span class="mudo">{{ x.texto }}</span></p>
            <p v-if="s.observacao" class="mudo">Aluno: {{ s.observacao }}</p>
            <Comentarios :comentarios="comentariosDe(s.id)" :meu-id="meuId" :enviar="sessao.verComo ? null : (t) => comentar(s.id, t)" rotulo="Comentar este treino" />
          </div>
        </div>
        <button v-if="sessoes.length > mostrar" class="botao secundario" type="button" @click="mostrar += 30">Mostrar mais</button>
      </section>

      <!-- Fichas -->
      <section v-if="aba === 'fichas'" class="pilha" role="tabpanel">
        <template v-if="!fichaAberta">
          <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
            <p class="mudo">{{ d.fichas.filter((f) => f.ativa).length }} ativa(s)<template v-if="d.limites.fichas_ativas !== null"> de {{ d.limites.fichas_ativas }} no plano grátis do aluno</template></p>
            <button class="botao" type="button" :disabled="!!sessao.verComo" @click="novaFicha">Nova ficha</button>
          </div>
          <div v-if="programas.length" class="linha aplicar">
            <div class="campo cresce">
              <label for="prog-al">Aplicar programa pronto</label>
              <select id="prog-al" v-model="programaId"><option value="">Escolha…</option><option v-for="p in programas" :key="p.id" :value="p.id">{{ p.nome }} ({{ p.fichas.length }} fichas)</option></select>
            </div>
            <button class="botao secundario" type="button" :disabled="!programaId || !!sessao.verComo" @click="aplicarPrograma">Aplicar</button>
          </div>
          <button v-for="f in d.fichas" :key="f.id" class="cartao ficha" type="button" @click="fichaAberta = f">
            <span class="linha" style="justify-content: space-between"><strong>{{ f.nome }}</strong>
              <span class="linha" style="gap: 6px"><span v-if="!f.ativa" class="selo neutro">arquivada</span><span class="selo neutro">{{ f.prescrita ? (f.autor_id === meuId ? 'sua' : 'por ' + f.autor_nome) : 'do aluno' }}</span></span>
            </span>
            <span class="mudo">{{ f.itens.length }} exercícios<template v-if="f.itens.length"> · {{ f.itens.map((i) => nomeEx(i.exercicio_id)).join(', ') }}</template></span>
          </button>
        </template>
        <template v-else>
          <button class="botao texto pequeno voltar-ficha" type="button" @click="fichaAberta = null">← Todas as fichas</button>
          <EditorFicha :ficha="fichaAberta" :nova="!!fichaAberta._nova" :exercicios="d.exercicios"
            :pode-editar="!sessao.verComo && (fichaAberta._nova || fichaAberta.pode_editar)"
            :salvar="salvarFicha" :excluir="fichaAberta.autor_id === meuId ? excluirFicha : null" :criar-exercicio="criarExercicio" />
          <p v-if="!fichaAberta._nova && !fichaAberta.pode_editar" class="mudo">Esta ficha foi montada pelo próprio aluno: você vê, mas só ele altera.</p>
        </template>
      </section>

      <!-- Ajustes -->
      <section v-if="aba === 'ajustes'" class="pilha" role="tabpanel">
        <p class="mudo">Mudanças de carga e repetições que o aluno aceitou ao terminar os exercícios.</p>
        <button v-if="ajustesNovos" class="botao secundario pequeno" type="button" style="align-self: flex-start" :disabled="!!sessao.verComo" @click="ajustesVistos">Marcar {{ ajustesNovos }} como vistos</button>
        <p v-if="!d.ajustes.length" class="cartao vazio">Nenhum ajuste ainda.</p>
        <div v-if="d.ajustes.length" class="cartao rolagem">
          <table>
            <thead><tr><th>Data</th><th>Exercício</th><th>Ficha</th><th>O quê</th><th>Antes → agora</th><th></th></tr></thead>
            <tbody>
              <tr v-for="a in d.ajustes" :key="a.id">
                <td>{{ data(a.criado_em) }}</td>
                <td>{{ nomeEx(a.exercicio_id) }}</td>
                <td>{{ a.ficha }}</td>
                <td>{{ CAMPOS[a.campo] || a.campo }}</td>
                <td>{{ valorAjuste(a, a.valor_anterior) }} → <strong>{{ valorAjuste(a, a.valor_novo) }}</strong></td>
                <td><span v-if="!a.visto_pelo_personal" class="selo">novo</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Evolução -->
      <section v-if="aba === 'evolucao'" class="pilha" role="tabpanel">
        <div v-if="feitos.length" class="cartao pilha">
          <div class="campo">
            <label for="ex-al">Exercício</label>
            <select id="ex-al" v-model="exercicioId"><option v-for="e in feitos" :key="e.id" :value="e.id">{{ e.nome }}</option></select>
          </div>
          <GraficoLinha :pontos="pontos" :titulo="'Maior carga · ' + nomeEx(exercicioId)" />
        </div>
        <p v-else class="cartao vazio">Sem registros com carga.</p>
        <div v-if="listaRecordes.length" class="grade-recordes">
          <div v-for="r in listaRecordes" :key="r.id" class="cartao recorde">
            <span class="mudo">{{ r.nome }}</span>
            <strong>{{ kg(r.carga) }} kg<template v-if="r.reps"> × {{ r.reps }}</template></strong>
            <span class="mudo pequena">{{ data(r.data) }}</span>
          </div>
        </div>
      </section>

      <section v-if="aba === 'medidas'" class="pilha" role="tabpanel">
        <PainelMedidas :aluno-id="id" :premium="d.aluno.plano.tipo === 'premium'" />
      </section>

      <div class="cartao"><BotoesExportar :aluno-id="id" /></div>

      <div class="fim-vinculo">
        <button v-if="!confirmarFim" class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="confirmarFim = true">Encerrar acompanhamento</button>
        <div v-else class="linha" role="alert" style="flex-wrap: wrap">
          <span>Encerrar? Você deixa de ver os treinos de {{ d.aluno.nome }}. As fichas ficam com o aluno.</span>
          <button class="botao perigo pequeno" type="button" @click="encerrar">Encerrar</button>
          <button class="botao secundario pequeno" type="button" @click="confirmarFim = false">Voltar</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.abas { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--track); overflow-x: auto; }
.abas button { flex: 1; min-width: 96px; height: 44px; border: none; border-radius: 10px; background: transparent; color: var(--muted); font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.abas button[aria-selected='true'] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
.sessao { padding: 0; }
.cab-sessao { width: 100%; display: flex; justify-content: space-between; gap: 8px; align-items: center; text-align: left; background: none; border: none; font: inherit; color: var(--text); padding: 14px 16px; cursor: pointer; min-height: 48px; }
.det { padding: 0 16px 14px; gap: 6px; }
.linha-ex { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.linha-ex .mudo { text-align: right; }
.direita { gap: 8px; flex-shrink: 0; }
.ficha { display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: var(--text); cursor: pointer; width: 100%; }
.ficha:hover { border-color: var(--accent); }
.selo.neutro { background: var(--track); color: var(--text); }
.voltar-ficha { align-self: flex-start; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 620px; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; }
.grade-recordes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.recorde { display: flex; flex-direction: column; gap: 2px; padding: 12px; }
.recorde strong { font-size: 18px; }
.pequena { font-size: 12px; }
.aplicar { align-items: flex-end; flex-wrap: wrap; }
.cresce { flex: 1; min-width: 200px; }
.fim-vinculo { padding-top: 16px; border-top: 1px solid var(--line); }
</style>
