<script setup>
// Plano premium: tempo restante, compra por Pix (copia e cola + QR Code) e pedidos.
import { ref, computed, onMounted } from 'vue';
import QRCode from 'qrcode';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil, papeisEfetivos } from '../servicos/sessao.js';
import { data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';

const precos = ref([]);
const info = ref(null);
const erro = ref('');
const ocupado = ref(false);
const qr = ref({});
const copiado = ref('');
const qtd = ref(5);
const NOMES = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
const MESES = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const STATUS = { aguardando: 'Aguardando pagamento', informado: 'Pagamento informado: em conferência', liberado: 'Liberado', cancelado: 'Cancelado' };
const ehPersonal = computed(() => papeisEfetivos.value.includes('personal'));
const doAluno = computed(() => precos.value.filter((p) => p.publico === 'aluno'));
const doPersonal = computed(() => precos.value.filter((p) => p.publico === 'personal'));
const abertos = computed(() => (info.value?.pedidos || []).filter((p) => p.status === 'aguardando' || p.status === 'informado'));
const outros = computed(() => (info.value?.pedidos || []).filter((p) => p.status !== 'aguardando' && p.status !== 'informado').slice(0, 10));
const plano = computed(() => info.value?.plano || sessao.perfil?.plano);
const reais = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const porMes = (p) => reais(p.valor / MESES[p.periodo]);

async function carregar() {
  erro.value = '';
  try {
    [precos.value, info.value] = await Promise.all([api.precos(), api.minhasLicencas()]);
    for (const p of info.value.pedidos) if (p.pix && !qr.value[p.id]) qr.value[p.id] = await QRCode.toDataURL(p.pix, { margin: 1, width: 220 });
    if (!sessao.verComo) definirPerfil(await api.lerPerfil());
  } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

async function comprar(p, quantidade) {
  erro.value = '';
  ocupado.value = true;
  try {
    await api.criarPedido({ periodo: p.periodo, tipo: p.publico, quantidade });
    await carregar();
    setTimeout(() => document.querySelector('.pedido')?.scrollIntoView({ behavior: 'smooth' }), 50);
  } catch (e) { erro.value = e.message; } finally { ocupado.value = false; }
}
async function paguei(p) { try { await api.paguei(p.id); await carregar(); } catch (e) { erro.value = e.message; } }
async function cancelar(p) { try { await api.cancelarPedido(p.id); await carregar(); } catch (e) { erro.value = e.message; } }
async function copiar(p) {
  try { await navigator.clipboard.writeText(p.pix); copiado.value = p.id; } catch { copiado.value = ''; }
}
</script>

<template>
  <div class="pilha">
    <h1>Premium</h1>
    <Aviso :texto="erro" />

    <section class="cartao pilha estado" aria-labelledby="t-plano">
      <h2 id="t-plano">Seu plano</h2>
      <template v-if="plano?.tipo === 'premium'">
        <p v-if="plano.origem === 'personal' && !plano.fim && plano.dias_restantes == null"><strong>Premium</strong> enquanto seu papel de personal estiver ativo.</p>
        <p v-else-if="!plano.fim"><strong>Premium sem prazo.</strong></p>
        <p v-else><strong>Premium até {{ data(plano.fim) }}</strong> · {{ plano.dias_restantes === 1 ? 'falta 1 dia' : `faltam ${plano.dias_restantes} dias` }}</p>
        <p v-if="plano.fim && plano.dias_restantes <= 7" class="alerta">Está acabando. Renove abaixo: o novo período começa quando este terminar.</p>
      </template>
      <template v-else>
        <p><strong>Plano grátis.</strong> Você treina sem limite de tempo, com até 3 fichas ativas e gráficos do último mês.</p>
      </template>
      <ul class="beneficios">
        <li>Fichas ilimitadas e todos os programas prontos</li>
        <li>Gráficos de todo o período, 1RM estimado e volume por grupo muscular</li>
        <li>Sugestão de carga pelo esforço (RPE)</li>
        <li>Todas as medidas corporais</li>
        <li>Exportar seus dados para planilha</li>
      </ul>
    </section>

    <section v-for="p in abertos" :key="p.id" class="cartao pilha pedido" aria-label="Pedido em aberto">
      <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
        <h2>{{ p.tipo === 'personal' ? `${p.quantidade} licença(s) ${NOMES[p.periodo].toLowerCase()}(s)` : `Premium ${NOMES[p.periodo].toLowerCase()}` }} · {{ reais(p.valor) }}</h2>
        <span class="selo">{{ STATUS[p.status] }}</span>
      </div>
      <template v-if="p.status === 'aguardando'">
        <ol class="passos">
          <li>No app do seu banco, escolha <strong>Pix › Copia e cola</strong> (ou leia o QR Code).</li>
          <li>Confira o valor ({{ reais(p.valor) }}) e o recebedor ({{ p.recebedor || 'o administrador' }}) e pague.</li>
          <li>Volte aqui e toque em <strong>Já paguei</strong>. A liberação é feita em até 2 dias úteis.</li>
        </ol>
        <div class="pix">
          <img v-if="qr[p.id]" :src="qr[p.id]" width="220" height="220" alt="QR Code do Pix deste pedido" />
          <div class="pilha cresce">
            <label class="rotulo" :for="'pix-' + p.id">Pix copia e cola</label>
            <textarea :id="'pix-' + p.id" class="codigo-pix" readonly rows="4" :value="p.pix" @focus="$event.target.select()"></textarea>
            <button class="botao" type="button" @click="copiar(p)">{{ copiado === p.id ? 'Código copiado' : 'Copiar código Pix' }}</button>
            <p class="mudo">Código do pedido: <strong>{{ p.codigo_referencia }}</strong></p>
          </div>
        </div>
        <div class="linha" style="flex-wrap: wrap">
          <button class="botao" type="button" :disabled="!!sessao.verComo" @click="paguei(p)">Já paguei</button>
          <button class="botao secundario" type="button" :disabled="!!sessao.verComo" @click="cancelar(p)">Cancelar pedido</button>
        </div>
      </template>
      <p v-else class="mudo">Recebemos seu aviso em {{ data(p.pago_informado_em) }}. Assim que o pagamento for conferido, {{ p.tipo === 'personal' ? 'as licenças entram no seu saldo' : 'seu premium começa' }}. Se quiser agilizar, envie o comprovante ao administrador com o código {{ p.codigo_referencia }}.</p>
    </section>

    <section v-if="info && !info.pix_disponivel" class="cartao">
      <p>A compra ainda não está disponível: o administrador precisa cadastrar a chave Pix.</p>
    </section>

    <section v-else class="pilha" aria-labelledby="t-comprar">
      <h2 id="t-comprar" class="rotulo-secao">{{ plano?.tipo === 'premium' ? 'Renovar' : 'Assinar' }}</h2>
      <div class="grade-precos">
        <div v-for="p in doAluno" :key="p.id" class="cartao preco">
          <strong>{{ NOMES[p.periodo] }}</strong>
          <span class="valor">{{ reais(p.valor) }}</span>
          <span class="mudo">{{ p.periodo === 'mensal' ? 'por mês' : porMes(p) + ' por mês' }}</span>
          <button class="botao" type="button" :disabled="ocupado || !!sessao.verComo || abertos.length >= 3" @click="comprar(p, 1)">Comprar</button>
        </div>
      </div>
    </section>

    <section v-if="ehPersonal && doPersonal.length && info?.pix_disponivel" class="cartao pilha" aria-labelledby="t-lic">
      <h2 id="t-lic">Licenças para seus alunos</h2>
      <p class="mudo">Preço menor por licença. As licenças vão para o seu saldo e você dá a cada aluno em Painel › Meus alunos.</p>
      <div class="campo quantidade">
        <label for="qtd">Quantidade</label>
        <input id="qtd" v-model.number="qtd" type="number" min="1" max="100" inputmode="numeric" />
      </div>
      <div class="grade-precos">
        <div v-for="p in doPersonal" :key="p.id" class="preco borda">
          <strong>{{ NOMES[p.periodo] }}</strong>
          <span class="valor">{{ reais(p.valor) }}</span>
          <span class="mudo">por licença · total {{ reais(p.valor * (qtd || 1)) }}</span>
          <button class="botao secundario" type="button" :disabled="ocupado || !!sessao.verComo || !(qtd >= 1 && qtd <= 100)" @click="comprar(p, qtd)">Comprar {{ qtd }}</button>
        </div>
      </div>
    </section>

    <section v-if="outros.length" class="pilha" aria-labelledby="t-hist">
      <h2 id="t-hist" class="rotulo-secao">Pedidos anteriores</h2>
      <div v-for="p in outros" :key="p.id" class="linha historico">
        <span class="cresce">{{ data(p.criado_em) }} · {{ NOMES[p.periodo] }}<template v-if="p.quantidade > 1"> × {{ p.quantidade }}</template> · {{ reais(p.valor) }}</span>
        <span class="mudo">{{ STATUS[p.status] }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.estado .alerta { padding: 8px 12px; border-radius: 10px; background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
.beneficios { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 14px; }
.grade-precos { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.preco { display: flex; flex-direction: column; gap: 6px; }
.preco.borda { padding: 12px; border: 1px solid var(--line); border-radius: 14px; }
.valor { font-size: 24px; font-weight: 700; }
.pedido { border: 2px solid var(--accent); }
.passos { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
.pix { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.pix img { border-radius: 12px; background: #fff; padding: 6px; }
.cresce { flex: 1; min-width: 220px; }
.rotulo { font-size: 14px; font-weight: 600; }
.codigo-pix { width: 100%; font: 13px/1.4 ui-monospace, monospace; padding: 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--text); resize: none; word-break: break-all; }
.quantidade { max-width: 160px; }
.historico { font-size: 14px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
</style>
