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
  'admin.verComo':         { acesso: 'admin', fn: registrarVerComo_ },
  'exercicios.listar':     { acesso: 'logado', fn: listarExercicios_ },
  'exercicios.criar':      { acesso: 'logado', escrita: true, fn: criarExercicio_ },
  'exercicios.atualizar':  { acesso: 'logado', escrita: true, fn: atualizarExercicio_ },
  'fichas.listar':         { acesso: 'logado', fn: listarFichas_ },
  'fichas.salvar':         { acesso: 'logado', escrita: true, fn: salvarFicha_ },
  'fichas.excluir':        { acesso: 'logado', escrita: true, fn: excluirFicha_ },
  'treino.sincronizar':    { acesso: 'logado', escrita: true, fn: sincronizarTreino_ },
  'historico.listar':      { acesso: 'logado', fn: listarHistorico_ },
  'admin.importar.previa': { acesso: 'admin', fn: function (d, ctx) { return importarPlanilhaAntiga_(d, true, ctx.usuario); } },
  'admin.importar.executar': { acesso: 'admin', escrita: true, fn: function (d, ctx) { return importarPlanilhaAntiga_(d, false, ctx.usuario); } },
  // Fase 2: convites e vínculo
  'convites.criar':        { acesso: 'logado', escrita: true, fn: criarConvite_ },
  'convites.listar':       { acesso: 'logado', fn: listarConvites_ },
  'convites.revogar':      { acesso: 'logado', escrita: true, fn: revogarConvite_ },
  'convites.ver':          { acesso: 'logado', fn: verConvite_ },
  'convites.aceitar':      { acesso: 'logado', escrita: true, fn: aceitarConvite_ },
  'vinculo.meu':           { acesso: 'logado', fn: meuVinculo_ },
  'vinculo.encerrar':      { acesso: 'logado', escrita: true, fn: encerrarVinculo_ },
  // personal
  'personal.alunos':       { acesso: 'logado', fn: listarAlunos_ },
  'personal.aluno':        { acesso: 'logado', fn: lerAluno_ },
  'personal.fichaSalvar':  { acesso: 'logado', escrita: true, fn: salvarFichaDoAluno_ },
  'personal.fichaExcluir': { acesso: 'logado', escrita: true, fn: excluirFichaDoAluno_ },
  'personal.ajustesVistos':{ acesso: 'logado', escrita: true, fn: marcarAjustesVistos_ },
  'exercicios.propor':     { acesso: 'logado', escrita: true, fn: proporExercicio_ },
  // comentários (aluno e personal)
  'comentarios.listar':    { acesso: 'logado', fn: listarComentarios_ },
  'comentarios.criar':     { acesso: 'logado', escrita: true, fn: criarComentario_ },
  'comentarios.vistos':    { acesso: 'logado', escrita: true, fn: marcarComentariosVistos_ },
  // grupos
  'grupos.listar':         { acesso: 'logado', fn: listarGrupos_ },
  'grupos.ler':            { acesso: 'logado', fn: lerGrupo_ },
  'grupos.atualizar':      { acesso: 'logado', escrita: true, fn: atualizarGrupo_ },
  'grupos.papel':          { acesso: 'logado', escrita: true, fn: definirPapelMembro_ },
  'grupos.remover':        { acesso: 'logado', escrita: true, fn: removerMembro_ },
  'grupos.sair':           { acesso: 'logado', escrita: true, fn: sairDoGrupo_ },
  // administração
  'admin.grupos.criar':    { acesso: 'admin', escrita: true, fn: criarGrupo_ },
  'admin.grupos.excluir':  { acesso: 'admin', escrita: true, fn: excluirGrupo_ },
  'admin.usuario.atualizar': { acesso: 'admin', escrita: true, fn: atualizarUsuarioAdmin_ },
  'admin.catalogo':        { acesso: 'admin', fn: catalogoAdmin_ },
  'admin.exercicio.atualizar': { acesso: 'admin', escrita: true, fn: atualizarExercicioAdmin_ },
  'admin.exercicio.decidir': { acesso: 'admin', escrita: true, fn: decidirExercicio_ },
  // Fase 3: premium
  'precos.listar':         { acesso: 'logado', fn: listarPrecos_ },
  'licencas.minhas':       { acesso: 'logado', fn: minhasLicencas_ },
  'pedidos.criar':         { acesso: 'logado', escrita: true, fn: criarPedido_ },
  'pedidos.paguei':        { acesso: 'logado', escrita: true, fn: informarPagamento_ },
  'pedidos.cancelar':      { acesso: 'logado', escrita: true, fn: cancelarMeuPedido_ },
  'personal.licencas':     { acesso: 'logado', fn: minhasLicencasPersonal_ },
  'personal.atribuir':     { acesso: 'logado', escrita: true, fn: atribuirLicenca_ },
  'admin.config':          { acesso: 'admin', fn: lerConfigAdmin_ },
  'admin.config.salvar':   { acesso: 'admin', escrita: true, fn: salvarConfigAdmin_ },
  'admin.precos':          { acesso: 'admin', fn: precosAdmin_ },
  'admin.precos.salvar':   { acesso: 'admin', escrita: true, fn: salvarPrecosAdmin_ },
  'admin.pedidos':         { acesso: 'admin', fn: listarPedidosAdmin_ },
  'admin.pedido.liberar':  { acesso: 'admin', escrita: true, fn: liberarPedido_ },
  'admin.pedido.cancelar': { acesso: 'admin', escrita: true, fn: cancelarPedidoAdmin_ },
  'admin.cortesia':        { acesso: 'admin', escrita: true, fn: cortesia_ },
  'admin.licenca.revogar': { acesso: 'admin', escrita: true, fn: revogarLicenca_ },
  'admin.licencas.usuario':{ acesso: 'admin', fn: licencasDeUsuarioAdmin_ },
  'admin.lote':            { acesso: 'admin', escrita: true, fn: loteParaPersonal_ },
  // programas, medidas, exportação
  'programas.listar':      { acesso: 'logado', fn: listarProgramas_ },
  'programas.meus':        { acesso: 'logado', fn: programasAutor_ },
  'programas.salvar':      { acesso: 'logado', escrita: true, fn: salvarPrograma_ },
  'programas.excluir':     { acesso: 'logado', escrita: true, fn: excluirPrograma_ },
  'programas.usar':        { acesso: 'logado', escrita: true, fn: usarPrograma_ },
  'medidas.listar':        { acesso: 'logado', fn: listarMedidas_ },
  'medidas.salvar':        { acesso: 'logado', escrita: true, fn: salvarMedida_ },
  'medidas.excluir':       { acesso: 'logado', escrita: true, fn: excluirMedida_ },
  'exportar':              { acesso: 'logado', fn: exportarDados_ }
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
