<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil, planoEfetivo, textoPlano } from '../servicos/sessao.js';

const servidor = ref({ estado: 'testando', texto: 'Testando conexão…' });
const primeiroNome = computed(() => (sessao.perfil?.nome || '').split(' ')[0]);

onMounted(async () => {
  try {
    const s = await api.status();
    servidor.value = { estado: 'ok', texto: `Conectado ao servidor · versão ${s.versao}` };
    if (!sessao.verComo) definirPerfil(await api.lerPerfil());
  } catch (e) {
    servidor.value = { estado: 'erro', texto: e.message };
  }
});
</script>

<template>
  <div class="pilha">
    <h1>Olá, {{ primeiroNome }}</h1>

    <section class="cartao pilha" aria-labelledby="t-plano">
      <h2 id="t-plano">Seu plano</h2>
      <p>{{ textoPlano(planoEfetivo) }}</p>
      <p v-if="planoEfetivo && planoEfetivo.tipo !== 'premium'" class="mudo">
        No plano grátis: até 3 fichas, gráficos do último mês e histórico completo para consulta.
      </p>
    </section>

    <section class="cartao pilha" aria-labelledby="t-treino">
      <h2 id="t-treino">Próximo treino</h2>
      <p class="mudo">As fichas e o registro de treino chegam na próxima fase. Seus dados do app antigo serão importados para cá.</p>
    </section>

    <p class="status" :class="servidor.estado" role="status">
      <svg v-if="servidor.estado === 'ok'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
      <svg v-else-if="servidor.estado === 'erro'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>
      {{ servidor.texto }}
    </p>
  </div>
</template>

<style scoped>
.status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.status.ok { color: var(--ok); }
.status.erro { color: var(--perigo); }
</style>
