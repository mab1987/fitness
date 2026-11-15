<script setup>
import { computed, ref } from 'vue';
import { sessao } from '../servicos/sessao.js';
import { treinos, salvarFicha, exercicioPorId } from '../servicos/treinos.js';
import Aviso from '../componentes/Aviso.vue';

const erro = ref('');
const ordenadas = (lista) => [...lista].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const ativas = computed(() => ordenadas(treinos.fichas.filter((f) => f.ativa)));
const arquivadas = computed(() => ordenadas(treinos.fichas.filter((f) => !f.ativa)));
const limite = computed(() => treinos.limites.fichas_ativas);
const noLimite = computed(() => limite.value !== null && ativas.value.length >= limite.value);
const nomes = (f) => f.itens.map((i) => exercicioPorId.value.get(i.exercicio_id)?.nome).filter(Boolean).join(', ');

async function alternar(f) {
  erro.value = '';
  try {
    await salvarFicha({ id: f.id, nome: f.nome, ordem: f.ordem, ativa: !f.ativa }, f.itens);
  } catch (e) {
    erro.value = e.message;
  }
}
</script>

<template>
  <div class="pilha">
    <div class="cabecalho-tela">
      <div>
        <h1>Fichas</h1>
        <p class="mudo">
          {{ ativas.length }} ativa(s)<template v-if="limite !== null"> de {{ limite }} no plano grátis</template>
        </p>
      </div>
      <RouterLink v-if="!noLimite && !sessao.verComo" class="botao centro" to="/fichas/nova">Nova ficha</RouterLink>
    </div>
    <Aviso :texto="erro" />
    <p v-if="noLimite" class="cartao mudo">
      Você chegou ao limite de {{ limite }} fichas ativas do plano grátis. Arquive uma para criar outra, ou assine o premium para ter fichas sem limite.
    </p>

    <p v-if="treinos.carregado && !treinos.fichas.length" class="cartao vazio">Nenhuma ficha ainda.</p>

    <RouterLink v-for="f in ativas" :key="f.id" class="cartao ficha" :to="'/fichas/' + f.id">
      <strong>{{ f.nome }}</strong>
      <span class="mudo">{{ f.itens.length }} {{ f.itens.length === 1 ? 'exercício' : 'exercícios' }}<template v-if="f.itens.length"> · {{ nomes(f) }}</template></span>
    </RouterLink>

    <section v-if="arquivadas.length" class="pilha" aria-labelledby="t-arq">
      <h2 id="t-arq" class="rotulo-secao">Arquivadas</h2>
      <div v-for="f in arquivadas" :key="f.id" class="cartao linha arquivada">
        <RouterLink class="cresce" :to="'/fichas/' + f.id"><strong>{{ f.nome }}</strong></RouterLink>
        <button class="botao secundario pequeno" type="button" :disabled="noLimite || !!sessao.verComo" @click="alternar(f)">Reativar</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.centro { display: inline-flex; align-items: center; text-decoration: none; }
.ficha { display: flex; flex-direction: column; gap: 4px; color: var(--text); text-decoration: none; }
.ficha .mudo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ficha:hover { border-color: var(--accent); }
.arquivada a { color: var(--text); text-decoration: none; }
.cresce { flex: 1; min-width: 0; }
</style>
