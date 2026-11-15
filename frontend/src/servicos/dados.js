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
  listarExercicios: () => chamar('exercicios.listar'),
  criarExercicio: (d) => chamar('exercicios.criar', d),
  atualizarExercicio: (d) => chamar('exercicios.atualizar', d),
  listarFichas: () => chamar('fichas.listar'),
  salvarFicha: (d) => chamar('fichas.salvar', d),
  excluirFicha: (d) => chamar('fichas.excluir', d),
  sincronizarTreino: (d) => chamar('treino.sincronizar', d),
  listarHistorico: (d) => chamar('historico.listar', d),
  previaImportacao: (d) => chamar('admin.importar.previa', d),
  importar: (d) => chamar('admin.importar.executar', d),
  // Fase 2
  criarConvite: (d) => chamar('convites.criar', d),
  listarConvites: () => chamar('convites.listar'),
  revogarConvite: (id) => chamar('convites.revogar', { id }),
  verConvite: (codigo) => chamar('convites.ver', { codigo }),
  aceitarConvite: (codigo) => chamar('convites.aceitar', { codigo }),
  meuVinculo: () => chamar('vinculo.meu'),
  encerrarVinculo: (vinculo_id) => chamar('vinculo.encerrar', { vinculo_id }),
  listarAlunos: () => chamar('personal.alunos'),
  lerAluno: (aluno_id) => chamar('personal.aluno', { aluno_id }),
  salvarFichaAluno: (d) => chamar('personal.fichaSalvar', d),
  excluirFichaAluno: (d) => chamar('personal.fichaExcluir', d),
  ajustesVistos: (aluno_id) => chamar('personal.ajustesVistos', { aluno_id }),
  proporExercicio: (id) => chamar('exercicios.propor', { id }),
  listarComentarios: (d = {}) => chamar('comentarios.listar', d),
  criarComentario: (d) => chamar('comentarios.criar', d),
  comentariosVistos: (d = {}) => chamar('comentarios.vistos', d),
  listarGrupos: () => chamar('grupos.listar'),
  lerGrupo: (id) => chamar('grupos.ler', { id }),
  atualizarGrupo: (d) => chamar('grupos.atualizar', d),
  papelMembro: (d) => chamar('grupos.papel', d),
  removerMembro: (d) => chamar('grupos.remover', d),
  sairDoGrupo: (grupo_id) => chamar('grupos.sair', { grupo_id }),
  criarGrupo: (d) => chamar('admin.grupos.criar', d),
  excluirGrupo: (id) => chamar('admin.grupos.excluir', { id }),
  atualizarUsuario: (d) => chamar('admin.usuario.atualizar', d),
  catalogo: () => chamar('admin.catalogo'),
  atualizarExercicioAdmin: (d) => chamar('admin.exercicio.atualizar', d),
  decidirExercicio: (d) => chamar('admin.exercicio.decidir', d),
  // Fase 3
  precos: () => chamar('precos.listar'),
  minhasLicencas: () => chamar('licencas.minhas'),
  criarPedido: (d) => chamar('pedidos.criar', d),
  paguei: (id) => chamar('pedidos.paguei', { id }),
  cancelarPedido: (id) => chamar('pedidos.cancelar', { id }),
  licencasPersonal: () => chamar('personal.licencas'),
  atribuirLicenca: (d) => chamar('personal.atribuir', d),
  configAdmin: () => chamar('admin.config'),
  salvarConfig: (d) => chamar('admin.config.salvar', d),
  precosAdmin: () => chamar('admin.precos'),
  salvarPrecos: (precos) => chamar('admin.precos.salvar', { precos }),
  pedidosAdmin: () => chamar('admin.pedidos'),
  liberarPedido: (id) => chamar('admin.pedido.liberar', { id }),
  cancelarPedidoAdmin: (d) => chamar('admin.pedido.cancelar', d),
  cortesia: (d) => chamar('admin.cortesia', d),
  revogarLicenca: (id) => chamar('admin.licenca.revogar', { id }),
  licencasUsuario: (usuario_id) => chamar('admin.licencas.usuario', { usuario_id }),
  lote: (d) => chamar('admin.lote', d),
  programas: () => chamar('programas.listar'),
  meusProgramas: () => chamar('programas.meus'),
  salvarPrograma: (d) => chamar('programas.salvar', d),
  excluirPrograma: (id) => chamar('programas.excluir', { id }),
  usarPrograma: (d) => chamar('programas.usar', d),
  medidas: (d = {}) => chamar('medidas.listar', d),
  salvarMedida: (d) => chamar('medidas.salvar', d),
  excluirMedida: (d) => chamar('medidas.excluir', d),
  exportar: (d = {}) => chamar('exportar', d),
  previaCatalogo: (d = {}) => chamar('admin.catalogo.previa', d),
  semearCatalogo: (d = {}) => chamar('admin.catalogo.semear', d),
  juntarExercicios: (d) => chamar('admin.exercicios.juntar', d),
};
