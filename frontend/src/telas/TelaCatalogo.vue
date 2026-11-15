<script setup>
// Admin: catálogo geral + propostas. Personal: os próprios exercícios, com o botão de propor.
import { ref, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin } from '../servicos/sessao.js';
import { idYoutube } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';

const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const lista = ref([]);
const erro = ref('');
const ok = ref('');
const busca = ref('');
const filtro = ref('geral');
const editando = ref(null);
const novo = ref(null);
async function criar() {
  erro.value = ''; ok.value = '';
  if (novo.value.video_url && !idYoutube(novo.value.video_url)) { erro.value = 'Use um link do YouTube.'; return; }
  try {
    await api.criarExercicio({ ...novo.value, global: adminReal.value });
    ok.value = `"${novo.value.nome}" criado.`;
    novo.value = null;
    await carregar();
  } catch (x) { erro.value = x.message; }
}

async function carregar() {
  erro.value = '';
  try {
    if (adminReal.value) lista.value = await api.catalogo();
    else lista.value = (await api.listarExercicios()).filter((e) => e.criado_por === sessao.perfil?.id);
  } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

const propostas = computed(() => lista.value.filter((e) => e.status === 'proposto'));
const visiveis = computed(() => {
  const q = busca.value.trim().toLowerCase();
  let l = lista.value;
  if (adminReal.value) l = filtro.value === 'geral' ? l.filter((e) => e.global) : l.filter((e) => !e.global);
  return l.filter((e) => !q || (e.nome + ' ' + (e.grupo_muscular || '')).toLowerCase().includes(q));
});

function editar(e) { editando.value = { id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular || '', equipamento: e.equipamento || '', video_url: e.video_url || '', global: !!e.global }; }
async function salvar() {
  erro.value = ''; ok.value = '';
  const e = editando.value;
  if (e.video_url && !idYoutube(e.video_url)) { erro.value = 'Use um link do YouTube.'; return; }
  try {
    if (adminReal.value) await api.atualizarExercicioAdmin(e);
    else await api.atualizarExercicio({ id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular, equipamento: e.equipamento, video_url: e.video_url });
    ok.value = 'Exercício salvo.';
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
const STATUS = { proposto: 'aguardando o administrador', recusado: 'recusado' };
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>{{ adminReal ? 'Catálogo de exercícios' : 'Meus exercícios' }}</h1>
    <p v-if="!adminReal" class="mudo">Exercícios que você criou ficam só para você e seus alunos. Proponha os que valem para todo mundo: o administrador decide se entram no catálogo geral.</p>
    <Aviso :texto="erro" />
    <Aviso tipo="sucesso" :texto="ok" />

    <section v-if="adminReal && propostas.length" class="cartao pilha" aria-labelledby="t-prop">
      <h2 id="t-prop">Propostas ({{ propostas.length }})</h2>
      <div v-for="e in propostas" :key="e.id" class="linha item">
        <div class="cresce"><strong>{{ e.nome }}</strong><p class="mudo">{{ e.grupo_muscular }} · proposto por {{ e.autor_nome }}<template v-if="e.video_url"> · com vídeo</template></p></div>
        <button class="botao pequeno" type="button" @click="decidir(e, true)">Aceitar</button>
        <button class="botao secundario pequeno" type="button" @click="decidir(e, false)">Recusar</button>
      </div>
    </section>

    <button v-if="!novo" class="botao secundario" type="button" style="align-self: flex-start" :disabled="!!sessao.verComo" @click="novo = { nome: '', grupo_muscular: '', equipamento: '', video_url: '' }">Novo exercício</button>
    <form v-else class="cartao pilha" @submit.prevent="criar">
      <h2>Novo exercício{{ adminReal ? ' no catálogo geral' : '' }}</h2>
      <div class="grade-campos">
        <div class="campo"><label for="nv-n">Nome</label><input id="nv-n" v-model="novo.nome" maxlength="80" /></div>
        <div class="campo"><label for="nv-g">Grupo muscular</label><input id="nv-g" v-model="novo.grupo_muscular" maxlength="40" /></div>
        <div class="campo"><label for="nv-e">Equipamento</label><input id="nv-e" v-model="novo.equipamento" maxlength="40" /></div>
      </div>
      <div class="campo"><label for="nv-v">Vídeo do YouTube (opcional)</label><input id="nv-v" v-model="novo.video_url" type="url" maxlength="300" /></div>
      <div class="linha"><button class="botao" type="submit">Criar</button><button class="botao secundario" type="button" @click="novo = null">Cancelar</button></div>
    </form>

    <div class="linha filtros">
      <div v-if="adminReal" class="segmentado dois" role="group" aria-label="Quais exercícios">
        <button type="button" :aria-pressed="filtro === 'geral'" @click="filtro = 'geral'">Catálogo geral</button>
        <button type="button" :aria-pressed="filtro === 'proprios'" @click="filtro = 'proprios'">Criados por pessoas</button>
      </div>
      <label class="visualmente-oculto" for="busca-cat">Buscar</label>
      <input id="busca-cat" v-model="busca" class="entrada cresce" type="search" placeholder="Buscar por nome ou grupo muscular" />
    </div>

    <div v-if="editando" class="cartao pilha" role="dialog" aria-label="Editar exercício">
      <h2>Editar exercício</h2>
      <div class="grade-campos">
        <div class="campo"><label for="ed-n">Nome</label><input id="ed-n" v-model="editando.nome" maxlength="80" /></div>
        <div class="campo"><label for="ed-g">Grupo muscular</label><input id="ed-g" v-model="editando.grupo_muscular" maxlength="40" /></div>
        <div class="campo"><label for="ed-e">Equipamento</label><input id="ed-e" v-model="editando.equipamento" maxlength="40" /></div>
      </div>
      <div class="campo"><label for="ed-v">Vídeo do YouTube</label><input id="ed-v" v-model="editando.video_url" type="url" maxlength="300" /></div>
      <label v-if="adminReal" class="linha"><input v-model="editando.global" type="checkbox" style="width: 20px; height: 20px" /> No catálogo geral (todos veem)</label>
      <div class="linha"><button class="botao" type="button" @click="salvar">Salvar</button><button class="botao secundario" type="button" @click="editando = null">Cancelar</button></div>
    </div>

    <div class="cartao rolagem">
      <table>
        <thead><tr><th>Exercício</th><th>Grupo</th><th>Vídeo</th><th v-if="adminReal">Criado por</th><th v-if="adminReal">Em fichas</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in visiveis" :key="e.id">
            <td><strong>{{ e.nome }}</strong><span v-if="e.status" class="mudo"> · {{ STATUS[e.status] || e.status }}</span></td>
            <td>{{ e.grupo_muscular || '—' }}</td>
            <td>{{ e.video_url ? 'sim' : '—' }}</td>
            <td v-if="adminReal">{{ e.autor_nome || '—' }}</td>
            <td v-if="adminReal">{{ e.usos }}</td>
            <td class="acoes">
              <button class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="editar(e)">Editar</button>
              <button v-if="!adminReal && !e.global && e.status !== 'proposto'" class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="propor(e)">Propor</button>
            </td>
          </tr>
          <tr v-if="!visiveis.length"><td :colspan="adminReal ? 6 : 4" class="mudo">Nada por aqui.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.cresce { flex: 1; min-width: 0; }
.item { align-items: flex-start; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.filtros { flex-wrap: wrap; }
.segmentado.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 300px; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 560px; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.acoes { white-space: nowrap; }
</style>
