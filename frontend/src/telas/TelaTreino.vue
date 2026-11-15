<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { treinos, carregarTreinos, guardarAtual, finalizarTreino, descartarTreino, exercicioPorId } from '../servicos/treinos.js';
import { kg, lerNumero, duracao, sugestaoProgresso, ultimaVez, novoId, data, sugestaoCarga } from '../servicos/calculos.js';
import { planoEfetivo } from '../servicos/sessao.js';
import VideoYoutube from '../componentes/VideoYoutube.vue';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const agora = ref(Date.now());
const aberto = ref(0);
const observacao = ref('');
const confirmarDescarte = ref(false);
const finalizado = ref(null);
const erro = ref('');
let relogio = null;
let travaTela = null;

const t = computed(() => treinos.atual);
const ficha = computed(() => treinos.fichas.find((f) => f.id === t.value?.ficha_id));
const item = (ex) => ficha.value?.itens.find((i) => i.id === ex.item_id) || {};
const exercicio = (ex) => exercicioPorId.value.get(ex.exercicio_id) || { nome: 'Exercício' };
const tempo = computed(() => (t.value ? duracao((agora.value - new Date(t.value.inicio).getTime()) / 1000) : ''));
const feitos = computed(() => (t.value ? t.value.exercicios.filter((e) => e.concluido).length : 0));
const restante = computed(() => (t.value?.descanso ? Math.max(0, (t.value.descanso.fim - agora.value) / 1000) : 0));

function detalhe(ex) {
  const i = item(ex);
  const partes = [];
  if (i.reps_atuais || i.reps_prescritas) partes.push(`${i.reps_atuais || i.reps_prescritas} reps`);
  if (i.metodo) partes.push(i.metodo.replace('-', '‑'));
  if (i.descanso_seg) partes.push(`${i.descanso_seg} s`);
  return partes.join(' · ');
}
function resumoFeito(ex) {
  const f = ex.series.filter((s) => s.feita);
  return `${f.length} séries · ${f.map((s) => kg(s.carga)).join(' · ')} kg`;
}
function ultimaTexto(ex) {
  const u = ultimaVez(treinos.historico, ex.exercicio_id);
  if (!u) return 'primeira vez';
  if (u.series.every((s) => s.carga_kg == null)) return 'última: ' + data(u.sessao.inicio);
  return 'última: ' + u.series.map((s) => kg(s.carga_kg)).join(' · ') + ' kg';
}

const premium = computed(() => planoEfetivo.value?.tipo === 'premium');
function sugestao(ex) {
  if (ex.concluido || ex.series.some((s) => s.feita)) return null;
  const sug = sugestaoCarga(item(ex), treinos.historico, { premium: premium.value, incrementoPadrao: treinos.config?.incremento_padrao_kg || 2.5 });
  if (!sug || ex.series.every((s) => s.carga === sug.carga)) return null;
  return sug;
}
function usarSugestao(ex, sug) {
  ex.series.forEach((s) => { if (!s.feita) { s.carga = sug.carga; textos(s); } });
  guardarAtual();
}
function definirEsforco(ex, rpe) {
  ex.rpe = ex.rpe === rpe ? null : rpe;
  guardarAtual();
}

// O texto digitado fica em cargaTxt/repsTxt: assim o relógio da tela (que redesenha a cada 0,25 s)
// não apaga o que a pessoa está digitando. O número vai para carga/reps quando o campo perde o foco.
function textos(s) {
  s.cargaTxt = s.carga == null ? '' : kg(s.carga);
  s.repsTxt = s.reps == null ? '' : String(s.reps);
}
function prepararTextos() {
  t.value?.exercicios.forEach((ex) => ex.series.forEach((s) => {
    if (s.cargaTxt === undefined) s.cargaTxt = s.carga == null ? '' : kg(s.carga);
    if (s.repsTxt === undefined) s.repsTxt = s.reps == null ? '' : String(s.reps);
  }));
}
prepararTextos(); // antes de desenhar a tela: os campos já nascem com o texto certo
function alterar(s, campo, valor) {
  const n = lerNumero(valor);
  s[campo] = n === null ? null : campo === 'reps' ? Math.round(n) : n;
  textos(s);
  guardarAtual();
}

function marcar(ex, s, idx) {
  if (s.cargaTxt !== undefined) { const c = lerNumero(s.cargaTxt); s.carga = c; }
  if (s.repsTxt !== undefined) { const r = lerNumero(s.repsTxt); s.reps = r == null ? null : Math.round(r); }
  s.feita = !s.feita;
  if (s.feita) {
    const i = item(ex);
    const ultimaSerie = ex.series.every((x) => x.feita);
    const fimDoTreino = ultimaSerie && t.value.exercicios.every((e) => e === ex || e.concluido);
    if (!fimDoTreino) iniciarDescanso(i.descanso_seg || 60);
    if (ultimaSerie) concluir(ex);
  } else {
    ex.concluido = false;
  }
  guardarAtual();
}

function concluir(ex) {
  ex.concluido = true;
  const sug = sugestaoProgresso(item(ex), ex.series);
  ex.ajuste = sug ? { ...sug, aceito: null } : null;
  // No premium o card fica aberto para anotar o esforço; avança ao tocar em "Próximo exercício".
  if (!sug && !premium.value) avancar();
}

function responderAjuste(ex, aceito) {
  ex.ajuste.aceito = aceito;
  guardarAtual();
  avancar();
}

function avancar() {
  const i = t.value.exercicios.findIndex((e) => !e.concluido);
  aberto.value = i;
}

function adicionarSerie(ex) {
  const ultima = ex.series[ex.series.length - 1] || {};
  const nova = { id: novoId(), carga: ultima.carga ?? null, reps: ultima.reps ?? null, antes: null, feita: false };
  textos(nova);
  ex.series.push(nova);
  ex.concluido = false;
  guardarAtual();
}

function removerSerie(ex, idx) {
  ex.series.splice(idx, 1);
  ex.concluido = ex.series.length > 0 && ex.series.every((x) => x.feita);
  guardarAtual();
}

function iniciarDescanso(seg) {
  t.value.descanso = { fim: Date.now() + seg * 1000, total: seg, avisado: false };
}
function maisTempo() { t.value.descanso.fim += 15000; t.value.descanso.avisado = false; guardarAtual(); }
function pular() { t.value.descanso = null; guardarAtual(); }

watch(restante, (r) => {
  const d = t.value?.descanso;
  if (d && r <= 0 && !d.avisado) {
    d.avisado = true;
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch { /* sem vibração */ }
    setTimeout(() => { if (t.value?.descanso === d) { t.value.descanso = null; guardarAtual(); } }, 4000);
  }
});

async function terminar() {
  erro.value = '';
  t.value.exercicios.forEach((ex) => ex.series.forEach((x) => {
    if (x.feita && x.cargaTxt !== undefined) x.carga = lerNumero(x.cargaTxt);
    if (x.feita && x.repsTxt !== undefined) { const r = lerNumero(x.repsTxt); x.reps = r == null ? null : Math.round(r); }
  }));
  try {
    const nome = t.value.nome;
    const r = await finalizarTreino(observacao.value);
    finalizado.value = { nome, ...r };
  } catch (e) {
    erro.value = e.message;
  }
}

async function descartar() {
  await descartarTreino();
  router.replace('/');
}

async function manterTelaAcesa() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') travaTela = await navigator.wakeLock.request('screen');
  } catch { /* o aparelho não deixou */ }
}
function aoVoltarParaTela() { if (document.visibilityState === 'visible' && t.value) manterTelaAcesa(); }

onMounted(async () => {
  relogio = setInterval(() => { agora.value = Date.now(); }, 250);
  document.addEventListener('visibilitychange', aoVoltarParaTela);
  await carregarTreinos();
  if (!t.value && !finalizado.value) { router.replace('/'); return; }
  prepararTextos();
  avancar();
  manterTelaAcesa();
});
onBeforeUnmount(() => {
  clearInterval(relogio);
  document.removeEventListener('visibilitychange', aoVoltarParaTela);
  try { travaTela && travaTela.release(); } catch { /* ignora */ }
});
</script>

<template>
  <div v-if="finalizado" class="pilha fim" role="status">
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7 12l3.5 3.5L17 9" /></svg>
    <h1>Tá pago!</h1>
    <p>{{ finalizado.nome }} registrado · {{ finalizado.series }} séries<span v-if="finalizado.ajustes"> · {{ finalizado.ajustes }} carga(s) atualizada(s) na ficha</span>.</p>
    <p class="mudo">{{ treinos.fila.length ? 'Sem internet agora: o treino fica guardado e é enviado sozinho depois.' : 'Tudo enviado.' }}</p>
    <div class="linha" style="flex-wrap: wrap; justify-content: center">
      <RouterLink class="botao" to="/evolucao">Ver evolução</RouterLink>
      <RouterLink class="botao secundario" to="/">Início</RouterLink>
    </div>
  </div>

  <div v-else-if="t" class="pilha">
    <header class="cabecalho-tela">
      <div>
        <h1>{{ t.nome }}</h1>
        <p class="mudo">{{ feitos }} de {{ t.exercicios.length }} exercícios · {{ tempo }}</p>
      </div>
    </header>

    <section v-if="t.descanso" class="descanso" aria-live="polite" aria-label="Descanso">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
      <div class="cresce">
        <template v-if="restante > 0">Descanso <strong class="contador">{{ duracao(restante) }}</strong></template>
        <strong v-else>Hora da próxima série</strong>
      </div>
      <button class="botao no-destaque" type="button" @click="maisTempo">+15 s</button>
      <button class="botao no-destaque" type="button" @click="pular">Pular</button>
    </section>

    <Aviso :texto="erro" />

    <div class="pilha lista">
      <template v-for="(ex, i) in t.exercicios" :key="ex.item_id">
        <section v-if="aberto === i" class="cartao atual pilha" :aria-labelledby="'ex-' + i">
          <div class="linha topo-ex">
            <div class="cresce">
              <h2 :id="'ex-' + i">{{ exercicio(ex).nome }}</h2>
              <p class="mudo">{{ detalhe(ex) }} · carga em kg</p>
              <p v-if="item(ex).observacoes" class="mudo">{{ item(ex).observacoes }}</p>
            </div>
            <VideoYoutube :url="exercicio(ex).video_url" :titulo="'Vídeo: ' + exercicio(ex).nome" />
          </div>

          <div v-if="sugestao(ex)" class="sugestao" role="note">
            <span class="cresce"><strong>Sugestão: {{ kg(sugestao(ex).carga) }} kg</strong> · {{ sugestao(ex).motivo }}</span>
            <button class="botao pequeno" type="button" @click="usarSugestao(ex, sugestao(ex))">Usar</button>
          </div>

          <div v-for="(s, j) in ex.series" :key="s.id" class="serie" :class="{ feita: s.feita }">
            <span class="n"><span class="mudo">Série {{ j + 1 }}</span><span v-if="s.antes" class="antes mudo">ant. {{ kg(s.antes.carga) }}</span></span>
            <label class="visualmente-oculto" :for="'c-' + s.id">Carga da série {{ j + 1 }} em kg</label>
            <input :id="'c-' + s.id" class="num" inputmode="decimal" autocomplete="off" maxlength="7" v-model="s.cargaTxt" placeholder="kg" @change="alterar(s, 'carga', s.cargaTxt)" />
            <span class="mudo" aria-hidden="true">×</span>
            <label class="visualmente-oculto" :for="'r-' + s.id">Repetições da série {{ j + 1 }}</label>
            <input :id="'r-' + s.id" class="num curto" inputmode="numeric" autocomplete="off" maxlength="3" v-model="s.repsTxt" placeholder="reps" @change="alterar(s, 'reps', s.repsTxt)" />
            <button class="check" type="button" :aria-pressed="s.feita" :aria-label="(s.feita ? 'Desmarcar' : 'Marcar') + ' série ' + (j + 1)" @click="marcar(ex, s, j)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            </button>
          </div>
          <div class="linha" style="flex-wrap: wrap">
            <button class="botao texto pequeno" type="button" @click="adicionarSerie(ex)">+ Série</button>
            <button v-if="ex.series.length > 1 && !ex.series[ex.series.length - 1].feita" class="botao texto pequeno" type="button" @click="removerSerie(ex, ex.series.length - 1)">− Série</button>
          </div>

          <button v-if="premium && ex.concluido && !(ex.ajuste && ex.ajuste.aceito === null) && t.exercicios.some((e) => !e.concluido)" class="botao secundario pequeno" type="button" style="align-self: flex-start" @click="avancar">Próximo exercício →</button>

          <div v-if="premium && ex.series.some((s) => s.feita)" class="esforco" role="group" :aria-label="'Esforço em ' + exercicio(ex).nome">
            <span class="mudo">Esforço (RPE):</span>
            <button v-for="r in [6, 7, 8, 9, 10]" :key="r" type="button" class="chip" :aria-pressed="ex.rpe === r" @click="definirEsforco(ex, r)">{{ r }}</button>
            <span class="mudo dica-rpe">10 = não sairia mais nenhuma</span>
          </div>

          <div v-if="ex.ajuste && ex.ajuste.aceito === null" class="ajuste pilha" role="group" aria-label="Atualizar a ficha">
            <p v-if="ex.ajuste.campo === 'carga_atual_kg'"><strong>Você usou {{ kg(ex.ajuste.valor) }} kg.</strong> Usar essa carga no próximo treino?</p>
            <p v-else><strong>Você fez mais repetições ({{ ex.ajuste.valor }}).</strong> Usar como meta no próximo treino?</p>
            <div class="linha">
              <button class="botao pequeno" type="button" @click="responderAjuste(ex, true)">Sim, atualizar</button>
              <button class="botao secundario pequeno" type="button" @click="responderAjuste(ex, false)">Agora não</button>
            </div>
          </div>
        </section>

        <button v-else class="cartao resumo-ex" type="button" @click="aberto = i">
          <span class="bolinha" :class="{ ok: ex.concluido }" aria-hidden="true">
            <svg v-if="ex.concluido" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <span class="cresce texto-ex">
            <strong>{{ exercicio(ex).nome }}</strong>
            <span class="mudo">{{ ex.concluido ? resumoFeito(ex) : (item(ex).series || ex.series.length) + ' × ' + (item(ex).reps_atuais || item(ex).reps_prescritas || '–') + ' · ' + ultimaTexto(ex) }}</span>
            <span v-if="ex.ajuste && ex.ajuste.aceito" class="selo">ficha atualizada</span>
          </span>
          <span class="visualmente-oculto">{{ ex.concluido ? 'feito' : 'a fazer' }}</span>
        </button>
      </template>
    </div>

    <section class="cartao pilha" aria-labelledby="t-fim">
      <h2 id="t-fim" class="visualmente-oculto">Terminar</h2>
      <div class="campo">
        <label for="obs">Como foi? (opcional)</label>
        <textarea id="obs" v-model="observacao" maxlength="500" rows="2"></textarea>
      </div>
      <button class="botao largo enorme" type="button" @click="terminar">Tá pago! Terminar treino</button>
      <template v-if="!confirmarDescarte">
        <button class="botao texto pequeno" type="button" @click="confirmarDescarte = true">Descartar este treino</button>
      </template>
      <div v-else class="linha" role="alert" style="flex-wrap: wrap">
        <span>Apagar o que foi marcado hoje?</span>
        <button class="botao perigo pequeno" type="button" @click="descartar">Apagar</button>
        <button class="botao secundario pequeno" type="button" @click="confirmarDescarte = false">Voltar</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cresce { flex: 1; min-width: 0; }
.descanso {
  position: sticky; top: 8px; z-index: 5; display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: 16px; background: var(--accent); color: var(--on-accent); font-size: 14px; font-weight: 500;
}
.contador { font-size: 20px; margin-left: 4px; }
.no-destaque { height: 44px; padding: 0 12px; background: color-mix(in srgb, var(--on-accent) 18%, transparent); color: var(--on-accent); font-size: 14px; }
.lista { gap: 10px; }
.atual { border: 2px solid var(--accent); }
.topo-ex { align-items: flex-start; }
.serie { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--accent-soft); }
.serie.feita { background: var(--bg); }
.serie .n { width: 58px; flex-shrink: 0; display: flex; flex-direction: column; font-size: 13px; line-height: 1.2; }
.num {
  width: 72px; height: 44px; padding: 0 8px; border-radius: 10px; border: 1px solid var(--line);
  background: var(--surface); color: var(--text); font: inherit; font-size: 17px; font-weight: 600; text-align: center;
}
.num.curto { width: 56px; }
.num:focus { border-color: var(--accent); }
.antes { font-size: 11px; white-space: nowrap; }
.check {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 22px; border: 2px solid var(--line); margin-left: auto;
  background: transparent; color: var(--muted); display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.check[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.ajuste { padding: 12px; border-radius: 12px; background: var(--track); }
.sugestao { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px dashed var(--accent); font-size: 14px; }
.esforco { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 14px; }
.chip { min-width: 40px; height: 36px; border-radius: 18px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
.chip[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.dica-rpe { font-size: 12px; }
.resumo-ex { display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: var(--text); cursor: pointer; width: 100%; }
.texto-ex { display: flex; flex-direction: column; gap: 2px; }
.bolinha { width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; border: 2px solid var(--line); display: flex; align-items: center; justify-content: center; }
.bolinha.ok { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.enorme { height: 56px; font-size: 17px; }
.fim { align-items: center; text-align: center; padding: 40px 16px; color: var(--text); }
.fim svg { color: var(--accent); }
@media (max-width: 380px) {
  .serie .n { width: 50px; font-size: 12px; }
  .num { width: 60px; }
  .num.curto { width: 50px; }
}
</style>
