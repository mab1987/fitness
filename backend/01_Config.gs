/**
 * Meu treino — configuração geral do backend (Google Apps Script).
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   PLANILHA_ID   preenchida automaticamente pelo setup() quando o script está ligado à planilha
 *   CPF_SEGREDO   gerada automaticamente pelo setup(); NUNCA compartilhe nem apague
 *   ADMIN_EMAIL   e-mail que vira administrador ao se cadastrar (preencha você)
 *   APP_URL       endereço do app no GitHub Pages, usado no link de recuperação de senha
 *   BCRYPT_CUSTO  opcional; padrão 10
 */
var APP = {
  NOME: 'Meu treino',
  VERSAO: '0.1.0',
  SESSAO_DIAS: 30,
  RECUPERACAO_MINUTOS: 60,
  MAX_TENTATIVAS_LOGIN: 5,
  JANELA_TENTATIVAS_SEG: 15 * 60,
  TEMAS: ['claro', 'escuro', 'sistema'],
  PALETAS: ['verde-agua', 'azul', 'violeta', 'coral', 'rosa', 'verde', 'vermelho', 'grafite'],
  PAPEIS_VER_COMO: ['aluno_gratis', 'aluno_premium', 'personal', 'gerente']
};

function prop_(nome, obrigatoria) {
  var valor = PropertiesService.getScriptProperties().getProperty(nome);
  if (!valor && obrigatoria) {
    throw erro_('CONFIG', 'Configuração ausente: ' + nome + '. Rode a função setup() no editor do Apps Script.');
  }
  return valor || '';
}

function planilha_() {
  var id = prop_('PLANILHA_ID', false);
  if (id) return SpreadsheetApp.openById(id);
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) throw erro_('CONFIG', 'Planilha não encontrada. Rode a função setup().');
  return ativa;
}

/** Erro "esperado": a mensagem pode ser mostrada ao usuário. */
function erro_(codigo, mensagem) {
  var e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function agora_() {
  return new Date().toISOString();
}

function novoId_() {
  return Utilities.getUuid();
}
