<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { sessao } from '../servicos/sessao.js';
import { treinos, carregarTreinos, salvarFicha, excluirFicha, criarExercicio } from '../servicos/treinos.js';
import { novoId } from '../servicos/calculos.js';
import EditorFicha from '../componentes/EditorFicha.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
carregarTreinos();

const nova = computed(() => props.id === 'nova');
const idNova = novoId();
const ficha = computed(() => {
  if (nova.value) return { id: idNova, nome: '', ordem: treinos.fichas.length + 1, ativa: true, itens: [] };
  return treinos.fichas.find((x) => x.id === props.id) || null;
});
const podeEditar = computed(() => !sessao.verComo && (nova.value || ficha.value?.pode_editar !== false));

async function salvar(f, itens) {
  await salvarFicha(f, itens);
  if (nova.value) router.replace('/fichas/' + f.id);
}
async function excluir() {
  await excluirFicha(ficha.value.id);
  router.replace('/fichas');
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/fichas">← Fichas</RouterLink>
    <p v-if="!ficha" class="mudo">{{ treinos.carregado ? 'Ficha não encontrada.' : 'Carregando…' }}</p>
    <template v-else>
      <EditorFicha :ficha="ficha" :nova="nova" :exercicios="treinos.exercicios" :pode-editar="podeEditar"
        :salvar="salvar" :excluir="excluir" :criar-exercicio="criarExercicio" />
      <p v-if="ficha.bloqueada" class="cartao">Ficha bloqueada: passou do limite de 3 fichas ativas do plano grátis. Arquive-a ou <RouterLink to="/premium">renove o premium</RouterLink>.</p>
      <p v-if="ficha.prescrita && !ficha.pode_editar" class="mudo">
        Quem altera esta ficha é o seu personal. Você ajusta a carga e as repetições durante o treino: o app pergunta ao terminar cada exercício.
      </p>
      <p v-else class="mudo">Salvar as fichas precisa de internet. O treino em si funciona sem.</p>
    </template>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
</style>
