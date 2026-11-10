<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../servicos/dados.js';
import { iniciarSessao } from '../servicos/sessao.js';
import { cpfValido, formatarCpf } from '../servicos/cpf.js';
import Aviso from '../componentes/Aviso.vue';

const router = useRouter();
const f = reactive({ nome: '', email: '', usuario: '', cpf: '', senha: '', senha2: '', aceite: false });
const erro = ref('');
const enviando = ref(false);
const tocado = reactive({});

const erros = computed(() => ({
  nome: f.nome.trim().length < 2 ? 'Informe seu nome.' : '',
  email: !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email.trim()) ? 'E-mail inválido.' : '',
  usuario: f.usuario && !/^[a-z0-9._]{3,30}$/.test(f.usuario) ? 'Use de 3 a 30 letras sem acento, números, ponto ou sublinhado.' : '',
  cpf: !cpfValido(f.cpf) ? 'CPF inválido.' : '',
  senha: f.senha.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '',
  senha2: f.senha2 !== f.senha ? 'As senhas não conferem.' : '',
  aceite: !f.aceite ? 'É preciso aceitar os termos.' : '',
}));

function aoDigitarCpf(e) {
  f.cpf = formatarCpf(e.target.value);
}

async function cadastrar() {
  Object.keys(erros.value).forEach((k) => (tocado[k] = true));
  erro.value = '';
  if (Object.values(erros.value).some(Boolean)) return;
  enviando.value = true;
  try {
    iniciarSessao(
      await api.cadastrar({
        nome: f.nome.trim(), email: f.email.trim(), usuario: f.usuario.trim().toLowerCase(),
        cpf: f.cpf, senha: f.senha, aceite_termos: f.aceite,
      }),
    );
    router.replace('/');
  } catch (e) {
    erro.value = e.message;
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="tela-auth">
    <form class="cartao pilha" novalidate @submit.prevent="cadastrar">
      <div>
        <h1>Criar conta</h1>
        <p class="mudo">Cada CPF pode ter uma única conta.</p>
      </div>
      <Aviso :texto="erro" />
      <div class="campo">
        <label for="nome">Nome</label>
        <input id="nome" v-model="f.nome" autocomplete="name" maxlength="80" @blur="tocado.nome = true" />
        <span v-if="tocado.nome && erros.nome" class="erro-campo">{{ erros.nome }}</span>
      </div>
      <div class="campo">
        <label for="email">E-mail</label>
        <input id="email" v-model="f.email" type="email" autocomplete="email" autocapitalize="none" maxlength="120" @blur="tocado.email = true" />
        <span v-if="tocado.email && erros.email" class="erro-campo">{{ erros.email }}</span>
      </div>
      <div class="campo">
        <label for="usuario">Nome de usuário (opcional)</label>
        <input id="usuario" v-model="f.usuario" autocomplete="username" autocapitalize="none" maxlength="30" @blur="tocado.usuario = true" />
        <span class="dica">Serve para entrar sem digitar o e-mail.</span>
        <span v-if="tocado.usuario && erros.usuario" class="erro-campo">{{ erros.usuario }}</span>
      </div>
      <div class="campo">
        <label for="cpf">CPF</label>
        <input id="cpf" :value="f.cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" @input="aoDigitarCpf" @blur="tocado.cpf = true" />
        <span class="dica">Usado só para evitar contas duplicadas. Não mostramos seu CPF completo.</span>
        <span v-if="tocado.cpf && erros.cpf" class="erro-campo">{{ erros.cpf }}</span>
      </div>
      <div class="campo">
        <label for="senha">Senha</label>
        <input id="senha" v-model="f.senha" type="password" autocomplete="new-password" maxlength="72" @blur="tocado.senha = true" />
        <span v-if="tocado.senha && erros.senha" class="erro-campo">{{ erros.senha }}</span>
      </div>
      <div class="campo">
        <label for="senha2">Repita a senha</label>
        <input id="senha2" v-model="f.senha2" type="password" autocomplete="new-password" maxlength="72" @blur="tocado.senha2 = true" />
        <span v-if="tocado.senha2 && erros.senha2" class="erro-campo">{{ erros.senha2 }}</span>
      </div>
      <label class="linha" style="align-items: flex-start; font-size: 14px">
        <input v-model="f.aceite" type="checkbox" style="width: 22px; height: 22px; margin: 0" />
        <span>Li e aceito os termos de uso e a política de privacidade.</span>
      </label>
      <span v-if="tocado.aceite && erros.aceite" class="erro-campo" style="color: var(--perigo); font-size: 13px">{{ erros.aceite }}</span>
      <button class="botao largo" type="submit" :disabled="enviando">{{ enviando ? 'Criando…' : 'Criar conta' }}</button>
      <RouterLink to="/entrar">Já tenho conta</RouterLink>
    </form>
  </main>
</template>
