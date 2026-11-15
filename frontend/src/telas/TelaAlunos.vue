<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';
import Convites from '../componentes/Convites.vue';

const alunos = ref([]);
const convites = ref([]);
const erro = ref('');
const carregado = ref(false);

async function carregar() {
  erro.value = '';
  try {
    [alunos.value, convites.value] = await Promise.all([api.listarAlunos(), api.listarConvites()]);
    convites.value = convites.value.filter((c) => c.tipo === 'personal');
  } catch (e) { erro.value = e.message; }
  carregado.value = true;
}
onMounted(carregar);

function frequencia(a) {
  if (!a.ultimo_treino) return 'ainda sem treinos';
  const dias = Math.floor((Date.now() - new Date(a.ultimo_treino).getTime()) / 864e5);
  return dias === 0 ? 'treinou hoje' : dias === 1 ? 'treinou ontem' : `último treino há ${dias} dias`;
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>Meus alunos</h1>
    <Aviso :texto="erro" />

    <p v-if="carregado && !alunos.length" class="cartao vazio">Nenhum aluno ainda. Gere um convite abaixo e envie para o aluno.</p>
    <div v-if="alunos.length" class="cartao rolagem">
      <table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Frequência</th><th>7 dias</th><th>30 dias</th><th>Novidades</th></tr></thead>
        <tbody>
          <tr v-for="a in alunos" :key="a.id">
            <td><RouterLink :to="'/painel/alunos/' + a.id"><strong>{{ a.nome }}</strong></RouterLink><br /><span class="mudo">{{ a.email }}</span></td>
            <td>{{ a.plano === 'premium' ? 'Premium' : 'Grátis' }}</td>
            <td>{{ frequencia(a) }}<br /><span class="mudo">aluno desde {{ data(a.desde) }}</span></td>
            <td>{{ a.treinos_7d }}</td>
            <td>{{ a.treinos_30d }}</td>
            <td>
              <span v-if="a.ajustes_novos" class="selo">{{ a.ajustes_novos }} ajuste(s)</span>
              <span v-if="a.comentarios_novos" class="selo">{{ a.comentarios_novos }} coment.</span>
              <span v-if="!a.ajustes_novos && !a.comentarios_novos" class="mudo">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Convites :pedido="{ tipo: 'personal' }" :ativos="convites" titulo="Convidar aluno"
      explicacao="O aluno abre o link (ou digita o código em Perfil) e aceita. A partir daí você vê os treinos dele e pode montar fichas."
      @mudou="carregar" />
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 680px; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
td .selo { margin: 0 4px 4px 0; }
</style>
