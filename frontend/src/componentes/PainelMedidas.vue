<script setup>
// Medidas corporais. Grátis: peso. Premium: todas. Usado pelo aluno (Evolução) e pelo personal (aluno › Medidas).
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao } from '../servicos/sessao.js';
import { kg, lerNumero, data, novoId } from '../servicos/calculos.js';
import GraficoLinha from './GraficoLinha.vue';
import Aviso from './Aviso.vue';

const props = defineProps({ alunoId: { type: String, default: '' }, premium: { type: Boolean, default: false } });
const lista = ref([]);
const erro = ref('');
const aberto = ref(false);
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const CAMPOS = [
  ['peso_kg', 'Peso (kg)'], ['gordura_pct', 'Gordura (%)'], ['peito_cm', 'Peito (cm)'], ['cintura_cm', 'Cintura (cm)'],
  ['abdomen_cm', 'Abdômen (cm)'], ['quadril_cm', 'Quadril (cm)'], ['braco_d_cm', 'Braço dir. (cm)'], ['braco_e_cm', 'Braço esq. (cm)'],
  ['coxa_d_cm', 'Coxa dir. (cm)'], ['coxa_e_cm', 'Coxa esq. (cm)'], ['panturrilha_cm', 'Panturrilha (cm)'],
];
const form = reactive({ data: hoje(), observacao: '' });
const visiveis = computed(() => (props.premium ? CAMPOS : CAMPOS.slice(0, 1)));
const colunas = computed(() => CAMPOS.filter(([c]) => lista.value.some((m) => m[c] != null)));
const pontosPeso = computed(() => [...lista.value].filter((m) => m.peso_kg != null).reverse().map((m) => ({ data: m.data, valor: m.peso_kg, carga: m.peso_kg })));
const arg = () => (props.alunoId ? { aluno_id: props.alunoId } : {});

async function carregar() {
  try { lista.value = await api.medidas(arg()); } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

async function salvar() {
  erro.value = '';
  const medida = { id: novoId(), data: new Date(form.data + 'T12:00:00').toISOString(), observacao: form.observacao };
  for (const [c] of visiveis.value) medida[c] = lerNumero(form[c]);
  try {
    await api.salvarMedida({ ...arg(), medida });
    for (const [c] of CAMPOS) form[c] = '';
    form.observacao = '';
    aberto.value = false;
    await carregar();
  } catch (e) { erro.value = e.message; }
}
async function excluir(m) {
  try { await api.excluirMedida({ id: m.id }); await carregar(); } catch (e) { erro.value = e.message; }
}
</script>

<template>
  <section class="pilha" aria-label="Medidas corporais">
    <Aviso :texto="erro" />
    <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
      <p class="mudo">{{ lista.length ? `${lista.length} registro(s)` : 'Nenhuma medida registrada.' }}</p>
      <button v-if="!aberto" class="botao pequeno" type="button" :disabled="!!sessao.verComo" @click="aberto = true">Registrar medidas</button>
    </div>
    <form v-if="aberto" class="cartao pilha" @submit.prevent="salvar">
      <div class="grade-campos">
        <div class="campo"><label :for="'md-data' + alunoId">Data</label><input :id="'md-data' + alunoId" v-model="form.data" type="date" :max="hoje()" /></div>
        <div v-for="[c, n] in visiveis" :key="c" class="campo"><label :for="'md-' + c + alunoId">{{ n }}</label><input :id="'md-' + c + alunoId" v-model="form[c]" inputmode="decimal" maxlength="6" /></div>
      </div>
      <p v-if="!premium" class="mudo">No plano grátis dá para registrar o peso. Circunferências e gordura são do premium.</p>
      <div class="campo"><label :for="'md-obs' + alunoId">Observação</label><input :id="'md-obs' + alunoId" v-model="form.observacao" maxlength="300" /></div>
      <div class="linha"><button class="botao" type="submit">Salvar</button><button class="botao secundario" type="button" @click="aberto = false">Cancelar</button></div>
    </form>

    <div v-if="pontosPeso.length > 1" class="cartao"><GraficoLinha :pontos="pontosPeso" titulo="Peso" unidade="kg" /></div>

    <div v-if="lista.length" class="cartao rolagem">
      <table>
        <thead><tr><th>Data</th><th v-for="[c, n] in colunas" :key="c">{{ n }}</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in lista" :key="m.id">
            <td>{{ data(m.data) }}<span v-if="m.observacao" class="mudo"><br />{{ m.observacao }}</span></td>
            <td v-for="[c] in colunas" :key="c">{{ m[c] == null ? '—' : kg(m[c]) }}</td>
            <td><button class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="excluir(m)">Apagar</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { color: var(--muted); font-weight: 600; }
</style>
