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
  VERSAO: '0.4.1',
  SESSAO_DIAS: 30,
  RECUPERACAO_MINUTOS: 60,
  MAX_TENTATIVAS_LOGIN: 5,
  JANELA_TENTATIVAS_SEG: 15 * 60,
  TEMAS: ['claro', 'escuro', 'sistema'],
  PALETAS: ['verde-agua', 'azul', 'violeta', 'coral', 'rosa', 'verde', 'vermelho', 'grafite'],
  PAPEIS_VER_COMO: ['aluno_gratis', 'aluno_premium', 'personal', 'gerente'],
  LIMITE_FICHAS_GRATIS: 3,
  DIAS_GRAFICO_GRATIS: 30,
  METODOS: ['', 'drop-set', 'rest-pause', 'bi-set', 'tri-set', 'piramide', 'cluster', 'outro'],
  TIPOS_SERIE: ['normal', 'aquecimento', 'drop', 'falha'],
  MAX_LOTE_SESSOES: 200,
  MAX_LOTE_SERIES: 3000,
  CONVITE_DIAS: 7,
  PAPEIS_GRUPO: ['membro', 'personal', 'gerente'],
  PERIODOS: { mensal: 1, trimestral: 3, semestral: 6, anual: 12 },
  // Preços iniciais (opção simbólica do plano do projeto). O administrador muda no app.
  PRECOS_INICIAIS: [
    ['aluno', 'mensal', 4.9], ['aluno', 'trimestral', 12.9], ['aluno', 'semestral', 22.9], ['aluno', 'anual', 39.9],
    ['personal', 'mensal', 3.4], ['personal', 'trimestral', 8.9], ['personal', 'semestral', 15.9], ['personal', 'anual', 27.9]
  ],
  MAX_PEDIDOS_ABERTOS: 3,
  INCREMENTO_PADRAO_KG: 2.5
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
