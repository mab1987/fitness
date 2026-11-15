<script setup>
// Perfil do aluno: o personal dele, os grupos de que participa e onde digitar um código de convite.
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil } from '../servicos/sessao.js';
import { treinos, atualizarDoServidor } from '../servicos/treinos.js';
import { data } from '../servicos/calculos.js';
import Aviso from './Aviso.vue';

const router = useRouter();
const grupos = ref([]);
const codigo = ref('');
const erro = ref('');
const confirmar = ref(null); // 'personal' ou id do grupo

async function carregar() {
  try { grupos.value = await api.listarGrupos(); } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

function abrirCodigo() {
  const c = codigo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 8) { erro.value = 'O código tem 8 letras e números.'; return; }
  router.push('/convite/' + c);
}

async function encerrar() {
  erro.value = '';
  try {
    await api.encerrarVinculo(treinos.personal.vinculo_id);
    confirmar.value = null;
    await atualizarDoServidor();
  } catch (e) { erro.value = e.message; }
}

async function sair(g) {
  erro.value = '';
  try {
    await api.sairDoGrupo(g.id);
    confirmar.value = null;
    await carregar();
    definirPerfil(await api.lerPerfil());
  } catch (e) { erro.value = e.message; }
}
const NOMES = { membro: 'Membro', personal: 'Personal', gerente: 'Gerente', admin: 'Administrador' };
</script>

<template>
  <section class="cartao pilha" aria-labelledby="t-vinc">
    <h2 id="t-vinc">Personal e grupos</h2>
    <Aviso :texto="erro" />

    <div v-if="treinos.personal" class="linha item">
      <div class="cresce">
        <strong>{{ treinos.personal.nome }}</strong>
        <p class="mudo">Seu personal desde {{ data(treinos.personal.desde) }}</p>
        <p class="mudo">Vê seus treinos e monta fichas para você.</p>
      </div>
      <button v-if="confirmar !== 'personal'" class="botao secundario pequeno" type="button" :disabled="!!sessao.verComo" @click="confirmar = 'personal'">Encerrar</button>
    </div>
    <div v-if="confirmar === 'personal'" class="linha confirma" role="alert">
      <span>Encerrar o vínculo? {{ treinos.personal.nome }} deixa de ver seus treinos. As fichas ficam com você.</span>
      <button class="botao perigo pequeno" type="button" @click="encerrar">Encerrar</button>
      <button class="botao secundario pequeno" type="button" @click="confirmar = null">Voltar</button>
    </div>
    <p v-if="!treinos.personal" class="mudo">Você ainda não tem personal no app.</p>

    <div v-for="g in grupos" :key="g.id" class="linha item">
      <div class="cresce"><strong>{{ g.nome }}</strong><p class="mudo">{{ NOMES[g.meu_papel] || g.meu_papel }} · {{ g.membros }} {{ g.membros === 1 ? 'participante' : 'participantes' }}</p></div>
      <button v-if="g.meu_papel !== 'admin' && g.meu_papel !== 'gerente' && confirmar !== g.id" class="botao secundario pequeno" type="button" :disabled="!!sessao.verComo" @click="confirmar = g.id">Sair</button>
      <span v-if="confirmar === g.id" class="linha" role="alert">
        <button class="botao perigo pequeno" type="button" @click="sair(g)">Sair do grupo</button>
        <button class="botao secundario pequeno" type="button" @click="confirmar = null">Voltar</button>
      </span>
    </div>

    <form class="pilha" @submit.prevent="abrirCodigo">
      <div class="campo">
        <label for="cod-conv">Recebeu um código de convite?</label>
        <div class="linha">
          <input id="cod-conv" v-model="codigo" class="entrada cresce" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="ABCD-2345" />
          <button class="botao secundario" type="submit" :disabled="!codigo.trim()">Usar código</button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.cresce { flex: 1; min-width: 0; }
.item { align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.confirma { flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--track); }
.entrada { text-transform: uppercase; letter-spacing: 0.08em; }
</style>
