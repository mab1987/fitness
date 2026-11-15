<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil, ehAdmin, papeisEfetivos, textoPlano, PAPEIS_VER_COMO } from '../servicos/sessao.js';
import Aviso from '../componentes/Aviso.vue';
import { recarregarTudo } from '../servicos/treinos.js';
import { kg, data } from '../servicos/calculos.js';
import { reactive } from 'vue';

const imp = reactive({ endereco: '', email: sessao.perfil?.email || '', renomear: '', previa: null, feito: null, erro: '', ocupado: false });
function argsImportacao() {
  const m = String(imp.endereco).match(/\/d\/([A-Za-z0-9_-]{20,})/);
  const renomear = {};
  imp.renomear.split('\n').forEach((l) => {
    const [a, b] = l.split('=').map((x) => (x || '').trim());
    if (a && b) renomear[a] = b;
  });
  return { planilha_id: m ? m[1] : imp.endereco.trim(), email: imp.email.trim(), renomear };
}
async function previaImportacao() {
  imp.erro = ''; imp.feito = null; imp.ocupado = true;
  try { imp.previa = await api.previaImportacao(argsImportacao()); } catch (e) { imp.erro = e.message; imp.previa = null; } finally { imp.ocupado = false; }
}
async function importar() {
  imp.erro = ''; imp.ocupado = true;
  try { imp.feito = await api.importar(argsImportacao()); await recarregarTudo(); definirPerfil(await api.lerPerfil()); } catch (e) { imp.erro = e.message; } finally { imp.ocupado = false; }
}

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
    recarregarTudo();
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

      <section class="cartao pilha" aria-labelledby="t-imp">
        <h2 id="t-imp">Importar planilha antiga</h2>
        <p class="mudo">No Google Drive, abra o .xlsx antigo e use <em>Arquivo › Salvar como Planilhas Google</em>. Cole aqui o endereço da planilha nova. Pode rodar de novo: nada é duplicado.</p>
        <Aviso :texto="imp.erro" />
        <div class="campo"><label for="imp-end">Endereço ou ID da planilha</label><input id="imp-end" v-model="imp.endereco" maxlength="300" placeholder="https://docs.google.com/spreadsheets/d/…" /></div>
        <div class="campo"><label for="imp-em">E-mail da conta que recebe os dados</label><input id="imp-em" v-model="imp.email" type="email" maxlength="120" /></div>
        <div class="campo">
          <label for="imp-ren">Renomear exercícios (opcional)</label>
          <textarea id="imp-ren" v-model="imp.renomear" rows="2" maxlength="3000" placeholder="Panturrilha Sentadilha = Panturrilha Sentada"></textarea>
          <span class="dica">Um por linha: nome antigo = nome novo. Dois nomes antigos com o mesmo nome novo viram um só exercício.</span>
        </div>
        <div class="linha" style="flex-wrap: wrap">
          <button class="botao secundario" type="button" :disabled="imp.ocupado || !imp.endereco" @click="previaImportacao">{{ imp.ocupado && !imp.previa ? 'Lendo…' : 'Ver prévia' }}</button>
          <button v-if="imp.previa && !imp.feito" class="botao" type="button" :disabled="imp.ocupado" @click="importar">{{ imp.ocupado ? 'Importando…' : 'Importar agora' }}</button>
        </div>

        <div v-if="imp.previa" class="pilha previa">
          <p><strong>{{ imp.previa.resumo.sessoes }} treinos</strong> e {{ imp.previa.resumo.series }} séries de {{ data(imp.previa.resumo.periodo?.de) }} a {{ data(imp.previa.resumo.periodo?.ate) }}, para {{ imp.previa.resumo.aluno.nome }}.</p>
          <p class="mudo">Fichas: {{ imp.previa.resumo.fichas.map((f) => f.nome + ' (' + f.exercicios + ')').join(', ') }} · {{ imp.previa.resumo.exercicios_novos }} exercícios novos no catálogo.</p>
          <details>
            <summary>{{ imp.previa.cargas_separadas.length }} valores com carga e repetições juntas (ex.: 42.510kg = 42,5 kg × 10)</summary>
            <ul class="lista-imp"><li v-for="c in imp.previa.cargas_separadas" :key="c.texto + c.exercicio">{{ c.exercicio }}: "{{ c.texto }}" → {{ kg(c.carga_kg) }} kg × {{ c.reps }} <span class="mudo">({{ c.vezes }}x)</span></li></ul>
          </details>
          <div v-if="imp.previa.cargas_para_revisar.length">
            <p><strong>Para conferir</strong> (ficam como estão):</p>
            <ul class="lista-imp"><li v-for="c in imp.previa.cargas_para_revisar" :key="c.texto + c.exercicio">{{ c.exercicio }}: "{{ c.texto }}" <span class="mudo">({{ c.vezes }}x)</span></li></ul>
          </div>
          <div v-if="imp.previa.exercicios.some((e) => e.parecidos.length)">
            <p><strong>Nomes parecidos</strong> (ficam separados; use "Renomear" para juntar):</p>
            <ul class="lista-imp"><li v-for="e in imp.previa.exercicios.filter((x) => x.parecidos.length)" :key="e.nome">{{ e.nome }} <span class="mudo">≈ {{ e.parecidos.join(', ') }}</span></li></ul>
          </div>
        </div>
        <Aviso v-if="imp.feito" tipo="sucesso" :texto="`Importado: ${imp.feito.gravado.sessoes.criados} treinos novos, ${imp.feito.gravado.series.criados} séries, ${imp.feito.gravado.fichas.criados} fichas. Licença: ${imp.feito.gravado.licenca}.`" />
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
.previa { padding-top: 8px; border-top: 1px solid var(--line); }
.lista-imp { margin: 6px 0 0; padding-left: 20px; font-size: 14px; display: flex; flex-direction: column; gap: 2px; }
summary { cursor: pointer; font-weight: 600; }
</style>
