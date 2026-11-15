<script setup>
// Administrador: pedidos para liberar, chave Pix, preços, cortesias e lotes de licenças.
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, textoPlano } from '../servicos/sessao.js';
import { data, hora, lerNumero } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';

const pedidos = ref([]);
const precos = ref([]);
const config = reactive({ chave_pix: '', nome_recebedor: '', cidade: '', incremento_padrao_kg: 2.5 });
const usuarios = ref([]);
const msg = reactive({ erro: '', ok: '' });
const filtro = ref('abertos');
const alvoId = ref('');
const alvo = ref(null);
const conceder = reactive({ modo: 'dias', dias: 30, ate: '', periodo: 'mensal', quantidade: 5 });
const confirmarCancelar = ref(null);
const NOMES = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
const STATUS = { aguardando: 'Aguardando pagamento', informado: 'Disse que pagou', liberado: 'Liberado', cancelado: 'Cancelado' };
const reais = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
const lista = computed(() => (filtro.value === 'abertos' ? pedidos.value.filter((p) => p.status === 'aguardando' || p.status === 'informado') : pedidos.value));
const abertos = computed(() => pedidos.value.filter((p) => p.status === 'informado').length);

function avisar(ok, erro = '') { msg.ok = ok; msg.erro = erro; }
async function carregar() {
  try {
    const [p, pr, c, u] = await Promise.all([api.pedidosAdmin(), api.precosAdmin(), api.configAdmin(), api.listarUsuarios()]);
    pedidos.value = p; precos.value = pr.map((x) => ({ ...x, texto: String(x.valor).replace('.', ',') })); Object.assign(config, c); usuarios.value = u.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } catch (e) { avisar('', e.message); }
}
onMounted(carregar);

async function liberar(p) {
  try { await api.liberarPedido(p.id); avisar(`Pedido ${p.codigo_referencia} liberado para ${p.comprador_nome}.`); await carregar(); } catch (e) { avisar('', e.message); }
}
async function cancelar(p) {
  try { await api.cancelarPedidoAdmin({ id: p.id, observacao: 'Cancelado pelo administrador' }); confirmarCancelar.value = null; avisar('Pedido cancelado.'); await carregar(); } catch (e) { avisar('', e.message); }
}
async function salvarConfig() {
  try { Object.assign(config, await api.salvarConfig({ ...config })); avisar('Dados do Pix salvos.'); } catch (e) { avisar('', e.message); }
}
async function salvarPrecos() {
  try {
    const l = precos.value.map((p) => ({ id: p.id, valor: lerNumero(p.texto), ativo: p.ativo }));
    if (l.some((p) => !p.valor || p.valor <= 0)) { avisar('', 'Preencha todos os valores.'); return; }
    precos.value = (await api.salvarPrecos(l)).map((x) => ({ ...x, texto: String(x.valor).replace('.', ',') }));
    avisar('Preços salvos. Pedidos já feitos mantêm o valor da compra.');
  } catch (e) { avisar('', e.message); }
}
async function abrirAlvo() {
  alvo.value = null;
  if (!alvoId.value) return;
  try { alvo.value = { usuario: usuarios.value.find((u) => u.id === alvoId.value), ...(await api.licencasUsuario(alvoId.value)) }; } catch (e) { avisar('', e.message); }
}
function regra() {
  const d = { modo: conceder.modo };
  if (conceder.modo === 'dias') d.dias = conceder.dias;
  if (conceder.modo === 'periodo') d.periodo = conceder.periodo;
  if (conceder.modo === 'ate') d.ate = conceder.ate ? new Date(conceder.ate + 'T23:59:00').toISOString() : '';
  return d;
}
async function darCortesia() {
  try { await api.cortesia({ usuario_id: alvoId.value, ...regra() }); avisar(`Premium concedido a ${alvo.value.usuario.nome}.`); await abrirAlvo(); } catch (e) { avisar('', e.message); }
}
async function darLote() {
  try { const r = await api.lote({ personal_id: alvoId.value, quantidade: conceder.quantidade, ...regra() }); avisar(`${r.criadas} licença(s) no saldo de ${alvo.value.usuario.nome}.`); await abrirAlvo(); } catch (e) { avisar('', e.message); }
}
async function revogar(l) {
  try { await api.revogarLicenca(l.id); avisar('Licença revogada.'); await abrirAlvo(); } catch (e) { avisar('', e.message); }
}
const ORIGENS = { compra: 'compra', cortesia: 'cortesia', personal: 'dada pelo personal', lote: 'lote' };
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>Premium e vendas</h1>
    <Aviso :texto="msg.erro" />
    <Aviso tipo="sucesso" :texto="msg.ok" />

    <section class="cartao pilha" aria-labelledby="t-ped">
      <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
        <h2 id="t-ped">Pedidos <span v-if="abertos" class="selo">{{ abertos }} para conferir</span></h2>
        <div class="segmentado dois" role="group" aria-label="Quais pedidos">
          <button type="button" :aria-pressed="filtro === 'abertos'" @click="filtro = 'abertos'">Em aberto</button>
          <button type="button" :aria-pressed="filtro === 'todos'" @click="filtro = 'todos'">Todos</button>
        </div>
      </div>
      <p class="mudo">Confira no extrato do banco o valor e o código do pedido (aparece na descrição do Pix) antes de liberar.</p>
      <p v-if="!lista.length" class="vazio">Nenhum pedido {{ filtro === 'abertos' ? 'em aberto' : '' }}.</p>
      <div v-if="lista.length" class="rolagem">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Valor</th><th>Código</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in lista" :key="p.id">
              <td>{{ data(p.criado_em) }}<br /><span class="mudo">{{ hora(p.criado_em) }}</span></td>
              <td>{{ p.comprador_nome }}<br /><span class="mudo">{{ p.comprador_email }}</span></td>
              <td>{{ NOMES[p.periodo] }}<template v-if="p.tipo === 'personal'"> · {{ p.quantidade }} licença(s)</template></td>
              <td><strong>{{ reais(p.valor) }}</strong></td>
              <td><code>{{ p.codigo_referencia }}</code></td>
              <td>{{ STATUS[p.status] }}</td>
              <td class="acoes">
                <template v-if="p.status === 'aguardando' || p.status === 'informado'">
                  <button class="botao pequeno" type="button" :disabled="!!sessao.verComo" @click="liberar(p)">Liberar</button>
                  <button v-if="confirmarCancelar !== p.id" class="botao texto pequeno" type="button" @click="confirmarCancelar = p.id">Cancelar</button>
                  <button v-else class="botao perigo pequeno" type="button" @click="cancelar(p)">Confirmar</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="cartao pilha" aria-labelledby="t-con">
      <h2 id="t-con">Dar premium ou licenças</h2>
      <div class="campo">
        <label for="alvo">Pessoa</label>
        <select id="alvo" v-model="alvoId" @change="abrirAlvo">
          <option value="">Escolha…</option>
          <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.nome }} · {{ u.email }}{{ u.personal_ativo ? ' · personal' : '' }}</option>
        </select>
      </div>
      <template v-if="alvo">
        <p>Plano atual: <strong>{{ textoPlano(alvo.plano) }}</strong></p>
        <div class="grade-campos">
          <div class="campo">
            <label for="modo">Prazo</label>
            <select id="modo" v-model="conceder.modo">
              <option value="dias">Por dias</option><option value="periodo">Por período</option><option value="ate">Até uma data</option><option value="sem_prazo">Sem prazo</option>
            </select>
          </div>
          <div v-if="conceder.modo === 'dias'" class="campo"><label for="dias">Dias</label><input id="dias" v-model.number="conceder.dias" type="number" min="1" max="3650" /></div>
          <div v-if="conceder.modo === 'periodo'" class="campo"><label for="per">Período</label>
            <select id="per" v-model="conceder.periodo"><option v-for="(n, k) in NOMES" :key="k" :value="k">{{ n }}</option></select></div>
          <div v-if="conceder.modo === 'ate'" class="campo"><label for="ate">Até</label><input id="ate" v-model="conceder.ate" type="date" /></div>
        </div>
        <div class="linha" style="flex-wrap: wrap">
          <button class="botao" type="button" :disabled="!!sessao.verComo" @click="darCortesia">Dar premium (cortesia)</button>
        </div>
        <div v-if="alvo.usuario?.personal_ativo" class="linha lote">
          <div class="campo"><label for="qtd-l">Licenças para o personal distribuir</label><input id="qtd-l" v-model.number="conceder.quantidade" type="number" min="1" max="100" /></div>
          <button class="botao secundario" type="button" :disabled="!!sessao.verComo" @click="darLote">Dar lote</button>
        </div>
        <p v-if="alvo.saldo" class="mudo">Saldo do personal: {{ alvo.saldo.filter((s) => !s.atribuida_a).length }} livre(s), {{ alvo.saldo.filter((s) => s.atribuida_a).length }} em uso.</p>
        <div v-if="alvo.licencas.length" class="pilha">
          <p class="rotulo-secao">Licenças</p>
          <div v-for="l in alvo.licencas" :key="l.id" class="linha item">
            <span class="cresce">{{ ORIGENS[l.origem] || l.origem }} · de {{ data(l.inicio) }} {{ l.fim ? 'até ' + data(l.fim) : 'sem prazo' }}</span>
            <button class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="revogar(l)">Revogar</button>
          </div>
        </div>
      </template>
    </section>

    <section class="cartao pilha" aria-labelledby="t-pix">
      <h2 id="t-pix">Dados do Pix</h2>
      <p class="mudo">Aparecem no Pix copia e cola dos pedidos. Use uma chave sua (CPF, e-mail, celular com +55 ou chave aleatória).</p>
      <div class="grade-campos">
        <div class="campo"><label for="chave">Chave Pix</label><input id="chave" v-model="config.chave_pix" maxlength="77" autocomplete="off" /></div>
        <div class="campo"><label for="nomer">Nome do recebedor</label><input id="nomer" v-model="config.nome_recebedor" maxlength="60" /></div>
        <div class="campo"><label for="cid">Cidade</label><input id="cid" v-model="config.cidade" maxlength="40" /></div>
        <div class="campo"><label for="inc">Incremento de carga padrão (kg)</label><input id="inc" v-model.number="config.incremento_padrao_kg" type="number" step="0.25" min="0.25" max="20" /></div>
      </div>
      <button class="botao" type="button" style="align-self: flex-start" :disabled="!!sessao.verComo" @click="salvarConfig">Salvar</button>
    </section>

    <section class="cartao pilha" aria-labelledby="t-pr">
      <h2 id="t-pr">Preços (R$)</h2>
      <div class="rolagem">
        <table>
          <thead><tr><th>Para</th><th>Período</th><th>Valor</th><th>À venda</th></tr></thead>
          <tbody>
            <tr v-for="p in precos" :key="p.id">
              <td>{{ p.publico === 'aluno' ? 'Aluno' : 'Personal (por licença)' }}</td>
              <td>{{ NOMES[p.periodo] }}</td>
              <td><label class="visualmente-oculto" :for="'v-' + p.id">Valor</label><input :id="'v-' + p.id" v-model="p.texto" class="entrada mini" inputmode="decimal" maxlength="8" /></td>
              <td><input v-model="p.ativo" type="checkbox" :aria-label="'À venda: ' + NOMES[p.periodo]" style="width: 20px; height: 20px" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="botao" type="button" style="align-self: flex-start" :disabled="!!sessao.verComo" @click="salvarPrecos">Salvar preços</button>
    </section>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.segmentado.dois { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 220px; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.acoes { white-space: nowrap; }
.mini { height: 40px; width: 110px; }
.lote { align-items: flex-end; flex-wrap: wrap; }
.item { font-size: 14px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.cresce { flex: 1; min-width: 0; }
</style>
