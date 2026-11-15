<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, ehAdmin, papeisEfetivos, PAPEIS_VER_COMO } from '../servicos/sessao.js';
import { recarregarTudo } from '../servicos/treinos.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const erro = ref('');
const papelVerComo = ref('aluno_gratis');
const adminReal = computed(() => ehAdmin.value && !sessao.verComo);
const tem = (p) => papeisEfetivos.value.includes(p);
const avisos = ref({ alunos: 0, propostas: 0 });

const secoes = computed(() => {
  const l = [];
  if (tem('personal') || adminReal.value) l.push({ para: '/painel/alunos', nome: 'Meus alunos', texto: 'Convide alunos, monte fichas, veja treinos e ajustes de carga, comente.', aviso: avisos.value.alunos, avisoTexto: 'novidade(s)' });
  if (tem('gerente') || adminReal.value) l.push({ para: '/painel/grupos', nome: 'Grupos', texto: adminReal.value ? 'Crie grupos, defina gerentes e acompanhe a frequência.' : 'Convide membros e acompanhe a frequência do grupo.' });
  if (tem('personal') || adminReal.value) l.push({ para: '/painel/catalogo', nome: adminReal.value ? 'Catálogo de exercícios' : 'Meus exercícios', texto: adminReal.value ? 'Edite o catálogo geral e decida as propostas dos personais.' : 'Proponha seus exercícios para o catálogo geral.', aviso: avisos.value.propostas, avisoTexto: 'proposta(s)' });
  if (adminReal.value) {
    l.push({ para: '/painel/usuarios', nome: 'Usuários', texto: 'Ative ou desative contas e os papéis de personal e de administrador.' });
    l.push({ para: '/painel/importar', nome: 'Importar planilha antiga', texto: 'Traz fichas e histórico do app antigo para uma conta.' });
  }
  return l;
});

onMounted(async () => {
  try {
    if (tem('personal') || adminReal.value) {
      const alunos = await api.listarAlunos();
      avisos.value.alunos = alunos.reduce((t, a) => t + a.ajustes_novos + a.comentarios_novos, 0);
    }
    if (adminReal.value) avisos.value.propostas = (await api.catalogo()).filter((e) => e.status === 'proposto').length;
  } catch { /* os números são só um aviso */ }
});

async function verComo() {
  erro.value = '';
  try {
    await api.registrarVerComo(papelVerComo.value);
    sessao.verComo = papelVerComo.value;
    recarregarTudo();
    router.push('/');
  } catch (e) {
    erro.value = e.message;
  }
}
</script>

<template>
  <div class="pilha">
    <h1>Painel</h1>
    <Aviso :texto="erro" />

    <div class="grade-secoes">
      <RouterLink v-for="s in secoes" :key="s.para" :to="s.para" class="cartao secao">
        <span class="linha topo"><strong>{{ s.nome }}</strong><span v-if="s.aviso" class="selo">{{ s.aviso }} {{ s.avisoTexto }}</span></span>
        <span class="mudo">{{ s.texto }}</span>
      </RouterLink>
    </div>

    <section v-if="adminReal" class="cartao pilha" aria-labelledby="t-ver">
      <h2 id="t-ver">Ver o app como outro papel</h2>
      <p class="mudo">Mostra as telas como esse papel vê. Nada é alterado enquanto o modo estiver ativo.</p>
      <div class="linha" style="flex-wrap: wrap">
        <label class="visualmente-oculto" for="papel">Papel</label>
        <select id="papel" v-model="papelVerComo" class="entrada seletor">
          <option v-for="p in PAPEIS_VER_COMO" :key="p.id" :value="p.id">{{ p.nome }}</option>
        </select>
        <button class="botao" type="button" @click="verComo">Ver como</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.grade-secoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.secao { display: flex; flex-direction: column; gap: 6px; color: var(--text); text-decoration: none; min-height: 110px; }
.secao:hover { border-color: var(--accent); }
.topo { justify-content: space-between; gap: 8px; }
.seletor { width: auto; min-width: 200px; }
</style>
