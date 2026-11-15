<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil } from '../servicos/sessao.js';
import { atualizarDoServidor } from '../servicos/treinos.js';
import Aviso from '../componentes/Aviso.vue';

const props = defineProps({ codigo: { type: String, required: true } });
const router = useRouter();
const info = ref(null);
const erro = ref('');
const feito = ref(null);
const ocupado = ref(false);
const NOMES = { membro: 'membro', personal: 'personal', gerente: 'gerente' };

onMounted(async () => {
  try { info.value = await api.verConvite(props.codigo); } catch (e) { erro.value = e.message; }
});

async function aceitar() {
  erro.value = '';
  ocupado.value = true;
  try {
    feito.value = await api.aceitarConvite(props.codigo);
    definirPerfil(await api.lerPerfil());
    atualizarDoServidor();
  } catch (e) {
    erro.value = e.message;
  } finally {
    ocupado.value = false;
  }
}
</script>

<template>
  <div class="pilha estreita">
    <h1>Convite</h1>
    <Aviso :texto="erro" />
    <p v-if="!info && !erro" class="mudo">Conferindo o convite…</p>

    <section v-if="info && !feito" class="cartao pilha">
      <template v-if="info.tipo === 'personal'">
        <h2>{{ info.de }} quer ser seu personal</h2>
        <p>Ao aceitar, {{ info.de }} passa a ver seus treinos, cargas e evolução, pode montar fichas para você e comentar seus treinos.</p>
        <p class="mudo">Você continua dono dos seus dados e pode encerrar o vínculo quando quiser, em Perfil.</p>
        <p v-if="info.personal_atual" class="aviso-troca"><strong>Atenção:</strong> hoje seu personal é {{ info.personal_atual }}. Aceitar este convite encerra o vínculo com {{ info.personal_atual }}.</p>
      </template>
      <template v-else>
        <h2>Entrar no grupo {{ info.grupo }}</h2>
        <p>Convite de {{ info.de }} para participar como <strong>{{ NOMES[info.papel] || info.papel }}</strong>.</p>
        <p class="mudo">O gerente do grupo vê seu nome e quantos treinos você fez na semana e no mês. Cargas e séries não aparecem para ele.</p>
      </template>
      <div class="linha" style="flex-wrap: wrap">
        <button class="botao" type="button" :disabled="ocupado || !!sessao.verComo" @click="aceitar">{{ ocupado ? 'Aceitando…' : 'Aceitar convite' }}</button>
        <button class="botao secundario" type="button" @click="router.replace('/')">Agora não</button>
      </div>
    </section>

    <section v-if="feito" class="cartao pilha" role="status">
      <h2 v-if="feito.tipo === 'personal'">Pronto: {{ feito.personal }} agora é seu personal.</h2>
      <h2 v-else>Pronto: você entrou no grupo {{ feito.grupo }}.</h2>
      <RouterLink class="botao centro" to="/">Ir para o início</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.estreita { max-width: 560px; }
.aviso-troca { padding: 10px 12px; border-radius: 12px; background: var(--track); }
.centro { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; align-self: flex-start; }
</style>
