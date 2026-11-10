<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../servicos/dados.js';
import { iniciarSessao } from '../servicos/sessao.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const route = useRoute();
const login = ref('');
const senha = ref('');
const erro = ref('');
const enviando = ref(false);

async function entrar() {
  erro.value = '';
  if (!login.value.trim() || !senha.value) {
    erro.value = 'Informe e-mail (ou usuário) e senha.';
    return;
  }
  enviando.value = true;
  try {
    iniciarSessao(await api.entrar({ login: login.value.trim(), senha: senha.value }));
    const voltar = typeof route.query.voltar === 'string' && route.query.voltar.startsWith('/') ? route.query.voltar : '/';
    router.replace(voltar);
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="tela-auth">
    <form class="cartao pilha" novalidate @submit.prevent="entrar">
      <div>
        <h1>Meu treino</h1>
        <p class="mudo">Entre para ver e registrar seus treinos.</p>
      </div>
      <Aviso :texto="erro" />
      <div class="campo">
        <label for="login">E-mail ou nome de usuário</label>
        <input id="login" v-model="login" type="text" autocomplete="username" autocapitalize="none" maxlength="120" required />
      </div>
      <div class="campo">
        <label for="senha">Senha</label>
        <input id="senha" v-model="senha" type="password" autocomplete="current-password" maxlength="72" required />
      </div>
      <button class="botao largo" type="submit" :disabled="enviando">{{ enviando ? 'Entrando…' : 'Entrar' }}</button>
      <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
        <RouterLink to="/recuperar">Esqueci a senha</RouterLink>
        <RouterLink to="/cadastro">Criar conta</RouterLink>
      </div>
    </form>
  </main>
</template>
