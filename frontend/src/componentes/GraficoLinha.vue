<script setup>
// Gráfico de linha simples, desenhado em SVG (sem biblioteca).
// Uma série; passe o mouse ou o dedo para ver cada ponto. Há também a tabela com os mesmos dados.
import { computed, ref } from 'vue';
import { kg, dataCurta, data } from '../servicos/calculos.js';

const props = defineProps({
  pontos: { type: Array, required: true }, // [{ data, valor, carga, reps }]
  unidade: { type: String, default: 'kg' },
  titulo: { type: String, default: '' },
  vazio: { type: String, default: 'Sem registros com carga neste período.' },
});

const L = 640, A = 240, M = { e: 44, d: 12, t: 12, b: 28 };
const foco = ref(null);
const tabela = ref(false);

const escala = computed(() => {
  const p = props.pontos;
  if (!p.length) return null;
  const t0 = new Date(p[0].data).getTime();
  const t1 = new Date(p[p.length - 1].data).getTime();
  const vals = p.map((x) => x.valor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 5; max += 5; }
  const passo = passoBonito((max - min) / 4);
  min = Math.max(0, Math.floor(min / passo) * passo);
  max = Math.ceil(max / passo) * passo;
  const x = (t) => (t1 === t0 ? (M.e + L - M.d) / 2 : M.e + ((t - t0) / (t1 - t0)) * (L - M.e - M.d));
  const y = (v) => M.t + (1 - (v - min) / (max - min)) * (A - M.t - M.b);
  const marcas = [];
  for (let v = min; v <= max + 1e-9; v += passo) marcas.push(v);
  return { x, y, marcas, t0, t1 };
});

function passoBonito(bruto) {
  const pot = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
}

const coords = computed(() => (escala.value ? props.pontos.map((p) => ({ ...p, cx: escala.value.x(new Date(p.data).getTime()), cy: escala.value.y(p.valor) })) : []));
const caminho = computed(() => coords.value.map((c, i) => (i ? 'L' : 'M') + c.cx.toFixed(1) + ' ' + c.cy.toFixed(1)).join(' '));
const rotulosX = computed(() => {
  const c = coords.value;
  if (c.length <= 1) return c;
  const n = Math.min(5, c.length);
  return Array.from({ length: n }, (_, i) => c[Math.round((i * (c.length - 1)) / (n - 1))]);
});
const recorde = computed(() => coords.value.reduce((m, c) => (!m || c.valor > m.valor ? c : m), null));

function mover(ev) {
  const svg = ev.currentTarget;
  const r = svg.getBoundingClientRect();
  const px = ((ev.clientX - r.left) / r.width) * L;
  let melhor = null;
  for (const c of coords.value) if (!melhor || Math.abs(c.cx - px) < Math.abs(melhor.cx - px)) melhor = c;
  foco.value = melhor;
}
</script>

<template>
  <figure class="grafico">
    <figcaption class="visualmente-oculto">{{ titulo }}</figcaption>
    <div v-if="!pontos.length" class="vazio">{{ vazio }}</div>
    <template v-else>
      <div class="area">
        <svg :viewBox="`0 0 ${L} ${A}`" role="img" :aria-label="titulo + ': ' + pontos.length + ' treinos'" @pointermove="mover" @pointerdown="mover" @pointerleave="foco = null">
          <g class="grade">
            <template v-for="v in escala.marcas" :key="v">
              <line :x1="M.e" :x2="L - M.d" :y1="escala.y(v)" :y2="escala.y(v)" />
              <text :x="M.e - 8" :y="escala.y(v) + 4" text-anchor="end">{{ kg(v) }}</text>
            </template>
            <text v-for="(c, i) in rotulosX" :key="c.data" :x="c.cx" :y="A - 8" :text-anchor="rotulosX.length > 1 && i === 0 ? 'start' : rotulosX.length > 1 && i === rotulosX.length - 1 ? 'end' : 'middle'">{{ dataCurta(c.data) }}</text>
          </g>
          <path :d="caminho" class="linha" />
          <circle v-if="recorde" :cx="recorde.cx" :cy="recorde.cy" r="5" class="ponto" />
          <g v-if="foco">
            <line class="mira" :x1="foco.cx" :x2="foco.cx" :y1="M.t" :y2="A - M.b" />
            <circle :cx="foco.cx" :cy="foco.cy" r="6" class="ponto foco" />
          </g>
          <rect :x="0" :y="0" :width="L" :height="A" fill="transparent" />
        </svg>
        <div v-if="foco" class="dica" :style="{ left: Math.min(Math.max((foco.cx / L) * 100, 12), 88) + '%' }" role="status">
          <strong>{{ kg(foco.valor) }} {{ unidade }}</strong>
          <span>{{ data(foco.data) }}<template v-if="foco.reps"> · {{ kg(foco.carga) }} kg × {{ foco.reps }}</template></span>
        </div>
      </div>
      <button class="botao texto pequeno" type="button" :aria-expanded="tabela" @click="tabela = !tabela">{{ tabela ? 'Esconder tabela' : 'Ver como tabela' }}</button>
      <table v-if="tabela">
        <thead><tr><th>Data</th><th>{{ unidade }}</th><th>Carga × reps</th></tr></thead>
        <tbody>
          <tr v-for="p in [...pontos].reverse()" :key="p.data"><td>{{ data(p.data) }}</td><td>{{ kg(p.valor) }}</td><td>{{ kg(p.carga) }}<template v-if="p.reps"> × {{ p.reps }}</template></td></tr>
        </tbody>
      </table>
    </template>
  </figure>
</template>

<style scoped>
.grafico { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.area { position: relative; }
svg { width: 100%; height: auto; display: block; touch-action: pan-y; }
.grade line { stroke: var(--line); stroke-width: 1; }
.grade text { fill: var(--muted); font-size: 12px; }
.linha { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.ponto { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.mira { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
.dica {
  position: absolute; top: 0; transform: translateX(-50%); pointer-events: none;
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px;
  display: flex; flex-direction: column; font-size: 13px; color: var(--text); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); white-space: nowrap;
}
.dica span { color: var(--muted); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 600; }
</style>
