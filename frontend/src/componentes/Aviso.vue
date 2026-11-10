<script setup>
// Mensagem de erro ou sucesso. Sempre com ícone e texto: nunca depende só da cor.
defineProps({
  tipo: { type: String, default: 'erro' },
  texto: { type: String, default: '' },
});
</script>

<template>
  <div v-if="texto" class="aviso" :class="tipo" role="alert">
    <svg v-if="tipo === 'erro'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
    <span><strong>{{ tipo === 'erro' ? 'Erro:' : 'Pronto:' }}</strong> {{ texto }}</span>
  </div>
</template>

<style scoped>
.aviso { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; font-size: 14px; }
.aviso svg { flex-shrink: 0; margin-top: 1px; }
.erro { background: var(--perigo-fundo); color: var(--perigo); }
.sucesso { background: var(--track); color: var(--ok); } /* verde neutro: não se confunde com erro em nenhuma paleta */
</style>
