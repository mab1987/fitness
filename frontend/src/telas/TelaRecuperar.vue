<script setup>
import { ref } from 'vue';
import { api } from '../servicos/dados.js';
import Aviso from '../componentes/Aviso.vue';

const email = ref('');
const erro = ref('');
const enviado = ref(false);
const enviando = ref(false);

async function enviar() {
  erro.value = '';
  enviando.value = true;
  try {
    await api.pedirRecuperacao({ email: email.value.trim() });
    enviado.value = true;
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="tela-auth">
    <form class="cartao pilha" novalidate @submit.prevent="enviar">
      <h1>Recuperar senha</h1>
      <Aviso :texto="erro" />
      <Aviso v-if="enviado" tipo="sucesso" texto="Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora." />
      <template v-else>
        <div class="campo">
          <label for="email">E-mail da conta</label>
          <input id="email" v-model="email" type="email" autocomplete="email" autocapitalize="none" maxlength="120" />
        </div>
        <button class="botao largo" type="submit" :disabled="enviando">{{ enviando ? 'Enviando…' : 'Enviar link' }}</button>
      </template>
      <RouterLink to="/entrar">Voltar para entrar</RouterLink>
    </form>
  </main>
</template>
