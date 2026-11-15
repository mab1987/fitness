<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin } from '../servicos/sessao.js';
import Aviso from '../componentes/Aviso.vue';

const grupos = ref([]);
const erro = ref('');
const novo = reactive({ nome: '', descricao: '', gerente_email: '', ok: '' });
const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const NOMES = { membro: 'Membro', personal: 'Personal', gerente: 'Gerente', admin: 'Administrador' };

async function carregar() {
  try { grupos.value = await api.listarGrupos(); } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

async function criar() {
  erro.value = ''; novo.ok = '';
  try {
    await api.criarGrupo({ nome: novo.nome, descricao: novo.descricao, gerente_email: novo.gerente_email.trim() || undefined });
    novo.ok = `Grupo ${novo.nome} criado.`;
    Object.assign(novo, { nome: '', descricao: '', gerente_email: '' });
    await carregar();
  } catch (e) { erro.value = e.message; }
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>Grupos</h1>
    <Aviso :texto="erro" />

    <p v-if="!grupos.length" class="cartao vazio">{{ adminReal ? 'Nenhum grupo ainda. Crie o primeiro abaixo.' : 'Você ainda não gerencia nenhum grupo.' }}</p>
    <RouterLink v-for="g in grupos" :key="g.id" :to="'/painel/grupos/' + g.id" class="cartao grupo">
      <span class="linha" style="justify-content: space-between"><strong>{{ g.nome }}</strong><span class="selo">{{ NOMES[g.meu_papel] || g.meu_papel }}</span></span>
      <span class="mudo">{{ g.membros }} {{ g.membros === 1 ? 'participante' : 'participantes' }}<template v-if="g.descricao"> · {{ g.descricao }}</template></span>
    </RouterLink>

    <form v-if="adminReal" class="cartao pilha" @submit.prevent="criar">
      <h2>Novo grupo</h2>
      <Aviso tipo="sucesso" :texto="novo.ok" />
      <div class="grade-campos">
        <div class="campo"><label for="g-nome">Nome</label><input id="g-nome" v-model="novo.nome" maxlength="60" placeholder="Turma da manhã" /></div>
        <div class="campo"><label for="g-ger">E-mail do gerente (opcional)</label><input id="g-ger" v-model="novo.gerente_email" type="email" maxlength="120" /></div>
      </div>
      <div class="campo"><label for="g-desc">Descrição (opcional)</label><input id="g-desc" v-model="novo.descricao" maxlength="300" placeholder="Academia, horário, objetivo…" /></div>
      <p class="mudo">Sem gerente agora? Depois, dentro do grupo, gere um convite de gerente.</p>
      <button class="botao" type="submit" :disabled="!novo.nome.trim()" style="align-self: flex-start">Criar grupo</button>
    </form>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.grupo { display: flex; flex-direction: column; gap: 4px; color: var(--text); text-decoration: none; }
.grupo:hover { border-color: var(--accent); }
</style>
