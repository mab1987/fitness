<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { sessao } from '../servicos/sessao.js';
import { treinos, carregarTreinos, salvarFicha, excluirFicha, criarExercicio, exercicioPorId } from '../servicos/treinos.js';
import { novoId, kg, lerNumero, idYoutube } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const METODOS = [
  ['', 'Normal'], ['drop-set', 'Drop-set'], ['rest-pause', 'Rest-pause'], ['bi-set', 'Bi-set'],
  ['tri-set', 'Tri-set'], ['piramide', 'Pirâmide'], ['cluster', 'Cluster'], ['outro', 'Outro'],
];

const nova = computed(() => props.id === 'nova');
const ficha = reactive({ id: '', nome: '', ordem: 0, ativa: true });
const itens = ref([]);
const busca = ref('');
const novoEx = reactive({ aberto: false, nome: '', grupo_muscular: '', video_url: '' });
const msg = reactive({ erro: '', ok: '' });
const salvando = ref(false);
const confirmarExclusao = ref(false);
const carregou = ref(false);
const bloqueado = computed(() => !!sessao.verComo);

function montar() {
  if (nova.value) {
    Object.assign(ficha, { id: novoId(), nome: '', ordem: treinos.fichas.length + 1, ativa: true });
    itens.value = [];
  } else {
    const f = treinos.fichas.find((x) => x.id === props.id);
    if (!f) return;
    Object.assign(ficha, { id: f.id, nome: f.nome, ordem: f.ordem || 0, ativa: f.ativa });
    itens.value = f.itens.map((i) => ({ ...i }));
  }
  carregou.value = true;
}

watch(() => props.id, () => { carregou.value = false; montar(); }, { immediate: true });
watch(() => treinos.fichas, () => { if (!carregou.value) montar(); });
carregarTreinos();

const resultados = computed(() => {
  const q = normal(busca.value);
  if (!q) return [];
  return treinos.exercicios.filter((e) => normal(e.nome).includes(q) || normal(e.grupo_muscular).includes(q)).slice(0, 8);
});
const existeIgual = computed(() => treinos.exercicios.some((e) => normal(e.nome) === normal(busca.value)));
function normal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
const nomeEx = (id) => exercicioPorId.value.get(id)?.nome || 'Exercício';

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
    const e = await criarExercicio({ nome: novoEx.nome, grupo_muscular: novoEx.grupo_muscular, video_url: novoEx.video_url, global: false });
    adicionar(e);
    Object.assign(novoEx, { aberto: false, nome: '', grupo_muscular: '', video_url: '' });
  } catch (e) {
    msg.erro = e.message;
  }
}

function abrirNovo() {
  novoEx.nome = busca.value.trim();
  novoEx.aberto = true;
}

function mover(i, d) {
  const j = i + d;
  if (j < 0 || j >= itens.value.length) return;
  const l = itens.value;
  [l[i], l[j]] = [l[j], l[i]];
}

function numero(item, campo, valor) { item[campo] = lerNumero(valor); }

async function salvar(ativa = ficha.ativa) {
  msg.erro = ''; msg.ok = '';
  if (!ficha.nome.trim()) { msg.erro = 'Dê um nome para a ficha (por exemplo, Treino A).'; return; }
  salvando.value = true;
  try {
    await salvarFicha({ ...ficha, ativa }, itens.value.map((i) => ({ ...i, carga_atual_kg: i.carga_atual_kg ?? i.carga_prescrita_kg })));
    ficha.ativa = ativa;
    msg.ok = 'Ficha salva.';
    if (nova.value) router.replace('/fichas/' + ficha.id);
  } catch (e) {
    msg.erro = e.message;
  } finally {
    salvando.value = false;
  }
}

async function excluir() {
  try {
    await excluirFicha(ficha.id);
    router.replace('/fichas');
  } catch (e) {
    msg.erro = e.message;
  }
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/fichas">← Fichas</RouterLink>
    <p v-if="!carregou" class="mudo">Carregando…</p>
    <template v-else>
      <div class="campo">
        <label for="nome">Nome da ficha</label>
        <input id="nome" v-model="ficha.nome" maxlength="60" placeholder="Treino A" :disabled="bloqueado" />
      </div>
      <p v-if="!ficha.ativa" class="selo neutro">Arquivada</p>

      <section class="pilha" aria-labelledby="t-ex">
        <h2 id="t-ex">Exercícios</h2>
        <p v-if="!itens.length" class="cartao vazio">Busque abaixo para adicionar o primeiro exercício.</p>

        <article v-for="(it, i) in itens" :key="it.id" class="cartao pilha item">
          <div class="linha">
            <span class="ordem">{{ i + 1 }}</span>
            <strong class="cresce">{{ nomeEx(it.exercicio_id) }}</strong>
            <button class="botao secundario icone" type="button" :disabled="i === 0" :aria-label="'Subir ' + nomeEx(it.exercicio_id)" @click="mover(i, -1)">↑</button>
            <button class="botao secundario icone" type="button" :disabled="i === itens.length - 1" :aria-label="'Descer ' + nomeEx(it.exercicio_id)" @click="mover(i, 1)">↓</button>
            <button class="botao perigo icone" type="button" :aria-label="'Remover ' + nomeEx(it.exercicio_id)" @click="itens.splice(i, 1)">✕</button>
          </div>
          <div class="grade-campos">
            <div class="campo"><label :for="'s' + it.id">Séries</label><input :id="'s' + it.id" inputmode="numeric" maxlength="2" :value="it.series" @change="numero(it, 'series', $event.target.value)" /></div>
            <div class="campo"><label :for="'r' + it.id">Repetições</label><input :id="'r' + it.id" v-model="it.reps_prescritas" maxlength="40" placeholder="12 ou 12 / 10 / 8" /></div>
            <div class="campo"><label :for="'c' + it.id">Carga (kg)</label><input :id="'c' + it.id" inputmode="decimal" maxlength="7" :value="it.carga_atual_kg == null ? '' : kg(it.carga_atual_kg)" @change="numero(it, 'carga_atual_kg', $event.target.value)" /></div>
            <div class="campo"><label :for="'d' + it.id">Descanso (s)</label><input :id="'d' + it.id" inputmode="numeric" maxlength="4" :value="it.descanso_seg ?? ''" @change="numero(it, 'descanso_seg', $event.target.value)" /></div>
            <div class="campo"><label :for="'m' + it.id">Método</label>
              <select :id="'m' + it.id" v-model="it.metodo"><option v-for="[v, n] in METODOS" :key="v" :value="v">{{ n }}</option></select>
            </div>
          </div>
          <p v-if="it.carga_prescrita_kg != null && it.carga_prescrita_kg !== it.carga_atual_kg" class="mudo">Prescrita: {{ kg(it.carga_prescrita_kg) }} kg</p>
          <div class="campo"><label :for="'o' + it.id">Observações</label><input :id="'o' + it.id" v-model="it.observacoes" maxlength="500" /></div>
        </article>

        <div class="cartao pilha">
          <div class="campo">
            <label for="busca">Adicionar exercício</label>
            <input id="busca" v-model="busca" type="search" autocomplete="off" placeholder="Busque por nome ou grupo muscular" />
          </div>
          <ul v-if="resultados.length" class="resultados" role="list">
            <li v-for="e in resultados" :key="e.id">
              <button class="botao secundario largo resultado" type="button" @click="adicionar(e)">
                <span>{{ e.nome }}</span><span class="mudo">{{ e.grupo_muscular }}<template v-if="!e.global"> · seu</template></span>
              </button>
            </li>
          </ul>
          <button v-if="busca.trim().length >= 2 && !existeIgual && !novoEx.aberto" class="botao texto" type="button" @click="abrirNovo">+ Criar "{{ busca.trim() }}"</button>
          <div v-if="novoEx.aberto" class="pilha novo">
            <div class="campo"><label for="ne-n">Nome</label><input id="ne-n" v-model="novoEx.nome" maxlength="80" /></div>
            <div class="campo"><label for="ne-g">Grupo muscular</label><input id="ne-g" v-model="novoEx.grupo_muscular" maxlength="40" placeholder="Peito, Costas…" /></div>
            <div class="campo"><label for="ne-v">Vídeo do YouTube (opcional)</label><input id="ne-v" v-model="novoEx.video_url" type="url" maxlength="300" placeholder="https://youtu.be/…" /></div>
            <div class="linha"><button class="botao pequeno" type="button" @click="criarEAdicionar">Criar e adicionar</button><button class="botao secundario pequeno" type="button" @click="novoEx.aberto = false">Cancelar</button></div>
          </div>
        </div>
      </section>

      <Aviso :texto="msg.erro" />
      <Aviso tipo="sucesso" :texto="msg.ok" />
      <div class="linha acoes">
        <button class="botao" type="button" :disabled="salvando || bloqueado" @click="salvar()">{{ salvando ? 'Salvando…' : 'Salvar ficha' }}</button>
        <button v-if="!nova" class="botao secundario" type="button" :disabled="salvando || bloqueado" @click="salvar(!ficha.ativa)">{{ ficha.ativa ? 'Arquivar' : 'Reativar' }}</button>
        <button v-if="!nova && !confirmarExclusao" class="botao perigo" type="button" :disabled="bloqueado" @click="confirmarExclusao = true">Excluir</button>
        <span v-if="confirmarExclusao" class="linha" role="alert">
          Excluir a ficha? O histórico continua.
          <button class="botao perigo pequeno" type="button" @click="excluir">Excluir</button>
          <button class="botao secundario pequeno" type="button" @click="confirmarExclusao = false">Voltar</button>
        </span>
      </div>
      <p class="mudo">Salvar as fichas precisa de internet. O treino em si funciona sem.</p>
    </template>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.cresce { flex: 1; min-width: 0; }
.ordem { width: 28px; height: 28px; border-radius: 14px; background: var(--accent-soft); color: var(--accent-ink); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.icone { width: 40px; height: 40px; padding: 0; flex-shrink: 0; }
.resultados { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.resultado { display: flex; justify-content: space-between; gap: 8px; text-align: left; height: auto; min-height: 48px; padding: 8px 14px; }
.novo { padding-top: 4px; border-top: 1px solid var(--line); }
.acoes { flex-wrap: wrap; }
.selo.neutro { background: var(--track); color: var(--text); align-self: flex-start; }
</style>
