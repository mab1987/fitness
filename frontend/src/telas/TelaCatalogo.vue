<script setup>
// Admin: catálogo geral (com a carga do catálogo base, propostas e junção de repetidos).
// Personal: os próprios exercícios, com o botão de propor.
import { ref, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin } from '../servicos/sessao.js';
import { idYoutube } from '../servicos/calculos.js';
import { GRUPOS_MUSCULARES } from '../servicos/grupos.js';
import Aviso from '../componentes/Aviso.vue';
import { atualizarDoServidor } from '../servicos/treinos.js';

const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const lista = ref([]);
const erro = ref('');
const ok = ref('');
const busca = ref('');
const filtro = ref('geral');
const grupo = ref('');
const editando = ref(null);
const novo = ref(null);
const previa = ref(null);
const confirmar = ref({});
const ocupado = ref(false);
const MECANICA = [['', '—'], ['composto', 'Composto (várias articulações)'], ['isolado', 'Isolado (uma articulação)'], ['cardio', 'Cardio']];
const vazio = () => ({ nome: '', grupo_muscular: '', secundarios: '', equipamento: '', mecanica: '', video_url: '' });
const sem = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function carregar() {
  erro.value = '';
  try {
    if (adminReal.value) lista.value = await api.catalogo();
    else lista.value = (await api.listarExercicios()).filter((e) => e.criado_por === sessao.perfil?.id);
  } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

const propostas = computed(() => lista.value.filter((e) => e.status === 'proposto'));
const gerais = computed(() => lista.value.filter((e) => e.global).length);
const visiveis = computed(() => {
  const q = sem(busca.value.trim());
  let l = lista.value;
  if (adminReal.value) l = filtro.value === 'geral' ? l.filter((e) => e.global) : l.filter((e) => !e.global);
  if (grupo.value) l = l.filter((e) => e.grupo_muscular === grupo.value);
  const palavras = q.split(/\s+/).filter(Boolean);
  return l.filter((e) => { const t = sem([e.nome, e.grupo_muscular, e.equipamento, e.secundarios].join(' ')); return palavras.every((w) => t.includes(w)); });
});
const opcoesJuntar = computed(() => (editando.value ? lista.value.filter((e) => e.global && e.id !== editando.value.id) : []));

async function criar() {
  erro.value = ''; ok.value = '';
  if (novo.value.video_url && !idYoutube(novo.value.video_url)) { erro.value = 'Use um link do YouTube.'; return; }
  try {
    await api.criarExercicio({ ...novo.value, global: adminReal.value });
    ok.value = `"${novo.value.nome}" criado.`;
    novo.value = null;
    await carregar();
    atualizarDoServidor();
  } catch (x) { erro.value = x.message; }
}
function editar(e) {
  editando.value = { id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular || '', secundarios: e.secundarios || '', equipamento: e.equipamento || '', mecanica: e.mecanica || '', video_url: e.video_url || '', global: !!e.global, juntarCom: '' };
  setTimeout(() => document.getElementById('ed-n')?.focus(), 50);
}
async function salvar() {
  erro.value = ''; ok.value = '';
  const e = editando.value;
  if (e.video_url && !idYoutube(e.video_url)) { erro.value = 'Use um link do YouTube.'; return; }
  const campos = { id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular, secundarios: e.secundarios, equipamento: e.equipamento, mecanica: e.mecanica, video_url: e.video_url };
  try {
    if (adminReal.value) await api.atualizarExercicioAdmin({ ...campos, global: e.global });
    else await api.atualizarExercicio(campos);
    ok.value = 'Exercício salvo.';
    editando.value = null;
    await carregar();
  } catch (x) { erro.value = x.message; }
}
async function juntar() {
  erro.value = ''; ok.value = '';
  const e = editando.value;
  const para = lista.value.find((x) => x.id === e.juntarCom);
  try {
    const r = await api.juntarExercicios({ de: e.id, para: e.juntarCom });
    ok.value = `"${e.nome}" foi juntado a "${para.nome}" (${r.ficha_itens} item(ns) de ficha e ${r.series} série(s) passaram para ele).`;
    editando.value = null;
    await carregar();
  } catch (x) { erro.value = x.message; }
}
async function decidir(e, aceitar) {
  erro.value = '';
  try { await api.decidirExercicio({ id: e.id, aceitar }); await carregar(); } catch (x) { erro.value = x.message; }
}
async function propor(e) {
  erro.value = ''; ok.value = '';
  try { await api.proporExercicio(e.id); ok.value = `"${e.nome}" foi enviado para o administrador.`; await carregar(); } catch (x) { erro.value = x.message; }
}
async function verPrevia() {
  erro.value = ''; ocupado.value = true;
  try { previa.value = await api.previaCatalogo(); } catch (x) { erro.value = x.message; } finally { ocupado.value = false; }
}
async function aplicar() {
  erro.value = ''; ok.value = ''; ocupado.value = true;
  try {
    const r = await api.semearCatalogo({ confirmar: Object.keys(confirmar.value).filter((k) => confirmar.value[k]) });
    ok.value = `Catálogo atualizado: ${r.criar} exercício(s) novo(s), ${r.renomear.length} renomeado(s), ${r.juntar.length} juntado(s), ${r.completar} completado(s).`;
    previa.value = null;
    await carregar();
    atualizarDoServidor(); // fichas e editores passam a ver o catálogo novo
  } catch (x) { erro.value = x.message; } finally { ocupado.value = false; }
}
const STATUS = { proposto: 'aguardando o administrador', recusado: 'recusado' };
const TIPO = { composto: 'composto', isolado: 'isolado', cardio: 'cardio' };
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>{{ adminReal ? 'Catálogo de exercícios' : 'Meus exercícios' }}</h1>
    <p v-if="!adminReal" class="mudo">Exercícios que você criou ficam só para você e seus alunos. Proponha os que valem para todo mundo: o administrador decide se entram no catálogo geral.</p>
    <Aviso :texto="erro" />
    <Aviso tipo="sucesso" :texto="ok" />

    <section v-if="adminReal" class="cartao pilha" aria-labelledby="t-base">
      <h2 id="t-base">Catálogo base</h2>
      <p class="mudo">Cerca de 300 exercícios de academia, cada um com o grupo muscular principal, os músculos secundários, o equipamento e o tipo de movimento. Hoje o catálogo geral tem {{ gerais }}. A carga também padroniza os nomes vindos do app antigo, sem perder o histórico.</p>
      <button v-if="!previa" class="botao secundario" type="button" style="align-self: flex-start" :disabled="ocupado || !!sessao.verComo" @click="verPrevia">{{ ocupado ? 'Conferindo…' : 'Ver o que vai mudar' }}</button>
      <div v-else class="pilha">
        <p><strong>{{ previa.criar }}</strong> exercício(s) novo(s) · <strong>{{ previa.renomear.length }}</strong> renomeado(s) · <strong>{{ previa.juntar.length }}</strong> juntado(s) a um igual · <strong>{{ previa.completar }}</strong> com dados completados.</p>
        <details v-if="previa.renomear.length" open>
          <summary>Nomes que mudam</summary>
          <ul class="lista"><li v-for="r in previa.renomear" :key="r.antigo">{{ r.antigo }} → <strong>{{ r.novo }}</strong></li></ul>
        </details>
        <details v-if="previa.juntar.length" open>
          <summary>Exercícios repetidos que viram um só</summary>
          <ul class="lista"><li v-for="r in previa.juntar" :key="r.antigo">{{ r.antigo }} → <strong>{{ r.novo }}</strong></li></ul>
        </details>
        <div v-if="previa.duvidas.length" class="pilha duvidas">
          <p><strong>Confirme:</strong> a planilha antiga não dizia o equipamento. Marque só os que estiverem certos; os outros ficam com o nome atual.</p>
          <label v-for="r in previa.duvidas" :key="r.antigo" class="linha">
            <input v-model="confirmar[r.antigo]" type="checkbox" style="width: 20px; height: 20px" />
            <span>{{ r.antigo }} → <strong>{{ r.novo }}</strong></span>
          </label>
        </div>
        <div class="linha">
          <button class="botao" type="button" :disabled="ocupado" @click="aplicar">{{ ocupado ? 'Aplicando…' : 'Aplicar' }}</button>
          <button class="botao secundario" type="button" @click="previa = null">Cancelar</button>
        </div>
      </div>
    </section>

    <section v-if="adminReal && propostas.length" class="cartao pilha" aria-labelledby="t-prop">
      <h2 id="t-prop">Propostas ({{ propostas.length }})</h2>
      <div v-for="e in propostas" :key="e.id" class="linha item">
        <div class="cresce"><strong>{{ e.nome }}</strong><p class="mudo">{{ e.grupo_muscular }} · proposto por {{ e.autor_nome }}<template v-if="e.video_url"> · com vídeo</template></p></div>
        <button class="botao pequeno" type="button" @click="decidir(e, true)">Aceitar</button>
        <button class="botao secundario pequeno" type="button" @click="decidir(e, false)">Recusar</button>
      </div>
    </section>

    <button v-if="!novo" class="botao secundario" type="button" style="align-self: flex-start" :disabled="!!sessao.verComo" @click="novo = vazio()">Novo exercício</button>
    <form v-else class="cartao pilha" @submit.prevent="criar">
      <h2>Novo exercício{{ adminReal ? ' no catálogo geral' : '' }}</h2>
      <div class="grade-campos">
        <div class="campo"><label for="nv-n">Nome</label><input id="nv-n" v-model="novo.nome" maxlength="80" /></div>
        <div class="campo"><label for="nv-g">Grupo muscular</label><select id="nv-g" v-model="novo.grupo_muscular"><option value="">—</option><option v-for="g in GRUPOS_MUSCULARES" :key="g" :value="g">{{ g }}</option></select></div>
        <div class="campo"><label for="nv-s">Músculos secundários</label><input id="nv-s" v-model="novo.secundarios" maxlength="120" placeholder="Tríceps, Ombros" /></div>
        <div class="campo"><label for="nv-e">Equipamento</label><input id="nv-e" v-model="novo.equipamento" maxlength="40" placeholder="Halteres, Polia…" /></div>
        <div class="campo"><label for="nv-m">Tipo de movimento</label><select id="nv-m" v-model="novo.mecanica"><option v-for="[v, n] in MECANICA" :key="v" :value="v">{{ n }}</option></select></div>
      </div>
      <div class="campo"><label for="nv-v">Vídeo do YouTube (opcional)</label><input id="nv-v" v-model="novo.video_url" type="url" maxlength="300" /></div>
      <div class="linha"><button class="botao" type="submit">Criar</button><button class="botao secundario" type="button" @click="novo = null">Cancelar</button></div>
    </form>

    <div class="linha filtros">
      <div v-if="adminReal" class="segmentado dois" role="group" aria-label="Quais exercícios">
        <button type="button" :aria-pressed="filtro === 'geral'" @click="filtro = 'geral'">Catálogo geral</button>
        <button type="button" :aria-pressed="filtro === 'proprios'" @click="filtro = 'proprios'">Criados por pessoas</button>
      </div>
      <label class="visualmente-oculto" for="grupo-cat">Grupo muscular</label>
      <select id="grupo-cat" v-model="grupo" class="entrada seletor"><option value="">Todos os grupos</option><option v-for="g in GRUPOS_MUSCULARES" :key="g" :value="g">{{ g }}</option></select>
      <label class="visualmente-oculto" for="busca-cat">Buscar</label>
      <input id="busca-cat" v-model="busca" class="entrada cresce" type="search" placeholder="Buscar por nome, músculo ou equipamento" />
    </div>

    <div v-if="editando" class="cartao pilha" role="dialog" aria-label="Editar exercício">
      <h2>Editar exercício</h2>
      <div class="grade-campos">
        <div class="campo"><label for="ed-n">Nome</label><input id="ed-n" v-model="editando.nome" maxlength="80" /></div>
        <div class="campo"><label for="ed-g">Grupo muscular</label><select id="ed-g" v-model="editando.grupo_muscular"><option value="">—</option><option v-for="g in GRUPOS_MUSCULARES" :key="g" :value="g">{{ g }}</option><option v-if="editando.grupo_muscular && !GRUPOS_MUSCULARES.includes(editando.grupo_muscular)" :value="editando.grupo_muscular">{{ editando.grupo_muscular }}</option></select></div>
        <div class="campo"><label for="ed-s">Músculos secundários</label><input id="ed-s" v-model="editando.secundarios" maxlength="120" /></div>
        <div class="campo"><label for="ed-e">Equipamento</label><input id="ed-e" v-model="editando.equipamento" maxlength="40" /></div>
        <div class="campo"><label for="ed-m">Tipo de movimento</label><select id="ed-m" v-model="editando.mecanica"><option v-for="[v, n] in MECANICA" :key="v" :value="v">{{ n }}</option></select></div>
      </div>
      <div class="campo"><label for="ed-v">Vídeo do YouTube</label><input id="ed-v" v-model="editando.video_url" type="url" maxlength="300" /></div>
      <label v-if="adminReal" class="linha"><input v-model="editando.global" type="checkbox" style="width: 20px; height: 20px" /> No catálogo geral (todos veem)</label>
      <div class="linha"><button class="botao" type="button" @click="salvar">Salvar</button><button class="botao secundario" type="button" @click="editando = null">Cancelar</button></div>
      <div v-if="adminReal" class="pilha juntar">
        <div class="campo">
          <label for="ed-j">É o mesmo que outro exercício? Juntar com…</label>
          <select id="ed-j" v-model="editando.juntarCom"><option value="">—</option><option v-for="o in opcoesJuntar" :key="o.id" :value="o.id">{{ o.nome }}</option></select>
          <span class="dica">As fichas, séries e programas passam para o escolhido, e este sai do catálogo.</span>
        </div>
        <button class="botao perigo pequeno" type="button" style="align-self: flex-start" :disabled="!editando.juntarCom" @click="juntar">Juntar</button>
      </div>
    </div>

    <p class="mudo">{{ visiveis.length }} exercício(s)</p>
    <div class="cartao rolagem">
      <table>
        <thead><tr><th>Exercício</th><th>Grupo</th><th>Secundários</th><th>Equipamento</th><th>Tipo</th><th>Vídeo</th><th v-if="adminReal">Em fichas</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in visiveis" :key="e.id">
            <td><strong>{{ e.nome }}</strong><span v-if="e.status && !e.status.startsWith('juntado')" class="mudo"> · {{ STATUS[e.status] || e.status }}</span><span v-if="adminReal && !e.global && e.autor_nome" class="mudo"><br />de {{ e.autor_nome }}</span></td>
            <td>{{ e.grupo_muscular || '—' }}</td>
            <td class="mudo">{{ e.secundarios || '—' }}</td>
            <td>{{ e.equipamento || '—' }}</td>
            <td>{{ TIPO[e.mecanica] || '—' }}</td>
            <td>{{ e.video_url ? 'sim' : '—' }}</td>
            <td v-if="adminReal">{{ e.usos }}</td>
            <td class="acoes">
              <button class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="editar(e)">Editar</button>
              <button v-if="!adminReal && !e.global && e.status !== 'proposto'" class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="propor(e)">Propor</button>
            </td>
          </tr>
          <tr v-if="!visiveis.length"><td :colspan="adminReal ? 8 : 7" class="mudo">Nada por aqui.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.cresce { flex: 1; min-width: 180px; }
.item { align-items: flex-start; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.filtros { flex-wrap: wrap; }
.seletor { width: auto; min-width: 180px; }
.segmentado.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 300px; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 760px; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.acoes { white-space: nowrap; }
.lista { margin: 6px 0 0; padding-left: 20px; font-size: 14px; display: flex; flex-direction: column; gap: 2px; }
summary { cursor: pointer; font-weight: 600; }
.duvidas { padding: 12px; border-radius: 12px; background: var(--track); }
.juntar { padding-top: 12px; border-top: 1px solid var(--line); }
</style>
