<script setup>
// Cria convite (código + link) e lista os que ainda valem. O código aparece só na hora em que é criado.
import { ref } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao } from '../servicos/sessao.js';
import { data } from '../servicos/calculos.js';
import Aviso from './Aviso.vue';

const props = defineProps({
  pedido: { type: Object, required: true }, // { tipo: 'personal' } ou { tipo: 'grupo', grupo_id }
  papeis: { type: Array, default: () => [] }, // para grupo: [['membro','Membro'], ...]
  ativos: { type: Array, default: () => [] },
  titulo: { type: String, default: 'Convidar' },
  explicacao: { type: String, default: '' },
});
const emit = defineEmits(['mudou']);
const novo = ref(null);
const papel = ref(props.papeis[0]?.[0] || 'membro');
const usos = ref(props.pedido.tipo === 'grupo' ? 30 : 1);
const erro = ref('');
const copiado = ref('');

async function criar() {
  erro.value = ''; copiado.value = '';
  try {
    novo.value = await api.criarConvite({ ...props.pedido, papel: papel.value, usos_max: Number(usos.value) || 1 });
    emit('mudou');
  } catch (e) { erro.value = e.message; }
}
async function revogar(c) {
  erro.value = '';
  try { await api.revogarConvite(c.id); emit('mudou'); } catch (e) { erro.value = e.message; }
}
async function copiar(texto, qual) {
  try { await navigator.clipboard.writeText(texto); copiado.value = qual; } catch { copiado.value = ''; }
}
const formatar = (c) => c.slice(0, 4) + '-' + c.slice(4);
const mensagem = () => `Use este convite no app Meu treino: ${novo.value.link || ''}\nOu digite o código ${formatar(novo.value.codigo)} em Perfil.`;
</script>

<template>
  <section class="cartao pilha" aria-label="Convites">
    <h2>{{ titulo }}</h2>
    <p v-if="explicacao" class="mudo">{{ explicacao }}</p>
    <Aviso :texto="erro" />
    <div class="linha opcoes">
      <div v-if="papeis.length" class="campo">
        <label for="conv-papel">Entra como</label>
        <select id="conv-papel" v-model="papel"><option v-for="[v, n] in papeis" :key="v" :value="v">{{ n }}</option></select>
      </div>
      <div class="campo">
        <label for="conv-usos">Pode ser usado por</label>
        <select id="conv-usos" v-model.number="usos">
          <option :value="1">1 pessoa</option><option :value="5">até 5 pessoas</option><option :value="30">até 30 pessoas</option>
        </select>
      </div>
      <button class="botao" type="button" :disabled="!!sessao.verComo" @click="criar">Gerar convite</button>
    </div>

    <div v-if="novo" class="novo pilha" role="status">
      <p class="codigo" aria-label="Código do convite">{{ formatar(novo.codigo) }}</p>
      <p class="mudo">Vale até {{ data(novo.expira_em) }}. Anote ou envie agora: depois o código não aparece mais.</p>
      <div class="linha" style="flex-wrap: wrap">
        <button class="botao secundario pequeno" type="button" @click="copiar(mensagem(), 'msg')">{{ copiado === 'msg' ? 'Mensagem copiada' : 'Copiar mensagem com link' }}</button>
        <button class="botao secundario pequeno" type="button" @click="copiar(novo.codigo, 'cod')">{{ copiado === 'cod' ? 'Código copiado' : 'Copiar só o código' }}</button>
      </div>
    </div>

    <div v-if="ativos.length" class="pilha">
      <p class="rotulo-secao">Convites valendo</p>
      <div v-for="c in ativos" :key="c.id" class="linha ativo">
        <span class="cresce">…{{ c.final_codigo }} · {{ c.usos }} de {{ c.usos_max }} usados · até {{ data(c.expira_em) }}<template v-if="c.papel && c.tipo === 'grupo'"> · {{ c.papel }}</template></span>
        <button class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="revogar(c)">Cancelar</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.opcoes { flex-wrap: wrap; align-items: flex-end; }
.opcoes .campo { min-width: 160px; }
.novo { padding: 12px 16px; border-radius: 12px; background: var(--accent-soft); }
.codigo { font-size: 32px; font-weight: 700; letter-spacing: 0.12em; color: var(--accent-ink); font-variant-numeric: tabular-nums; }
.ativo { font-size: 14px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.cresce { flex: 1; min-width: 0; }
</style>
