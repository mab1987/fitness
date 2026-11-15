<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';
import Convites from '../componentes/Convites.vue';

const alunos = ref([]);
const convites = ref([]);
const erro = ref('');
const carregado = ref(false);
const saldo = ref([]);
const ok = ref('');
const livres = () => saldo.value.filter((x) => !x.atribuida_a);
const DESCR = (r) => (r === 'sem_prazo' ? 'sem prazo' : r.startsWith('periodo:') ? r.slice(8) : r.startsWith('dias:') ? r.slice(5) + ' dias' : 'até ' + data(r.slice(4)));
async function darPremium(a) {
  erro.value = ''; ok.value = '';
  try { await api.atribuirLicenca({ aluno_id: a.id }); ok.value = `${a.nome} agora é premium.`; await carregar(); } catch (e) { erro.value = e.message; }
}

async function carregar() {
  erro.value = '';
  try {
    [alunos.value, convites.value, { saldo: saldo.value }] = await Promise.all([api.listarAlunos(), api.listarConvites(), api.licencasPersonal()]);
    convites.value = convites.value.filter((c) => c.tipo === 'personal');
  } catch (e) { erro.value = e.message; }
  carregado.value = true;
}
onMounted(carregar);

function frequencia(a) {
  if (!a.ultimo_treino) return 'ainda sem treinos';
  const dias = Math.floor((Date.now() - new Date(a.ultimo_treino).getTime()) / 864e5);
  return dias === 0 ? 'treinou hoje' : dias === 1 ? 'treinou ontem' : `último treino há ${dias} dias`;
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <h1>Meus alunos</h1>
    <Aviso :texto="erro" />
    <Aviso tipo="sucesso" :texto="ok" />

    <p v-if="carregado && !alunos.length" class="cartao vazio">Nenhum aluno ainda. Gere um convite abaixo e envie para o aluno.</p>
    <div v-if="alunos.length" class="cartao rolagem">
      <table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Frequência</th><th>7 dias</th><th>30 dias</th><th>Novidades</th></tr></thead>
        <tbody>
          <tr v-for="a in alunos" :key="a.id">
            <td><RouterLink :to="'/painel/alunos/' + a.id"><strong>{{ a.nome }}</strong></RouterLink><br /><span class="mudo">{{ a.email }}</span></td>
            <td>{{ a.plano === 'premium' ? 'Premium' : 'Grátis' }}
              <button v-if="a.plano !== 'premium' && livres().length" class="botao texto pequeno" type="button" @click="darPremium(a)">Dar premium</button></td>
            <td>{{ frequencia(a) }}<br /><span class="mudo">aluno desde {{ data(a.desde) }}</span></td>
            <td>{{ a.treinos_7d }}</td>
            <td>{{ a.treinos_30d }}</td>
            <td>
              <span v-if="a.ajustes_novos" class="selo">{{ a.ajustes_novos }} ajuste(s)</span>
              <span v-if="a.comentarios_novos" class="selo">{{ a.comentarios_novos }} coment.</span>
              <span v-if="!a.ajustes_novos && !a.comentarios_novos" class="mudo">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="cartao pilha" aria-labelledby="t-lic">
      <div class="linha" style="justify-content: space-between; flex-wrap: wrap">
        <h2 id="t-lic">Licenças premium</h2>
        <RouterLink class="botao secundario pequeno centro" to="/premium">Comprar licenças</RouterLink>
      </div>
      <p><strong>{{ livres().length }}</strong> livre(s) para dar aos alunos<template v-if="livres().length"> ({{ [...new Set(livres().map((x) => DESCR(x.periodo_ou_fim)))].join(', ') }})</template>.</p>
      <div v-for="l in saldo.filter((x) => x.atribuida_a)" :key="l.id" class="linha uso">
        <span class="cresce">{{ l.aluno_nome }}</span>
        <span class="mudo">{{ l.revogada ? 'revogada' : l.fim ? 'até ' + data(l.fim) : 'sem prazo' }}</span>
      </div>
    </section>

    <Convites :pedido="{ tipo: 'personal' }" :ativos="convites" titulo="Convidar aluno"
      explicacao="O aluno abre o link (ou digita o código em Perfil) e aceita. A partir daí você vê os treinos dele e pode montar fichas."
      @mudou="carregar" />
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 680px; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
td .selo { margin: 0 4px 4px 0; }
.uso { font-size: 14px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.cresce { flex: 1; min-width: 0; }
.centro { display: inline-flex; align-items: center; text-decoration: none; }
</style>
