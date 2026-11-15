<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../servicos/dados.js';
import { sessao, textoPlano } from '../servicos/sessao.js';
import Aviso from '../componentes/Aviso.vue';

const usuarios = ref([]);
const erro = ref('');
const busca = ref('');
const carregando = ref(false);

async function carregar() {
  carregando.value = true; erro.value = '';
  try { usuarios.value = await api.listarUsuarios(); } catch (e) { erro.value = e.message; } finally { carregando.value = false; }
}
onMounted(carregar);

const lista = computed(() => {
  const q = busca.value.trim().toLowerCase();
  return usuarios.value
    .filter((u) => !q || (u.nome + ' ' + u.email + ' ' + (u.usuario || '')).toLowerCase().includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
});

async function alternar(u, campo) {
  erro.value = '';
  try {
    const novo = await api.atualizarUsuario({ usuario_id: u.id, [campo]: !u[campo] });
    Object.assign(u, novo);
  } catch (e) { erro.value = e.message; }
}
</script>

<template>
  <div class="pilha">
    <RouterLink class="voltar" to="/painel">← Painel</RouterLink>
    <div class="cabecalho-tela">
      <h1>Usuários</h1>
      <button class="botao texto" type="button" :disabled="carregando" @click="carregar">{{ carregando ? 'Carregando…' : 'Atualizar' }}</button>
    </div>
    <Aviso :texto="erro" />
    <div class="campo"><label for="busca-u">Buscar</label><input id="busca-u" v-model="busca" type="search" placeholder="Nome, e-mail ou usuário" /></div>
    <div class="cartao rolagem">
      <table>
        <thead><tr><th>Nome</th><th>CPF</th><th>Plano</th><th>Conta</th><th>Personal</th><th>Administrador</th></tr></thead>
        <tbody>
          <tr v-for="u in lista" :key="u.id" :class="{ inativa: !u.ativo }">
            <td><strong>{{ u.nome }}</strong><br /><span class="mudo">{{ u.email }}</span></td>
            <td>{{ u.cpf_mascarado }}</td>
            <td>{{ textoPlano(u.plano) }}</td>
            <td><button class="botao secundario pequeno" type="button" :aria-pressed="!!u.ativo" :disabled="u.id === sessao.perfil?.id" @click="alternar(u, 'ativo')">{{ u.ativo ? 'Ativa' : 'Desativada' }}</button></td>
            <td><button class="botao secundario pequeno" type="button" :aria-pressed="!!u.personal_ativo" @click="alternar(u, 'personal_ativo')">{{ u.personal_ativo ? 'Sim · tirar' : 'Tornar personal' }}</button></td>
            <td><button class="botao secundario pequeno" type="button" :aria-pressed="!!u.admin" :disabled="u.id === sessao.perfil?.id" @click="alternar(u, 'admin')">{{ u.admin ? 'Sim · tirar' : 'Tornar admin' }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mudo">Desativar uma conta encerra as sessões abertas dela na hora. Os dados ficam guardados e voltam se a conta for reativada.</p>
  </div>
</template>

<style scoped>
.voltar { text-decoration: none; font-weight: 600; }
.rolagem { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 760px; font-size: 14px; }
th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.inativa td { opacity: 0.6; }
.botao[aria-pressed='true'] { border-color: var(--accent); color: var(--accent-ink); }
</style>
