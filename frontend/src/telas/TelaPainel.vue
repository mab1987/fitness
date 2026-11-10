<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin, papeisEfetivos, textoPlano, PAPEIS_VER_COMO } from '../servicos/sessao.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const usuarios = ref([]);
const erro = ref('');
const carregando = ref(false);
const papelVerComo = ref('aluno_gratis');
const adminReal = computed(() => ehAdmin.value && !sessao.verComo);

async function carregar() {
  if (!adminReal.value) return;
  carregando.value = true;
  erro.value = '';
  try {
    usuarios.value = await api.listarUsuarios();
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

async function alternarPersonal(u) {
  erro.value = '';
  try {
    await api.definirPersonal({ usuario_id: u.id, ativo: !u.personal_ativo });
    await carregar();
  } catch (e) {
    erro.value = e.message;
  }
}

async function verComo() {
  erro.value = '';
  try {
    await api.registrarVerComo(papelVerComo.value);
    sessao.verComo = papelVerComo.value;
    router.push('/');
  } catch (e) {
    erro.value = e.message;
  }
}

onMounted(carregar);
</script>

<template>
  <div class="pilha">
    <h1>Painel</h1>
    <Aviso :texto="erro" />

    <template v-if="adminReal">
      <section class="cartao pilha" aria-labelledby="t-ver">
        <h2 id="t-ver">Ver o app como outro papel</h2>
        <p class="mudo">Mostra as telas como esse papel vê. Nada é alterado enquanto o modo estiver ativo.</p>
        <div class="linha" style="flex-wrap: wrap">
          <label class="visualmente-oculto" for="papel">Papel</label>
          <select id="papel" v-model="papelVerComo" class="seletor">
            <option v-for="p in PAPEIS_VER_COMO" :key="p.id" :value="p.id">{{ p.nome }}</option>
          </select>
          <button class="botao" type="button" @click="verComo">Ver como</button>
        </div>
      </section>

      <section class="cartao pilha" aria-labelledby="t-usuarios">
        <div class="linha" style="justify-content: space-between">
          <h2 id="t-usuarios">Usuários</h2>
          <button class="botao texto" type="button" :disabled="carregando" @click="carregar">{{ carregando ? 'Carregando…' : 'Atualizar' }}</button>
        </div>
        <div class="rolagem">
          <table>
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>CPF</th><th>Plano</th><th>Personal</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in usuarios" :key="u.id">
                <td>{{ u.nome }} <span v-if="u.admin" class="selo">admin</span></td>
                <td>{{ u.email }}</td>
                <td>{{ u.cpf_mascarado }}</td>
                <td>{{ textoPlano(u.plano) }}</td>
                <td>
                  <button class="botao secundario" type="button" :aria-pressed="!!u.personal_ativo" @click="alternarPersonal(u)">
                    {{ u.personal_ativo ? 'Ativo · desativar' : 'Tornar personal' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <section v-else-if="papeisEfetivos.includes('personal')" class="cartao pilha">
      <h2>Seus alunos</h2>
      <p class="mudo">Na fase 2 você vai cadastrar alunos, prescrever fichas e acompanhar os treinos por aqui.</p>
    </section>

    <section v-else-if="papeisEfetivos.includes('gerente')" class="cartao pilha">
      <h2>Seu grupo</h2>
      <p class="mudo">Na fase 2 você vai gerenciar membros e personais do grupo por aqui.</p>
    </section>
  </div>
</template>

<style scoped>
.seletor { height: 48px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
td .botao { height: 40px; font-size: 14px; }
</style>
