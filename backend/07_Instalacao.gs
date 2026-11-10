/**
 * Instalação. Rode setup() uma vez pelo editor do Apps Script (menu Executar).
 * Pode rodar de novo sem perder dados: só cria o que falta.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!props.getProperty('PLANILHA_ID')) {
    if (!ss) throw new Error('Abra o Apps Script a partir da planilha (Extensões > Apps Script) e rode setup() de novo.');
    props.setProperty('PLANILHA_ID', ss.getId());
  }
  if (!props.getProperty('CPF_SEGREDO')) props.setProperty('CPF_SEGREDO', tokenAleatorio_());
  ss = planilha_();

  Object.keys(ESQUEMA).forEach(function (tabela) {
    var cols = colunas_(tabela);
    var aba = ss.getSheetByName(tabela) || ss.insertSheet(tabela);
    var atual = aba.getLastColumn() ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].filter(String) : [];
    var faltando = cols.filter(function (c) { return atual.indexOf(c) < 0; });
    if (faltando.length) aba.getRange(1, atual.length + 1, 1, faltando.length).setValues([faltando]);
    aba.setFrozenRows(1);
  });

  ss.getSheets().forEach(function (aba) {
    var nome = aba.getName();
    if (!ESQUEMA[nome] && aba.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(aba);
  });

  var faltam = ['ADMIN_EMAIL', 'APP_URL'].filter(function (p) { return !props.getProperty(p); });
  var msg = 'Pronto: ' + Object.keys(ESQUEMA).length + ' abas conferidas.';
  if (faltam.length) msg += ' Falta preencher nas Propriedades do script: ' + faltam.join(', ') + '.';
  console.log(msg);
  return msg;
}

/** Teste rápido do bcrypt (mostra no registro de execução quanto tempo um hash leva). */
function testarSenha() {
  var t0 = Date.now();
  var h = hashSenha_('senha-de-teste-123');
  var ok = confereSenha_('senha-de-teste-123', h);
  console.log('bcrypt ok=' + ok + ' em ' + (Date.now() - t0) + ' ms');
}
