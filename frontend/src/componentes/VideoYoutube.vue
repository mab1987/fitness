<script setup>
// Vídeo do YouTube só carrega quando a pessoa pede (economiza dados e não rastreia antes disso).
import { ref, computed } from 'vue';
import { idYoutube } from '../servicos/calculos.js';

const props = defineProps({ url: { type: String, default: '' }, titulo: { type: String, default: 'Vídeo do exercício' } });
const aberto = ref(false);
const id = computed(() => idYoutube(props.url));
const endereco = computed(() => (id.value ? `https://www.youtube-nocookie.com/embed/${id.value}?rel=0&modestbranding=1&playsinline=1` : ''));
</script>

<template>
  <template v-if="id">
    <button v-if="!aberto" class="botao texto pequeno" type="button" @click="aberto = true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      Vídeo
    </button>
    <div v-else class="video">
      <iframe :src="endereco" :title="titulo" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture" allowfullscreen sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
      <button class="botao texto pequeno" type="button" @click="aberto = false">Fechar vídeo</button>
    </div>
  </template>
</template>

<style scoped>
.botao.texto { display: inline-flex; align-items: center; gap: 4px; }
.video { width: 100%; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 12px; background: #000; }
</style>
