<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin } from '../servicos/sessao.js';
import { data } from '../servicos/calculos.js';
import Aviso from '../componentes/Aviso.vue';
import Convites from '../componentes/Convites.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const g = ref(null);
const erro = ref('');
const confirmar = ref(null);
const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const NOMES = { membro: 'Membro', personal: 'Personal', gerente: 'Gerente' };
const papeisConvite = computed(() => {
  const l = [['membro', 'Membro (aluno)'], ['personal', 'Personal']];
  if (adminReal.value) l.push(['gerente', 'Gerente']);
  return l;
});

async function carregar() {
  erro.value = '';
  try { g.value = await api.lerGrupo(props.id); } catch (e) { erro.value = e.message; }
}
onMounted(carregar);

async function mudarPapel(m, papel) {
  erro.value = '';
  try { await api.papelMembro({ grupo_id: props.id, membro_id: m.id, papel }); await carregar(); } catch (e) { erro.value = e.message; await carregar(); }
}
async function remover(m) {
  erro.value = '';
  try { await api.removerMembro({ grupo_id: props.id, membro_id: m.id }); confirmar.value = null; await carregar(); } catch (e) { erro.value = e.message; }
}
async function excluirGrupo() {
  try { await api.excluirGrupo(props.id); router.replace('/painel/grupos'); } catch (e) { erro.value = e.message; }
}
function quando(iso) {
  if (!iso) return '—';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel/grupos">← Grupos</RouterLink>
    <Aviso :texto="erro" />
    <template v-if="g">
      <div>
        <h1>{{ g.grupo.nome }}</h1>
        <p class="mudo">{{ g.grupo.descricao }}<template v-if="g.gerentes.length"> · gerente: {{ g.gerentes.join(', ') }}</template></p>
      </div>

      <template v-if="g.membros">
        <div class="linha resumo">
          <div class="cartao num"><strong>{{ g.resumo.membros }}</strong><span class="mudo">participantes</span></div>
          <div class="cartao num"><strong>{{ g.resumo.ativos_7d }}</strong><span class="mudo">treinaram nos últimos 7 dias</span></div>
          <div class="cartao num"><strong>{{ g.resumo.treinos_30d }}</strong><span class="mudo">treinos em 30 dias</span></div>
        </div>

        <div class="cartao rolagem">
          <table>
            <thead><tr><th>Nome</th><th>Papel</th><th>Último treino</th><th>7 dias</th><th>30 dias</th><th></th></tr></thead>
            <tbody>
              <tr v-for="m in g.membros" :key="m.id">
                <td><strong>{{ m.nome }}</strong><br /><span class="mudo">{{ m.email }}</span></td>
                <td>
                  <span v-if="m.papel === 'gerente' && !adminReal">Gerente</span>
                  <template v-else>
                    <label class="visualmente-oculto" :for="'pp-' + m.id">Papel de {{ m.nome }}</label>
                    <select :id="'pp-' + m.id" class="entrada mini" :value="m.papel" :disabled="!!sessao.verComo" @change="mudarPapel(m, $event.target.value)">
                      <option value="membro">Membro</option><option value="personal">Personal</option><option v-if="adminReal" value="gerente">Gerente</option>
                    </select>
                  </template>
                </td>
                <td>{{ quando(m.ultimo_treino) }}</td>
                <td>{{ m.treinos_7d }}</td>
                <td>{{ m.treinos_30d }}</td>
                <td>
                  <template v-if="m.papel !== 'gerente' || adminReal">
                    <button v-if="confirmar !== m.id" class="botao texto pequeno" type="button" :disabled="!!sessao.verComo" @click="confirmar = m.id">Remover</button>
                    <span v-else class="linha"><button class="botao perigo pequeno" type="button" @click="remover(m)">Remover</button><button class="botao secundario pequeno" type="button" @click="confirmar = null">Não</button></span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mudo">O gerente vê só nomes e quantidade de treinos. Cargas e séries ficam entre o aluno e o personal dele.</p>

        <Convites :pedido="{ tipo: 'grupo', grupo_id: id }" :papeis="papeisConvite" :ativos="g.convites" titulo="Convidar para o grupo"
          explicacao="Um código pode servir para a turma inteira. Quem entra como personal precisa ter o papel de personal ativo." @mudou="carregar" />

        <div v-if="adminReal" class="fim">
          <button v-if="confirmar !== 'grupo'" class="botao texto pequeno" type="button" @click="confirmar = 'grupo'">Excluir grupo</button>
          <span v-else class="linha" role="alert" style="flex-wrap: wrap">Excluir o grupo? Os treinos das pessoas continuam.
            <button class="botao perigo pequeno" type="button" @click="excluirGrupo">Excluir</button>
            <button class="botao secundario pequeno" type="button" @click="confirmar = null">Voltar</button></span>
        </div>
      </template>
      <p v-else class="cartao">Você participa deste grupo como {{ NOMES[g.meu_papel] || g.meu_papel }}.</p>
    </template>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.resumo { flex-wrap: wrap; align-items: stretch; }
.num { flex: 1; min-width: 150px; display: flex; flex-direction: column; }
.num strong { font-size: 24px; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 14px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.mini { height: 40px; width: auto; padding: 0 8px; }
.fim { padding-top: 12px; border-top: 1px solid var(--line); }
</style>
