<script setup>
// Conversa sobre um treino entre o aluno e o personal. O texto aparece sempre como texto comum.
import { ref } from 'vue';
import { data, hora } from '../servicos/calculos.js';

const props = defineProps({
  comentarios: { type: Array, required: true },
  meuId: { type: String, default: '' },
  enviar: { type: Function, default: null }, // (texto) => Promise; sem ela, só leitura
  rotulo: { type: String, default: 'Comentar este treino' },
});
const texto = ref('');
const erro = ref('');
const enviando = ref(false);
const id = Math.random().toString(36).slice(2);

async function mandar() {
  const t = texto.value.trim();
  if (!t) return;
  erro.value = '';
  enviando.value = true;
  try {
    await props.enviar(t);
    texto.value = '';
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="comentarios pilha">
    <div v-for="c in comentarios" :key="c.id" class="msg" :class="{ minha: c.autor_id === meuId }">
      <span class="quem">{{ c.autor_id === meuId ? 'Você' : c.autor_nome }} · {{ data(c.criado_em) }}, {{ hora(c.criado_em) }}
        <span v-if="!c.visto && c.autor_id !== meuId" class="selo">novo</span></span>
      <p class="texto">{{ c.texto }}</p>
    </div>
    <form v-if="enviar" class="linha envio" @submit.prevent="mandar">
      <label class="visualmente-oculto" :for="'com-' + id">{{ rotulo }}</label>
      <input :id="'com-' + id" v-model="texto" class="entrada cresce" maxlength="1000" :placeholder="rotulo" autocomplete="off" />
      <button class="botao pequeno" type="submit" :disabled="enviando || !texto.trim()">Enviar</button>
    </form>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
  </div>
</template>

<style scoped>
.comentarios { gap: 8px; }
.msg { padding: 8px 12px; border-radius: 12px; background: var(--track); max-width: 90%; align-self: flex-start; }
.msg.minha { background: var(--accent-soft); align-self: flex-end; }
.quem { font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center; }
.texto { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; }
.envio { gap: 8px; }
.cresce { flex: 1; min-width: 0; height: 40px; }
.erro { color: var(--perigo); font-size: 13px; }
</style>
