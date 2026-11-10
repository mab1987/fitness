<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../servicos/dados.js';
import Aviso from '../componentes/Aviso.vue';

const route = useRoute();
const token = typeof route.query.token === 'string' ? route.query.token : '';
const senha = ref('');
const senha2 = ref('');
const erro = ref('');
const pronto = ref(false);
const enviando = ref(false);

async function salvar() {
  erro.value = '';
  if (senha.value.length < 8) return (erro.value = 'A senha precisa ter pelo menos 8 caracteres.');
  if (senha.value !== senha2.value) return (erro.value = 'As senhas não conferem.');
  enviando.value = true;
  try {
    await api.redefinirSenha({ token, senha_nova: senha.value });
    pronto.value = true;
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="tela-auth">
    <form class="cartao pilha" novalidate @submit.prevent="salvar">
      <h1>Nova senha</h1>
      <Aviso :texto="erro" />
      <template v-if="pronto">
        <Aviso tipo="sucesso" texto="Senha alterada. Já pode entrar com a nova senha." />
        <RouterLink class="botao largo" to="/entrar" style="display: grid; place-items: center; text-decoration: none">Entrar</RouterLink>
      </template>
      <template v-else>
        <div class="campo">
          <label for="s1">Nova senha</label>
          <input id="s1" v-model="senha" type="password" autocomplete="new-password" maxlength="72" />
        </div>
        <div class="campo">
          <label for="s2">Repita a nova senha</label>
          <input id="s2" v-model="senha2" type="password" autocomplete="new-password" maxlength="72" />
        </div>
        <button class="botao largo" type="submit" :disabled="enviando || !token">Salvar senha</button>
        <p v-if="!token" class="mudo">Abra esta página pelo link recebido por e-mail.</p>
      </template>
    </form>
  </main>
</template>
