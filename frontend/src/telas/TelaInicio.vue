<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { sessao, planoEfetivo, textoPlano } from '../servicos/sessao.js';
import { treinos, iniciarTreino, exercicioPorId } from '../servicos/treinos.js';
import { proximaFicha, data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';


const router = useRouter();
const erro = ref('');
const primeiroNome = computed(() => (sessao.perfil?.nome || '').split(' ')[0]);
const ativas = computed(() => treinos.fichas.filter((f) => f.ativa).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
const proxima = computed(() => proximaFicha(treinos.fichas, treinos.historico));
const ultimaSessao = computed(() => [...treinos.historico.sessoes].sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0]);
const nomeFicha = (id) => treinos.fichas.find((f) => f.id === id)?.nome || 'Treino livre';
const resumoFicha = (f) => {
  const grupos = [...new Set(f.itens.map((i) => exercicioPorId.value.get(i.exercicio_id)?.grupo_muscular).filter(Boolean))];
  return `${f.itens.length} ${f.itens.length === 1 ? 'exercício' : 'exercícios'}${grupos.length ? ' · ' + grupos.slice(0, 3).join(', ') : ''}`;
};
const treinosNoMes = computed(() => {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  return treinos.historico.sessoes.filter((s) => s.inicio >= desde).length;
});

async function comecar(f) {
  erro.value = '';
  if (!f.itens.length) { erro.value = 'Esta ficha ainda não tem exercícios. Abra em Fichas para montar.'; return; }
  try {
    await iniciarTreino(f);
    router.push('/treino');
  } catch (e) {
    erro.value = e.message;
  }
}
</script>

<template>
  <div class="pilha">
    <div>
      <p class="mudo">{{ data(new Date().toISOString()) }}</p>
      <h1>Olá, {{ primeiroNome }}</h1>
    </div>
    <Aviso :texto="erro || treinos.erro" />

    <section v-if="treinos.atual" class="cartao destaque pilha" aria-labelledby="t-and">
      <h2 id="t-and">Treino em andamento</h2>
      <p>{{ treinos.atual.nome }} · começou {{ data(treinos.atual.inicio) }}</p>
      <RouterLink class="botao largo centro" to="/treino">Continuar treino</RouterLink>
    </section>

    <section v-else-if="proxima" class="cartao destaque pilha" aria-labelledby="t-prox">
      <p class="rotulo-secao">Próximo treino</p>
      <h2 id="t-prox" class="grande">{{ proxima.nome }}</h2>
      <p class="mudo">{{ resumoFicha(proxima) }}</p>
      <button class="botao largo" type="button" :disabled="!!sessao.verComo" @click="comecar(proxima)">Começar {{ proxima.nome }}</button>
      <p v-if="sessao.verComo" class="mudo">No modo "ver como" não dá para registrar treino.</p>
    </section>

    <section v-else-if="treinos.carregado" class="cartao pilha">
      <h2>Monte sua primeira ficha</h2>
      <p class="mudo">Escolha os exercícios, as séries e as cargas. Depois é só abrir e marcar cada série.</p>
      <RouterLink class="botao centro" to="/fichas/nova">Criar ficha</RouterLink>
    </section>

    <section v-if="ativas.length > 1 && !treinos.atual" class="pilha" aria-labelledby="t-outras">
      <h2 id="t-outras" class="rotulo-secao">Outras fichas</h2>
      <div class="grade-fichas">
        <button v-for="f in ativas.filter((x) => x.id !== proxima?.id)" :key="f.id" class="cartao ficha" type="button" :disabled="!!sessao.verComo" @click="comecar(f)">
          <strong>{{ f.nome }}</strong>
          <span class="mudo">{{ resumoFicha(f) }}</span>
        </button>
      </div>
    </section>

    <section class="cartao linha resumo" aria-label="Resumo">
      <div><strong class="numero">{{ treinosNoMes }}</strong><span class="mudo">treinos em 30 dias</span></div>
      <div v-if="ultimaSessao"><strong>{{ nomeFicha(ultimaSessao.ficha_id) }}</strong><span class="mudo">último · {{ data(ultimaSessao.inicio) }}</span></div>
      <div><strong>{{ textoPlano(planoEfetivo) }}</strong><span class="mudo">seu plano</span></div>
    </section>
  </div>
</template>

<style scoped>
.destaque { border: 2px solid var(--accent); }
.grande { font-size: 24px; }
.centro { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
.grade-fichas { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.ficha { display: flex; flex-direction: column; gap: 4px; text-align: left; font: inherit; color: var(--text); cursor: pointer; min-height: 72px; }
.ficha:hover:not([disabled]) { border-color: var(--accent); }
.ficha[disabled] { cursor: default; }
.resumo { flex-wrap: wrap; justify-content: space-between; }
.resumo > div { display: flex; flex-direction: column; min-width: 0; }
.numero { font-size: 22px; }
</style>
