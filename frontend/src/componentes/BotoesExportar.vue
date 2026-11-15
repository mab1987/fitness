<script setup>
// Baixa os dados em planilhas CSV (abrem no Excel e no Google Planilhas).
import { ref } from 'vue';
import { api } from '../servicos/dados.js';
import { gerarCsv, baixarArquivo } from '../servicos/calculos.js';

const props = defineProps({ alunoId: { type: String, default: '' } });
const dados = ref(null);
const erro = ref('');
const ocupado = ref(false);

function nomeArquivo(base) {
  const quem = (dados.value.aluno || 'dados').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  return `meu-treino-${quem}-${base}-${new Date().toISOString().slice(0, 10)}.csv`;
}
async function baixar(qual) {
  erro.value = '';
  ocupado.value = true;
  try {
    if (!dados.value) dados.value = await api.exportar(props.alunoId ? { aluno_id: props.alunoId } : {});
    const t = dados.value[qual];
    baixarArquivo(nomeArquivo(qual), gerarCsv(t.colunas, t.linhas));
  } catch (e) { erro.value = e.message; } finally { ocupado.value = false; }
}
</script>

<template>
  <div class="pilha exportar">
    <div class="linha" style="flex-wrap: wrap">
      <span class="mudo">Baixar planilha:</span>
      <button class="botao secundario pequeno" type="button" :disabled="ocupado" @click="baixar('series')">Séries</button>
      <button class="botao secundario pequeno" type="button" :disabled="ocupado" @click="baixar('treinos')">Treinos</button>
      <button class="botao secundario pequeno" type="button" :disabled="ocupado" @click="baixar('medidas')">Medidas</button>
    </div>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
  </div>
</template>

<style scoped>
.erro { color: var(--perigo); font-size: 13px; }
</style>
