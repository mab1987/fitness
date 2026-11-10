/**
 * Acesso à planilha como banco de dados.
 * Toda gravação passa por celula_(), que impede que um texto vire fórmula
 * (regra de segurança 2), e acontece sob bloqueio (LockService).
 */

function aba_(tabela) {
  var aba = planilha_().getSheetByName(tabela);
  if (!aba) throw erro_('CONFIG', 'A aba "' + tabela + '" não existe. Rode a função setup().');
  return aba;
}

/** Converte um valor JS no conteúdo seguro de uma célula. */
function celula_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return isFinite(valor) ? valor : '';
  if (valor instanceof Date) valor = valor.toISOString();
  var texto = String(valor).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (texto === '') return '';
  // O apóstrofo inicial faz a planilha guardar o conteúdo como texto puro:
  // nada vira fórmula (=, +, -, @), data ou número por engano. Ele não faz parte do valor lido.
  return "'" + texto;
}

/** Converte o conteúdo da célula no tipo da coluna. */
function lerCelula_(tabela, coluna, bruto) {
  if (bruto === '' || bruto === null || bruto === undefined) return null;
  var tipo = tipo_(tabela, coluna);
  if (tipo === 'n') { var n = Number(bruto); return isFinite(n) ? n : null; }
  if (tipo === 'b') return bruto === true || bruto === 'TRUE' || bruto === 'true';
  if (tipo === 'd') return bruto instanceof Date ? bruto.toISOString() : String(bruto);
  return String(bruto);
}

/** Lê a tabela inteira como lista de objetos. Linhas com excluido_em ficam de fora, salvo pedido. */
function lerTodos_(tabela, incluirExcluidos) {
  var valores = aba_(tabela).getDataRange().getValues();
  if (valores.length < 2) return [];
  var cab = valores[0];
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    var obj = { _linha: i + 1 };
    for (var j = 0; j < cab.length; j++) {
      if (cab[j]) obj[cab[j]] = lerCelula_(tabela, cab[j], linha[j]);
    }
    if (!obj.id) continue;
    if (!incluirExcluidos && obj.excluido_em) continue;
    lista.push(obj);
  }
  return lista;
}

function buscar_(tabela, filtro, incluirExcluidos) {
  return lerTodos_(tabela, incluirExcluidos).filter(function (o) {
    return Object.keys(filtro).every(function (k) { return o[k] === filtro[k]; });
  });
}

function buscarUm_(tabela, filtro, incluirExcluidos) {
  return buscar_(tabela, filtro, incluirExcluidos)[0] || null;
}

function comBloqueio_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw erro_('OCUPADO', 'O servidor está ocupado. Tente de novo em instantes.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Insere uma linha. Gera id e datas se faltarem. Devolve o objeto gravado. */
function inserir_(tabela, obj) {
  return comBloqueio_(function () { return inserirSemBloqueio_(tabela, obj); });
}

/** Use só dentro de comBloqueio_ (por exemplo, para checar duplicidade e inserir de forma atômica). */
function inserirSemBloqueio_(tabela, obj) {
  var aba = aba_(tabela);
  var cols = cabecalho_(aba);
  var registro = Object.assign({}, obj);
  if (!registro.id) registro.id = novoId_();
  var t = agora_();
  if (cols.indexOf('criado_em') >= 0 && !registro.criado_em) registro.criado_em = t;
  if (cols.indexOf('atualizado_em') >= 0) registro.atualizado_em = t;
  aba.appendRow(cols.map(function (c) { return celula_(registro[c]); }));
  return registro;
}

/** Atualiza campos de uma linha pelo id. Devolve o registro atualizado. */
function atualizar_(tabela, id, campos) {
  return comBloqueio_(function () { return atualizarSemBloqueio_(tabela, id, campos); });
}

/** Use só dentro de comBloqueio_. */
function atualizarSemBloqueio_(tabela, id, campos) {
  var aba = aba_(tabela);
  var cols = cabecalho_(aba);
  var atual = buscarUm_(tabela, { id: id }, true);
  if (!atual) throw erro_('NAO_ENCONTRADO', 'Registro não encontrado.');
  var novo = Object.assign({}, atual, campos, { id: id });
  if (cols.indexOf('atualizado_em') >= 0) novo.atualizado_em = agora_();
  var linha = cols.map(function (c) { return celula_(novo[c]); });
  aba.getRange(atual._linha, 1, 1, cols.length).setValues([linha]);
  delete novo._linha;
  return novo;
}

/** Exclusão lógica: só marca excluido_em. */
function excluir_(tabela, id) {
  return atualizar_(tabela, id, { excluido_em: agora_() });
}

function cabecalho_(aba) {
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].filter(String);
}

/** Remove campos internos ou sensíveis antes de devolver ao app. */
function publico_(obj, ocultos) {
  var saida = {};
  Object.keys(obj).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    if ((ocultos || []).indexOf(k) >= 0) return;
    saida[k] = obj[k];
  });
  return saida;
}
