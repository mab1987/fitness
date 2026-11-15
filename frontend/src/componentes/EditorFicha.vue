<script setup>
// Editor de ficha usado pelo aluno (as próprias fichas) e pelo personal (as fichas que prescreve).
import { ref, reactive, computed, watch } from 'vue';
import { novoId, kg, lerNumero, idYoutube } from '../servicos/calculos.js';
import Aviso from './Aviso.vue';

const props = defineProps({
  ficha: { type: Object, required: true }, // { id, nome, ordem, ativa, itens, prescrita?, autor_nome? }
  nova: { type: Boolean, default: false },
  exercicios: { type: Array, required: true },
  podeEditar: { type: Boolean, default: true },
  salvar: { type: Function, required: true }, // (ficha, itens) => Promise
  excluir: { type: Function, default: null }, // () => Promise
  criarExercicio: { type: Function, required: true }, // (dados) => Promise<exercicio>
  aviso: { type: String, default: '' },
});
const emit = defineEmits(['salvo']);

const METODOS = [
  ['', 'Normal'], ['drop-set', 'Drop-set'], ['rest-pause', 'Rest-pause'], ['bi-set', 'Bi-set'],
  ['tri-set', 'Tri-set'], ['piramide', 'Pirâmide'], ['cluster', 'Cluster'], ['outro', 'Outro'],
];

const dados = reactive({ id: '', nome: '', ordem: 0, ativa: true });
const itens = ref([]);
const busca = ref('');
const novoEx = reactive({ aberto: false, nome: '', grupo_muscular: '', video_url: '' });
const msg = reactive({ erro: '', ok: '' });
const salvando = ref(false);
const confirmarExclusao = ref(false);

watch(() => props.ficha, (f) => {
  if (f.id !== dados.id) { msg.erro = ''; msg.ok = ''; } // outra ficha: limpa avisos; a mesma recarregada após salvar: mantém
  Object.assign(dados, { id: f.id, nome: f.nome || '', ordem: f.ordem || 0, ativa: f.ativa !== false });
  itens.value = (f.itens || []).map((i) => ({ ...i, metodo: i.metodo || '' }));
}, { immediate: true });

const porId = computed(() => new Map(props.exercicios.map((e) => [e.id, e])));
const nomeEx = (id) => porId.value.get(id)?.nome || 'Exercício';
function normal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
const resultados = computed(() => {
  const q = normal(busca.value);
  if (!q) return [];
  return props.exercicios.filter((e) => normal(e.nome).includes(q) || normal(e.grupo_muscular).includes(q)).slice(0, 8);
});
const existeIgual = computed(() => props.exercicios.some((e) => normal(e.nome) === normal(busca.value)));

function adicionar(ex) {
  itens.value.push({
    id: novoId(), exercicio_id: ex.id, series: 3, reps_prescritas: '12', carga_prescrita_kg: null,
    carga_atual_kg: null, reps_atuais: '', descanso_seg: 60, metodo: '', observacoes: '',
  });
  busca.value = '';
}

async function criarEAdicionar() {
  msg.erro = '';
  if (novoEx.video_url && !idYoutube(novoEx.video_url)) { msg.erro = 'Use um link do YouTube (youtube.com ou youtu.be).'; return; }
  try {
    const e = await props.criarExercicio({ nome: novoEx.nome, grupo_muscular: novoEx.grupo_muscular, video_url: novoEx.video_url, global: false });
    adicionar(e);
    Object.assign(novoEx, { aberto: false, nome: '', grupo_muscular: '', video_url: '' });
  } catch (e) {
    msg.erro = e.message;
  }
}

function abrirNovo() { novoEx.nome = busca.value.trim(); novoEx.aberto = true; }
function mover(i, d) {
  const j = i + d;
  if (j < 0 || j >= itens.value.length) return;
  const l = itens.value;
  [l[i], l[j]] = [l[j], l[i]];
}
function numero(item, campo, valor) { item[campo] = lerNumero(valor); }

async function gravar(ativa = dados.ativa) {
  msg.erro = ''; msg.ok = '';
  if (!dados.nome.trim()) { msg.erro = 'Dê um nome para a ficha (por exemplo, Treino A).'; return; }
  salvando.value = true;
  try {
    await props.salvar({ ...dados, ativa }, itens.value.map((i) => ({ ...i, carga_atual_kg: i.carga_atual_kg ?? i.carga_prescrita_kg })));
    dados.ativa = ativa;
    msg.ok = 'Ficha salva.';
    emit('salvo', dados.id);
  } catch (e) {
    msg.erro = e.message;
  } finally {
    salvando.value = false;
  }
}

async function apagar() {
  try { await props.excluir(); } catch (e) { msg.erro = e.message; }
}
</script>

<template>
  <div class="pilha">
    <p v-if="ficha.prescrita && !podeEditar" class="selo prescrita">Prescrita por {{ ficha.autor_nome || 'seu personal' }}</p>
    <Aviso v-if="aviso" tipo="sucesso" :texto="aviso" />

    <div class="campo">
      <label :for="'nome-' + dados.id">Nome da ficha</label>
      <input :id="'nome-' + dados.id" v-model="dados.nome" maxlength="60" placeholder="Treino A" :disabled="!podeEditar" />
    </div>
    <p v-if="!dados.ativa" class="selo neutro">Arquivada</p>

    <section class="pilha" :aria-labelledby="'t-ex-' + dados.id">
      <h2 :id="'t-ex-' + dados.id">Exercícios</h2>
      <p v-if="!itens.length" class="cartao vazio">{{ podeEditar ? 'Busque abaixo para adicionar o primeiro exercício.' : 'Sem exercícios.' }}</p>

      <article v-for="(it, i) in itens" :key="it.id" class="cartao pilha item">
        <div class="linha">
          <span class="ordem">{{ i + 1 }}</span>
          <strong class="cresce">{{ nomeEx(it.exercicio_id) }}</strong>
          <template v-if="podeEditar">
            <button class="botao secundario icone" type="button" :disabled="i === 0" :aria-label="'Subir ' + nomeEx(it.exercicio_id)" @click="mover(i, -1)">↑</button>
            <button class="botao secundario icone" type="button" :disabled="i === itens.length - 1" :aria-label="'Descer ' + nomeEx(it.exercicio_id)" @click="mover(i, 1)">↓</button>
            <button class="botao perigo icone" type="button" :aria-label="'Remover ' + nomeEx(it.exercicio_id)" @click="itens.splice(i, 1)">✕</button>
          </template>
        </div>
        <fieldset class="grade-campos" :disabled="!podeEditar">
          <legend class="visualmente-oculto">Prescrição de {{ nomeEx(it.exercicio_id) }}</legend>
          <div class="campo"><label :for="'s' + it.id">Séries</label><input :id="'s' + it.id" inputmode="numeric" maxlength="2" :value="it.series" @change="numero(it, 'series', $event.target.value)" /></div>
          <div class="campo"><label :for="'r' + it.id">Repetições</label><input :id="'r' + it.id" v-model="it.reps_prescritas" maxlength="40" placeholder="12 ou 12 / 10 / 8" /></div>
          <div class="campo"><label :for="'cp' + it.id">Prescrita (kg)</label><input :id="'cp' + it.id" inputmode="decimal" maxlength="7" :value="it.carga_prescrita_kg == null ? '' : kg(it.carga_prescrita_kg)" @change="numero(it, 'carga_prescrita_kg', $event.target.value)" /></div>
          <div class="campo"><label :for="'c' + it.id">Atual (kg)</label><input :id="'c' + it.id" inputmode="decimal" maxlength="7" :value="it.carga_atual_kg == null ? '' : kg(it.carga_atual_kg)" @change="numero(it, 'carga_atual_kg', $event.target.value)" /></div>
          <div class="campo"><label :for="'d' + it.id">Descanso (s)</label><input :id="'d' + it.id" inputmode="numeric" maxlength="4" :value="it.descanso_seg ?? ''" @change="numero(it, 'descanso_seg', $event.target.value)" /></div>
          <div class="campo"><label :for="'m' + it.id">Método</label>
            <select :id="'m' + it.id" v-model="it.metodo"><option v-for="[v, n] in METODOS" :key="v" :value="v">{{ n }}</option></select>
          </div>
        </fieldset>
        <p v-if="it.reps_atuais" class="mudo">Meta de repetições atual (ajustada pelo aluno): {{ it.reps_atuais }}</p>
        <div class="campo"><label :for="'o' + it.id">Observações</label><input :id="'o' + it.id" v-model="it.observacoes" maxlength="500" :disabled="!podeEditar" /></div>
      </article>

      <div v-if="podeEditar" class="cartao pilha">
        <div class="campo">
          <label :for="'busca-' + dados.id">Adicionar exercício</label>
          <input :id="'busca-' + dados.id" v-model="busca" type="search" autocomplete="off" placeholder="Busque por nome ou grupo muscular" />
        </div>
        <ul v-if="resultados.length" class="resultados" role="list">
          <li v-for="e in resultados" :key="e.id">
            <button class="botao secundario largo resultado" type="button" @click="adicionar(e)">
              <span>{{ e.nome }}</span><span class="mudo">{{ e.grupo_muscular }}<template v-if="!e.global"> · próprio</template></span>
            </button>
          </li>
        </ul>
        <button v-if="busca.trim().length >= 2 && !existeIgual && !novoEx.aberto" class="botao texto" type="button" @click="abrirNovo">+ Criar "{{ busca.trim() }}"</button>
        <div v-if="novoEx.aberto" class="pilha novo">
          <div class="campo"><label :for="'ne-n-' + dados.id">Nome</label><input :id="'ne-n-' + dados.id" v-model="novoEx.nome" maxlength="80" /></div>
          <div class="campo"><label :for="'ne-g-' + dados.id">Grupo muscular</label><input :id="'ne-g-' + dados.id" v-model="novoEx.grupo_muscular" maxlength="40" placeholder="Peito, Costas…" /></div>
          <div class="campo"><label :for="'ne-v-' + dados.id">Vídeo do YouTube (opcional)</label><input :id="'ne-v-' + dados.id" v-model="novoEx.video_url" type="url" maxlength="300" placeholder="https://youtu.be/…" /><span class="dica">Vídeo próprio: envie ao YouTube como "não listado" e cole o link.</span></div>
          <div class="linha"><button class="botao pequeno" type="button" @click="criarEAdicionar">Criar e adicionar</button><button class="botao secundario pequeno" type="button" @click="novoEx.aberto = false">Cancelar</button></div>
        </div>
      </div>
    </section>

    <Aviso :texto="msg.erro" />
    <Aviso tipo="sucesso" :texto="msg.ok" />
    <div v-if="podeEditar" class="linha acoes">
      <button class="botao" type="button" :disabled="salvando" @click="gravar()">{{ salvando ? 'Salvando…' : 'Salvar ficha' }}</button>
      <button v-if="!nova" class="botao secundario" type="button" :disabled="salvando" @click="gravar(!dados.ativa)">{{ dados.ativa ? 'Arquivar' : 'Reativar' }}</button>
      <button v-if="!nova && excluir && !confirmarExclusao" class="botao perigo" type="button" @click="confirmarExclusao = true">Excluir</button>
      <span v-if="confirmarExclusao" class="linha" role="alert">
        Excluir a ficha? O histórico continua.
        <button class="botao perigo pequeno" type="button" @click="apagar">Excluir</button>
        <button class="botao secundario pequeno" type="button" @click="confirmarExclusao = false">Voltar</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cresce { flex: 1; min-width: 0; }
.ordem { width: 28px; height: 28px; border-radius: 14px; background: var(--accent-soft); color: var(--accent-ink); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.icone { width: 40px; height: 40px; padding: 0; flex-shrink: 0; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.resultados { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.resultado { display: flex; justify-content: space-between; gap: 8px; text-align: left; height: auto; min-height: 48px; padding: 8px 14px; }
.novo { padding-top: 4px; border-top: 1px solid var(--line); }
.acoes { flex-wrap: wrap; }
.selo.neutro { background: var(--track); color: var(--text); align-self: flex-start; }
.selo.prescrita { align-self: flex-start; }
</style>
