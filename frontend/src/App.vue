<script setup>
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { logado } from './servicos/sessao.js';

const router = useRouter();
// Se a sessão expirar no servidor, volta para a tela de entrada.
watch(logado, (v) => {
  if (!v && !router.currentRoute.value.meta.publica) router.replace('/entrar');
});
</script>

<template>
  <RouterView />
</template>
