<script setup>
// Aluno: programas prontos para copiar para as próprias fichas.
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao } from '../servicos/sessao.js';
import { treinos, atualizarDoServidor, exercicioPorId } from '../servicos/treinos.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const lista = ref([]);
const erro = ref('');
const aberto = ref(null);
const confirmar = ref(null);
const feito = ref(null);
const NIVEIS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };

onMounted(async () => {
  try { lista.value = await api.programas(); } catch (e) { erro.value = e.message; }
});

const nomeEx = (id) => exercicioPorId.value.get(id)?.nome || 'Exercício';
async function usar(p) {
  erro.value = '';
  try {
    feito.value = { nome: p.nome, ...(await api.usarPrograma({ id: p.id })) };
    confirmar.value = null;
    await atualizarDoServidor();
  } catch (e) { erro.value = e.message; }
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/fichas">← Fichas</RouterLink>
    <h1>Programas prontos</h1>
    <p class="mudo">Planos montados por professores. Ao usar, as fichas do programa são copiadas para as suas e você pode ajustar depois.</p>
    <Aviso :texto="erro" />
    <div v-if="feito" class="cartao pilha" role="status">
      <p><strong>Pronto: {{ feito.fichas }} ficha(s) de "{{ feito.nome }}" copiadas.</strong>
        <template v-if="feito.arquivadas"> {{ feito.arquivadas }} ficaram arquivadas por causa do limite de 3 fichas ativas do plano grátis.</template></p>
      <button class="botao" type="button" style="align-self: flex-start" @click="router.push('/fichas')">Ver minhas fichas</button>
    </div>

    <p v-if="!lista.length && !erro" class="cartao vazio">Nenhum programa publicado ainda.</p>
    <article v-for="p in lista" :key="p.id" class="cartao pilha programa">
      <div class="linha topo">
        <div class="cresce">
          <h2>{{ p.nome }}</h2>
          <p class="mudo">
            <template v-if="p.nivel">{{ NIVEIS[p.nivel] }} · </template>
            <template v-if="p.dias_semana">{{ p.dias_semana }}x por semana · </template>
            {{ p.fichas.length }} ficha(s)<template v-if="p.semanas"> · {{ p.semanas }} semanas</template>
            <template v-if="p.publico === 'grupo'"> · do seu grupo</template>
          </p>
        </div>
        <span v-if="p.bloqueado" class="selo">Premium</span>
        <span v-else-if="p.gratis && p.publico === 'todos'" class="selo neutro">Grátis</span>
      </div>
      <p v-if="p.descricao" class="descricao">{{ p.descricao }}</p>
      <template v-if="!p.bloqueado">
        <button class="botao texto pequeno" type="button" style="align-self: flex-start" :aria-expanded="aberto === p.id" @click="aberto = aberto === p.id ? null : p.id">{{ aberto === p.id ? 'Esconder exercícios' : 'Ver exercícios' }}</button>
        <div v-if="aberto === p.id" class="fichas">
          <div v-for="f in p.fichas" :key="f.id" class="ficha">
            <strong>{{ f.nome }}</strong>
            <p v-for="i in f.itens" :key="i.id" class="mudo">{{ nomeEx(i.exercicio_id) }} · {{ i.series }} × {{ i.reps_prescritas || '—' }}</p>
          </div>
        </div>
        <div v-if="confirmar !== p.id">
          <button class="botao" type="button" :disabled="!!sessao.verComo" @click="confirmar = p.id">Usar este programa</button>
        </div>
        <div v-else class="linha" role="alert" style="flex-wrap: wrap">
          <span>Copiar {{ p.fichas.length }} ficha(s) para as suas?<template v-if="treinos.limites.fichas_ativas !== null"> No plano grátis, só 3 ficam ativas.</template></span>
          <button class="botao pequeno" type="button" @click="usar(p)">Copiar</button>
          <button class="botao secundario pequeno" type="button" @click="confirmar = null">Voltar</button>
        </div>
      </template>
      <RouterLink v-else class="botao secundario centro" to="/premium">Disponível no premium</RouterLink>
    </article>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.topo { align-items: flex-start; }
.cresce { flex: 1; min-width: 0; }
.descricao { white-space: pre-wrap; }
.fichas { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.ficha { padding: 10px 12px; border-radius: 12px; background: var(--track); }
.ficha p { font-size: 13px; }
.selo.neutro { background: var(--track); color: var(--text); }
.centro { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; align-self: flex-start; }
</style>
