/**
 * Rota única da API. O app envia POST com corpo JSON (Content-Type text/plain para evitar preflight de CORS):
 *   { "acao": "perfil.ler", "dados": {...}, "token": "...", "verComo": null }
 * Resposta: { "ok": true, "dados": ... } ou { "ok": false, "erro": { "codigo": "...", "mensagem": "..." } }
 *
 * acesso: 'publico' (sem login), 'logado' ou 'admin'. escrita: true bloqueia a ação no modo "ver como".
 */
// Montada na hora da chamada: no Apps Script a ordem de carga dos arquivos pode variar.
function rotas_() {
  return {
  'sistema.status':        { acesso: 'publico', fn: function () { return { app: APP.NOME, versao: APP.VERSAO, hora: agora_() }; } },
  'auth.cadastrar':        { acesso: 'publico', escrita: true, fn: cadastrar_ },
  'auth.entrar':           { acesso: 'publico', fn: entrar_ },
  'auth.pedirRecuperacao': { acesso: 'publico', fn: pedirRecuperacao_ },
  'auth.redefinirSenha':   { acesso: 'publico', escrita: true, fn: redefinirSenha_ },
  'auth.sair':             { acesso: 'logado', fn: function (d, ctx) { return sair_(ctx); } },
  'auth.trocarSenha':      { acesso: 'logado', escrita: true, fn: trocarSenha_ },
  'perfil.ler':            { acesso: 'logado', fn: function (d, ctx) { return perfil_(ctx.usuario); } },
  'perfil.atualizar':      { acesso: 'logado', escrita: true, fn: atualizarPerfil_ },
  'admin.usuarios.listar': { acesso: 'admin', fn: listarUsuarios_ },
  'admin.personal.definir':{ acesso: 'admin', escrita: true, fn: definirPersonal_ },
  'admin.verComo':         { acesso: 'admin', fn: registrarVerComo_ }
  };
}

function doGet() {
  return json_({ ok: true, dados: { app: APP.NOME, versao: APP.VERSAO } });
}

function doPost(e) {
  var pedido;
  try {
    pedido = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (x) {
    return json_({ ok: false, erro: { codigo: 'PEDIDO_INVALIDO', mensagem: 'Pedido inválido.' } });
  }
  try {
    return json_({ ok: true, dados: executar_(pedido) });
  } catch (x) {
    if (!x.codigo) console.error(x && x.stack ? x.stack : x);
    return json_({
      ok: false,
      erro: { codigo: x.codigo || 'ERRO_INTERNO', mensagem: x.codigo ? x.message : 'Erro inesperado. Tente de novo.' }
    });
  }
}

function executar_(pedido) {
  if (!pedido || typeof pedido.acao !== 'string') throw erro_('PEDIDO_INVALIDO', 'Pedido inválido.');
  var rotas = rotas_();
  var rota = Object.prototype.hasOwnProperty.call(rotas, pedido.acao) ? rotas[pedido.acao] : null;
  if (!rota) throw erro_('ACAO_DESCONHECIDA', 'Ação desconhecida.');
  var dados = pedido.dados && typeof pedido.dados === 'object' ? pedido.dados : {};
  var ctx = { usuario: null, verComo: null };

  if (rota.acesso !== 'publico') {
    ctx.usuario = autenticar_(pedido.token);
    if (pedido.verComo) {
      if (!ctx.usuario.admin) throw erro_('PROIBIDO', 'Sem permissão.');
      ctx.verComo = opcao_(pedido.verComo, 'ver como', APP.PAPEIS_VER_COMO);
    }
  }
  exigirPermissao_(rota, ctx);
  return rota.fn(dados, ctx);
}

/** Regra de segurança 6: toda ação é checada aqui, no servidor. */
function exigirPermissao_(rota, ctx) {
  if (rota.acesso === 'admin' && !(ctx.usuario && ctx.usuario.admin)) throw erro_('PROIBIDO', 'Sem permissão.');
  if (ctx.verComo && rota.escrita) throw erro_('SOMENTE_LEITURA', 'No modo "ver como" nada é alterado.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
