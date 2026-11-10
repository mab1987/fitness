<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { sessao, definirPerfil, encerrarLocal, planoEfetivo, textoPlano } from '../servicos/sessao.js';
import { aparencia, PALETAS, TEMAS, modoEfetivo } from '../servicos/tema.js';
import { pedidoInstalacao, instalado, instalar, ehIos } from '../servicos/instalar.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const nome = ref(sessao.perfil?.nome || '');
const msgDados = reactive({ erro: '', ok: '' });
const msgAparencia = reactive({ erro: '', ok: '' });
const senha = reactive({ atual: '', nova: '', nova2: '' });
const msgSenha = reactive({ erro: '', ok: '' });

async function salvarNome() {
  msgDados.erro = msgDados.ok = '';
  try {
    definirPerfil(await api.atualizarPerfil({ nome: nome.value.trim() }));
    msgDados.ok = 'Nome atualizado.';
  } catch (e) {
    msgDados.erro = e.message;
  }
}

async function escolher(campo, valor) {
  aparencia[campo] = valor; // aplica na hora
  msgAparencia.erro = msgAparencia.ok = '';
  if (sessao.verComo) return; // modo "ver como": só muda a tela, não grava
  try {
    definirPerfil(await api.atualizarPerfil({ [campo]: valor }));
    msgAparencia.ok = 'Aparência salva na sua conta.';
  } catch (e) {
    msgAparencia.erro = e.message;
  }
}

function corAmostra(p) {
  return `linear-gradient(135deg, ${p.claro[0]} 0 50%, ${p.escuro[0]} 50% 100%)`;
}

async function trocarSenha() {
  msgSenha.erro = msgSenha.ok = '';
  if (senha.nova.length < 8) return (msgSenha.erro = 'A nova senha precisa ter pelo menos 8 caracteres.');
  if (senha.nova !== senha.nova2) return (msgSenha.erro = 'As senhas não conferem.');
  try {
    await api.trocarSenha({ senha_atual: senha.atual, senha_nova: senha.nova });
    Object.assign(senha, { atual: '', nova: '', nova2: '' });
    msgSenha.ok = 'Senha alterada.';
  } catch (e) {
    msgSenha.erro = e.message;
  }
}

async function sair() {
  try { await api.sair(); } catch { /* sai mesmo sem conexão */ }
  encerrarLocal();
  router.replace('/entrar');
}
</script>

<template>
  <div class="pilha">
    <h1>Perfil</h1>

    <section class="cartao pilha" aria-labelledby="t-dados">
      <h2 id="t-dados">Seus dados</h2>
      <Aviso :texto="msgDados.erro" />
      <Aviso tipo="sucesso" :texto="msgDados.ok" />
      <div class="campo">
        <label for="nome">Nome</label>
        <div class="linha">
          <input id="nome" v-model="nome" maxlength="80" style="flex: 1; min-width: 0" />
          <button class="botao secundario" type="button" :disabled="!!sessao.verComo" @click="salvarNome">Salvar</button>
        </div>
      </div>
      <dl class="dados">
        <dt>E-mail</dt><dd>{{ sessao.perfil?.email }}</dd>
        <dt v-if="sessao.perfil?.usuario">Usuário</dt><dd v-if="sessao.perfil?.usuario">{{ sessao.perfil.usuario }}</dd>
        <dt>CPF</dt><dd>{{ sessao.perfil?.cpf_mascarado }}</dd>
        <dt>Plano</dt><dd>{{ textoPlano(planoEfetivo) }}</dd>
      </dl>
    </section>

    <section class="cartao pilha" aria-labelledby="t-aparencia">
      <h2 id="t-aparencia">Aparência</h2>
      <Aviso :texto="msgAparencia.erro" />
      <Aviso tipo="sucesso" :texto="msgAparencia.ok" />
      <span class="rotulo-secao">Tema</span>
      <div class="segmentado" role="group" aria-label="Tema">
        <button v-for="t in TEMAS" :key="t.id" type="button" :aria-pressed="aparencia.tema === t.id" @click="escolher('tema', t.id)">{{ t.nome }}</button>
      </div>
      <p class="mudo">Automático segue o modo claro ou noturno do celular.</p>
      <span class="rotulo-secao">Cor de destaque</span>
      <div class="paletas">
        <button
          v-for="p in PALETAS" :key="p.id" type="button" class="paleta"
          :aria-pressed="aparencia.paleta === p.id" :aria-label="`Cor ${p.nome}`"
          @click="escolher('paleta', p.id)"
        >
          <span class="amostra" :style="{ background: corAmostra(p) }" />
          <span>{{ p.nome }}</span>
        </button>
      </div>
      <div class="previa" aria-hidden="true">
        <span class="selo">{{ textoPlano(planoEfetivo) }}</span>
        <div class="faixa">Descanso <strong>0:58</strong></div>
        <span class="mudo">Modo {{ modoEfetivo() === 'escuro' ? 'noturno' : 'claro' }}</span>
      </div>
    </section>

    <section v-if="!instalado" class="cartao pilha" aria-labelledby="t-instalar">
      <h2 id="t-instalar">Instalar no celular</h2>
      <button v-if="pedidoInstalacao" class="botao" type="button" @click="instalar">Instalar app</button>
      <p v-else-if="ehIos" class="mudo">No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>
      <p v-else class="mudo">No menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial".</p>
    </section>

    <section class="cartao pilha" aria-labelledby="t-senha">
      <h2 id="t-senha">Trocar senha</h2>
      <Aviso :texto="msgSenha.erro" />
      <Aviso tipo="sucesso" :texto="msgSenha.ok" />
      <div class="campo"><label for="sa">Senha atual</label><input id="sa" v-model="senha.atual" type="password" autocomplete="current-password" maxlength="72" /></div>
      <div class="campo"><label for="sn">Nova senha</label><input id="sn" v-model="senha.nova" type="password" autocomplete="new-password" maxlength="72" /></div>
      <div class="campo"><label for="sn2">Repita a nova senha</label><input id="sn2" v-model="senha.nova2" type="password" autocomplete="new-password" maxlength="72" /></div>
      <button class="botao secundario" type="button" :disabled="!!sessao.verComo" @click="trocarSenha">Trocar senha</button>
    </section>

    <button class="botao secundario largo" type="button" @click="sair">Sair da conta</button>
  </div>
</template>

<style scoped>
.dados { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; font-size: 15px; }
.dados dt { color: var(--muted); }
.dados dd { margin: 0; overflow-wrap: anywhere; }
.paletas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 8px; }
.paleta {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px 0;
  border: none; background: transparent; color: var(--text); font: inherit; font-size: 12px; cursor: pointer;
}
.amostra { width: 48px; height: 48px; border-radius: 50%; border: 3px solid var(--surface); box-shadow: 0 0 0 2px transparent; }
.paleta[aria-pressed='true'] .amostra { box-shadow: 0 0 0 2px var(--text); }
.paleta[aria-pressed='true'] { font-weight: 700; }
.previa { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px dashed var(--line); border-radius: 12px; }
.previa .selo { align-self: flex-start; }
.faixa { padding: 10px 12px; border-radius: 12px; background: var(--accent); color: var(--on-accent); }
</style>
