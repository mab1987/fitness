<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { sessao, planoEfetivo, textoPlano } from '../servicos/sessao.js';
import { treinos, iniciarTreino, exercicioPorId, comentariosNovos } from '../servicos/treinos.js';
import { proximaFicha, data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';


const router = useRouter();
const erro = ref('');
const primeiroNome = computed(() => (sessao.perfil?.nome || '').split(' ')[0]);
const ativas = computed(() => treinos.fichas.filter((f) => f.ativa && !f.bloqueada).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
const proxima = computed(() => proximaFicha(treinos.fichas.filter((f) => !f.bloqueada), treinos.historico));
const ultimaSessao = computed(() => [...treinos.historico.sessoes].sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0]);
const nomeFicha = (id) => treinos.fichas.find((f) => f.id === id)?.nome || 'Treino livre';
const resumoFicha = (f) => {
  const grupos = [...new Set(f.itens.map((i) => exercicioPorId.value.get(i.exercicio_id)?.grupo_muscular).filter(Boolean))];
  return `${f.itens.length} ${f.itens.length === 1 ? 'exercício' : 'exercícios'}${grupos.length ? ' · ' + grupos.slice(0, 3).join(', ') : ''}`;
};
const acabando = computed(() => {
  const p = planoEfetivo.value;
  return p && p.tipo === 'premium' && p.fim && p.dias_restantes != null && p.dias_restantes <= 7;
});
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

    <RouterLink v-if="acabando" class="cartao linha aviso-com" to="/premium">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span><strong>Seu premium acaba em {{ planoEfetivo.dias_restantes }} dia(s).</strong> Renove para não voltar ao plano grátis.</span>
    </RouterLink>
    <RouterLink v-if="comentariosNovos" class="cartao linha aviso-com" to="/evolucao">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      <span><strong>{{ comentariosNovos }} comentário(s) novo(s)</strong> sobre seus treinos. Veja em Evolução.</span>
    </RouterLink>

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
.aviso-com { color: var(--text); text-decoration: none; background: var(--accent-soft); border-color: transparent; }
.aviso-com svg { color: var(--accent-ink); flex-shrink: 0; }
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
