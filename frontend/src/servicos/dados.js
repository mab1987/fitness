// Única porta entre as telas e o servidor (regra 6 da arquitetura).
// Hoje fala com o Apps Script; na migração, só este arquivo passa a usar o Supabase.
import { sessao, encerrarLocal } from './sessao.js';

const API = import.meta.env.VITE_API_URL || '';

export class ErroApi extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export async function chamar(acao, dados = {}) {
  if (!API) throw new ErroApi('CONFIG', 'O endereço do servidor ainda não foi configurado (VITE_API_URL).');
  let resposta;
  try {
    resposta = await fetch(API, {
      method: 'POST',
      // text/plain evita a checagem prévia de CORS, que o Apps Script não atende.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, dados, token: sessao.token || null, verComo: sessao.verComo || null }),
      redirect: 'follow',
    });
  } catch {
    throw new ErroApi('SEM_CONEXAO', 'Sem conexão com o servidor. Confira a internet e tente de novo.');
  }
  let json;
  try {
    json = await resposta.json();
  } catch {
    throw new ErroApi('RESPOSTA_INVALIDA', 'O servidor respondeu de um jeito inesperado. Tente de novo.');
  }
  if (!json.ok) {
    const { codigo, mensagem } = json.erro || {};
    if (codigo === 'SESSAO_INVALIDA') encerrarLocal();
    throw new ErroApi(codigo || 'ERRO', mensagem || 'Algo deu errado.');
  }
  return json.dados;
}

export const api = {
  status: () => chamar('sistema.status'),
  cadastrar: (d) => chamar('auth.cadastrar', d),
  entrar: (d) => chamar('auth.entrar', d),
  sair: () => chamar('auth.sair'),
  trocarSenha: (d) => chamar('auth.trocarSenha', d),
  pedirRecuperacao: (d) => chamar('auth.pedirRecuperacao', d),
  redefinirSenha: (d) => chamar('auth.redefinirSenha', d),
  lerPerfil: () => chamar('perfil.ler'),
  atualizarPerfil: (d) => chamar('perfil.atualizar', d),
  listarUsuarios: () => chamar('admin.usuarios.listar'),
  definirPersonal: (d) => chamar('admin.personal.definir', d),
  registrarVerComo: (papel) => chamar('admin.verComo', { papel }),
};
