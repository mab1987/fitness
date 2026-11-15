<script setup>
// Quem escreve programas: administrador (para todos), gerente (para o grupo), personal (para os alunos).
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin, papeisEfetivos } from '../servicos/sessao.js';
import { treinos, carregarTreinos, exercicioPorId } from '../servicos/treinos.js';
import { novoId } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';
import { GRUPOS_MUSCULARES } from '../servicos/grupos.js';

const programas = ref([]);
const grupos = ref([]);
const msg = reactive({ erro: '', ok: '' });
const ed = ref(null); // programa em edição
const busca = reactive({});
const confirmar = ref(null);
const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const gerencio = computed(() => grupos.value.filter((g) => g.meu_papel === 'gerente' || adminReal.value));
const opcoesPublico = computed(() => {
  const l = [];
  if (adminReal.value) l.push(['todos', 'Todos os usuários']);
  if (gerencio.value.length) l.push(['grupo', 'Um grupo']);
  if (papeisEfetivos.value.includes('personal') || adminReal.value) l.push(['privado', 'Só para aplicar nos meus alunos']);
  return l;
});
const NIVEIS = [['', '—'], ['iniciante', 'Iniciante'], ['intermediario', 'Intermediário'], ['avancado', 'Avançado']];
const PUBLICO = { todos: 'para todos', grupo: 'para o grupo', privado: 'privado' };

async function carregar() {
  try {
    [programas.value, grupos.value] = await Promise.all([api.meusProgramas(), api.listarGrupos()]);
  } catch (e) { msg.erro = e.message; }
}
onMounted(() => { carregarTreinos(); carregar(); });

function novo() {
  ed.value = {
    id: novoId(), nome: '', descricao: '', objetivo: '', nivel: '', dias_semana: 3, semanas: null,
    publico: opcoesPublico.value[0]?.[0] || 'privado', grupo_id: gerencio.value[0]?.id || '', gratis: false, publicado: true,
    fichas: [{ id: novoId(), nome: 'Treino A', itens: [] }],
  };
  msg.erro = ''; msg.ok = '';
}
function editar(p) {
  ed.value = JSON.parse(JSON.stringify({ ...p, fichas: p.fichas.map((f) => ({ ...f, itens: f.itens || [] })) }));
  msg.erro = ''; msg.ok = '';
}
function normal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
const grupoDe = reactive({});
function resultados(f) {
  const q = normal(busca[f.id]);
  const g = grupoDe[f.id];
  if (!q && !g) return [];
  return treinos.exercicios.filter((e) => (ed.value.publico === 'privado' || e.global) && (!g || e.grupo_muscular === g) && (!q || q.split(/\s+/).every((w) => normal([e.nome, e.grupo_muscular, e.equipamento].join(' ')).includes(w)))).slice(0, q ? 12 : 40);
}
function adicionar(f, e) {
  f.itens.push({ id: novoId(), exercicio_id: e.id, series: 3, reps_prescritas: '12', descanso_seg: 60, metodo: '', observacoes: '' });
  busca[f.id] = '';
}
function novaFicha() {
  const letra = String.fromCharCode(65 + ed.value.fichas.length);
  ed.value.fichas.push({ id: novoId(), nome: 'Treino ' + letra, itens: [] });
}
const nomeEx = (id) => exercicioPorId.value.get(id)?.nome || 'Exercício';

async function salvar() {
  msg.erro = ''; msg.ok = '';
  const p = ed.value;
  try {
    await api.salvarPrograma({
      programa: { id: p.id, nome: p.nome, descricao: p.descricao, objetivo: p.objetivo, nivel: p.nivel, dias_semana: p.dias_semana || null, semanas: p.semanas || null, publico: p.publico, grupo_id: p.grupo_id, gratis: p.gratis, publicado: p.publicado },
      fichas: p.fichas.map((f) => ({ id: f.id, nome: f.nome, itens: f.itens.map((i) => ({ id: i.id, exercicio_id: i.exercicio_id, series: i.series, reps_prescritas: i.reps_prescritas, descanso_seg: i.descanso_seg, metodo: i.metodo || '', observacoes: i.observacoes || '' })) })),
    });
    msg.ok = `Programa "${p.nome}" salvo.`;
    ed.value = null;
    await carregar();
  } catch (e) { msg.erro = e.message; }
}
async function excluir(p) {
  try { await api.excluirPrograma(p.id); confirmar.value = null; await carregar(); } catch (e) { msg.erro = e.message; }
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <div class="cabecalho-tela">
      <h1>Programas prontos</h1>
      <button v-if="!ed" class="botao" type="button" :disabled="!!sessao.verComo || !opcoesPublico.length" @click="novo">Novo programa</button>
    </div>
    <Aviso :texto="msg.erro" />
    <Aviso tipo="sucesso" :texto="msg.ok" />

    <template v-if="!ed">
      <p v-if="!programas.length" class="cartao vazio">Nenhum programa ainda.</p>
      <div v-for="p in programas" :key="p.id" class="cartao linha item">
        <div class="cresce">
          <strong>{{ p.nome }}</strong>
          <p class="mudo">{{ PUBLICO[p.publico] }}<template v-if="p.publico === 'todos'"> · {{ p.gratis ? 'grátis' : 'premium' }}</template> · {{ p.fichas.length }} ficha(s)<template v-if="!p.publicado"> · rascunho</template></p>
        </div>
        <button class="botao secundario pequeno" type="button" @click="editar(p)">Editar</button>
        <button v-if="confirmar !== p.id" class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="confirmar = p.id">Excluir</button>
        <button v-else class="botao perigo pequeno" type="button" @click="excluir(p)">Confirmar</button>
      </div>
      <p class="mudo">Programas para todos ou para um grupo usam só exercícios do catálogo geral. Personal: para aplicar um programa num aluno, abra o aluno › Fichas › Aplicar programa.</p>
    </template>

    <template v-else>
      <section class="cartao pilha">
        <div class="grade-campos">
          <div class="campo"><label for="p-nome">Nome</label><input id="p-nome" v-model="ed.nome" maxlength="80" placeholder="Iniciante 3x por semana" /></div>
          <div class="campo"><label for="p-obj">Objetivo</label><input id="p-obj" v-model="ed.objetivo" maxlength="60" placeholder="Hipertrofia, saúde…" /></div>
          <div class="campo"><label for="p-niv">Nível</label><select id="p-niv" v-model="ed.nivel"><option v-for="[v, n] in NIVEIS" :key="v" :value="v">{{ n }}</option></select></div>
          <div class="campo"><label for="p-dias">Dias por semana</label><input id="p-dias" v-model.number="ed.dias_semana" type="number" min="1" max="7" /></div>
          <div class="campo"><label for="p-sem">Semanas (opcional)</label><input id="p-sem" v-model.number="ed.semanas" type="number" min="1" max="52" /></div>
        </div>
        <div class="campo"><label for="p-desc">Descrição</label><textarea id="p-desc" v-model="ed.descricao" maxlength="1000" rows="3" placeholder="Para quem é, como progredir, cuidados…"></textarea></div>
        <div class="grade-campos">
          <div class="campo"><label for="p-pub">Quem vê</label><select id="p-pub" v-model="ed.publico"><option v-for="[v, n] in opcoesPublico" :key="v" :value="v">{{ n }}</option></select></div>
          <div v-if="ed.publico === 'grupo'" class="campo"><label for="p-gr">Grupo</label><select id="p-gr" v-model="ed.grupo_id"><option v-for="g in gerencio" :key="g.id" :value="g.id">{{ g.nome }}</option></select></div>
        </div>
        <label v-if="ed.publico === 'todos'" class="linha"><input v-model="ed.gratis" type="checkbox" style="width: 20px; height: 20px" /> Grátis (aparece liberado para quem não é premium)</label>
        <label class="linha"><input v-model="ed.publicado" type="checkbox" style="width: 20px; height: 20px" /> Publicado (desmarque para deixar como rascunho)</label>
      </section>

      <section v-for="(f, fi) in ed.fichas" :key="f.id" class="cartao pilha">
        <div class="linha">
          <div class="campo cresce"><label :for="'fn-' + f.id">Ficha {{ fi + 1 }}</label><input :id="'fn-' + f.id" v-model="f.nome" maxlength="60" /></div>
          <button v-if="ed.fichas.length > 1" class="botao perigo pequeno" type="button" style="align-self: flex-end" @click="ed.fichas.splice(fi, 1)">Remover ficha</button>
        </div>
        <div v-for="(i, k) in f.itens" :key="i.id" class="linha item-ex">
          <span class="cresce"><strong>{{ nomeEx(i.exercicio_id) }}</strong></span>
          <label class="visualmente-oculto" :for="'s-' + i.id">Séries</label><input :id="'s-' + i.id" v-model.number="i.series" class="entrada mini" type="number" min="1" max="20" title="Séries" />
          <span aria-hidden="true">×</span>
          <label class="visualmente-oculto" :for="'r-' + i.id">Repetições</label><input :id="'r-' + i.id" v-model="i.reps_prescritas" class="entrada medio" maxlength="40" placeholder="12" title="Repetições" />
          <label class="visualmente-oculto" :for="'d-' + i.id">Descanso em segundos</label><input :id="'d-' + i.id" v-model.number="i.descanso_seg" class="entrada mini" type="number" min="0" max="1800" title="Descanso (s)" />
          <span class="mudo">s</span>
          <button class="botao secundario icone" type="button" :disabled="k === 0" :aria-label="'Subir ' + nomeEx(i.exercicio_id)" @click="f.itens.splice(k - 1, 2, f.itens[k], f.itens[k - 1])">↑</button>
          <button class="botao perigo icone" type="button" :aria-label="'Remover ' + nomeEx(i.exercicio_id)" @click="f.itens.splice(k, 1)">✕</button>
        </div>
        <div class="linha" style="align-items: flex-end; flex-wrap: wrap">
          <div class="campo cresce"><label :for="'b-' + f.id">Adicionar exercício</label><input :id="'b-' + f.id" v-model="busca[f.id]" type="search" autocomplete="off" placeholder="Buscar no catálogo" /></div>
          <div class="campo"><label :for="'g-' + f.id">Ou por grupo</label><select :id="'g-' + f.id" v-model="grupoDe[f.id]"><option value="">—</option><option v-for="g in GRUPOS_MUSCULARES" :key="g" :value="g">{{ g }}</option></select></div>
        </div>
        <div v-if="resultados(f).length" class="resultados">
          <button v-for="e in resultados(f)" :key="e.id" class="botao secundario pequeno" type="button" @click="adicionar(f, e)">{{ e.nome }}</button>
        </div>
      </section>
      <button class="botao secundario" type="button" style="align-self: flex-start" :disabled="ed.fichas.length >= 14" @click="novaFicha">+ Ficha</button>
      <div class="linha">
        <button class="botao" type="button" :disabled="!!sessao.verComo" @click="salvar">Salvar programa</button>
        <button class="botao secundario" type="button" @click="ed = null">Cancelar</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.cresce { flex: 1; min-width: 0; }
.item { align-items: center; flex-wrap: wrap; }
.item-ex { flex-wrap: wrap; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.mini { width: 72px; height: 40px; }
.medio { width: 120px; height: 40px; }
.icone { width: 40px; height: 40px; padding: 0; }
.resultados { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
