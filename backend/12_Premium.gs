/**
 * Fase 3: premium. Preços e chave Pix (só o administrador altera), pedidos com Pix copia e cola,
 * liberação manual pelo administrador, cortesias, lotes de licenças e saldo do personal.
 *
 * O Pix copia e cola é o "BR Code" estático do Banco Central: chave, valor, nome, cidade e um
 * identificador do pedido. Sem integração com banco, a confirmação é manual (até 2 dias úteis).
 */

// ---------- configurações e preços ----------

function config_(chave, padrao) {
  var c = buscarUm_('configuracoes', { id: chave });
  return c && c.valor !== null && c.valor !== '' ? c.valor : (padrao === undefined ? '' : padrao);
}

function lerConfigAdmin_() {
  return {
    chave_pix: config_('chave_pix'), nome_recebedor: config_('nome_recebedor'), cidade: config_('cidade'),
    incremento_padrao_kg: Number(config_('incremento_padrao_kg', APP.INCREMENTO_PADRAO_KG))
  };
}

function salvarConfigAdmin_(d, ctx) {
  var valores = {};
  if (d.chave_pix !== undefined) {
    var chave = texto_(d.chave_pix, 'chave Pix', 0, 77, false).replace(/\s+/g, '');
    if (chave && !/^[A-Za-z0-9@.+_-]+$/.test(chave)) throw erro_('VALIDACAO', 'Chave Pix inválida.');
    valores.chave_pix = chave;
  }
  if (d.nome_recebedor !== undefined) valores.nome_recebedor = texto_(d.nome_recebedor, 'nome do recebedor', 0, 60, false);
  if (d.cidade !== undefined) valores.cidade = texto_(d.cidade, 'cidade', 0, 40, false);
  if (d.incremento_padrao_kg !== undefined) valores.incremento_padrao_kg = String(numero_(d.incremento_padrao_kg, 'incremento', 0.25, 20, false));
  comBloqueio_(function () {
    Object.keys(valores).forEach(function (k) {
      if (buscarUm_('configuracoes', { id: k }, true)) atualizarSemBloqueio_('configuracoes', k, { valor: valores[k], excluido_em: null });
      else inserirSemBloqueio_('configuracoes', { id: k, valor: valores[k] });
    });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'admin.config', alvo: Object.keys(valores).join(','), detalhes: '' });
  });
  return lerConfigAdmin_();
}

/** Preços ativos para quem está logado (aluno vê os de aluno; personal vê os dois). */
function listarPrecos_(d, ctx) {
  var u = ctx.usuario;
  return lerTodos_('precos')
    .filter(function (p) { return p.ativo && (p.publico === 'aluno' || (p.publico === 'personal' && (u.personal_ativo || u.admin))); })
    .map(function (p) { return publico_(p, []); })
    .sort(ordemPeriodo_);
}

function ordemPeriodo_(a, b) {
  var ordem = ['mensal', 'trimestral', 'semestral', 'anual'];
  return (a.publico < b.publico ? -1 : a.publico > b.publico ? 1 : 0) || ordem.indexOf(a.periodo) - ordem.indexOf(b.periodo);
}

function precosAdmin_() {
  return lerTodos_('precos').map(function (p) { return publico_(p, []); }).sort(ordemPeriodo_);
}

function salvarPrecosAdmin_(d, ctx) {
  var lista = lista_(d.precos, 'preços', 20).map(function (p) {
    return { id: id_(p.id, 'preço'), valor: numero_(p.valor, 'valor', 0.01, 9999, false), ativo: p.ativo !== false };
  });
  return comBloqueio_(function () {
    var existentes = {};
    lerTodos_('precos').forEach(function (p) { existentes[p.id] = true; });
    lista.forEach(function (p) { if (!existentes[p.id]) throw erro_('NAO_ENCONTRADO', 'Preço não encontrado.'); });
    upsertLoteSemBloqueio_('precos', lista);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'admin.precos', alvo: '', detalhes: JSON.stringify(lista).slice(0, 1000) });
    return precosAdmin_();
  });
}

// ---------- Pix copia e cola (BR Code estático) ----------

function campoEmv_(id, valor) {
  var v = String(valor);
  return id + ('0' + v.length).slice(-2) + v;
}

function semAcento_(t, max) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase().trim().slice(0, max);
}

function crc16_(texto) {
  var crc = 0xFFFF;
  for (var i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

function pixCopiaECola_(chave, nome, cidade, valor, txid) {
  var conta = campoEmv_('00', 'br.gov.bcb.pix') + campoEmv_('01', chave);
  var corpo = campoEmv_('00', '01') +
    campoEmv_('26', conta) +
    campoEmv_('52', '0000') +
    campoEmv_('53', '986') +
    campoEmv_('54', Number(valor).toFixed(2)) +
    campoEmv_('58', 'BR') +
    campoEmv_('59', semAcento_(nome, 25) || 'RECEBEDOR') +
    campoEmv_('60', semAcento_(cidade, 15) || 'BRASIL') +
    campoEmv_('62', campoEmv_('05', txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25)));
  var semCrc = corpo + '6304';
  return semCrc + crc16_(semCrc);
}

// ---------- pedidos ----------

function codigoReferencia_() {
  var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'MT' + bytesAleatorios_(8).map(function (b) { return alfabeto.charAt((b & 0xff) % alfabeto.length); }).join('');
}

function comPix_(p) {
  var r = publico_(p, []);
  var chave = config_('chave_pix');
  r.pix = (p.status === 'aguardando' || p.status === 'informado') && chave
    ? pixCopiaECola_(chave, config_('nome_recebedor'), config_('cidade'), p.valor, p.codigo_referencia)
    : '';
  r.recebedor = config_('nome_recebedor');
  return r;
}

/** dados: { periodo, quantidade? } — quantidade > 1 só para personal (licenças para os alunos). */
function criarPedido_(d, ctx) {
  var u = ctx.usuario;
  var periodo = opcao_(d.periodo, 'período', Object.keys(APP.PERIODOS));
  var tipo = d.tipo === 'personal' ? 'personal' : 'aluno';
  if (tipo === 'personal' && !u.personal_ativo) throw erro_('PROIBIDO', 'Só personal ativo compra licenças para alunos.');
  var quantidade = tipo === 'personal' ? numero_(d.quantidade, 'quantidade', 1, 100, false) : 1;
  if (Math.round(quantidade) !== quantidade) throw erro_('VALIDACAO', 'Quantidade inválida.');
  if (!config_('chave_pix')) throw erro_('INDISPONIVEL', 'A compra ainda não está disponível: falta o administrador cadastrar a chave Pix.');
  var preco = lerTodos_('precos').filter(function (p) { return p.ativo && p.publico === tipo && p.periodo === periodo; })[0];
  if (!preco) throw erro_('INDISPONIVEL', 'Este período não está à venda agora.');
  return comBloqueio_(function () {
    var abertos = buscar_('pedidos', { comprador_id: u.id }).filter(function (p) { return p.status === 'aguardando' || p.status === 'informado'; });
    if (abertos.length >= APP.MAX_PEDIDOS_ABERTOS) throw erro_('LIMITE', 'Você já tem pedidos em aberto. Pague ou cancele um deles antes.');
    var usados = {};
    lerTodos_('pedidos', true).forEach(function (p) { usados[p.codigo_referencia] = true; });
    var ref;
    do { ref = codigoReferencia_(); } while (usados[ref]);
    var p = inserirSemBloqueio_('pedidos', {
      comprador_id: u.id, tipo: tipo, periodo: periodo, quantidade: quantidade,
      valor: Math.round(preco.valor * quantidade * 100) / 100, // valor congelado no momento da compra
      codigo_referencia: ref, status: 'aguardando'
    });
    return comPix_(p);
  });
}

function meusPedidos_(d, ctx) {
  return buscar_('pedidos', { comprador_id: ctx.usuario.id })
    .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; })
    .map(comPix_);
}

function informarPagamento_(d, ctx) {
  return mudarMeuPedido_(d, ctx, 'aguardando', { status: 'informado', pago_informado_em: agora_() });
}

function cancelarMeuPedido_(d, ctx) {
  return mudarMeuPedido_(d, ctx, null, { status: 'cancelado' });
}

function mudarMeuPedido_(d, ctx, deStatus, campos) {
  var id = id_(d.id, 'pedido');
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p || p.comprador_id !== ctx.usuario.id) throw erro_('NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (deStatus ? p.status !== deStatus : (p.status !== 'aguardando' && p.status !== 'informado')) throw erro_('VALIDACAO', 'Este pedido não pode mais ser alterado.');
    return comPix_(atualizarSemBloqueio_('pedidos', id, campos));
  });
}

// ---------- licenças ----------

function somarMeses_(iso, meses) {
  var t = new Date(iso);
  var dia = t.getUTCDate();
  t.setUTCMonth(t.getUTCMonth() + meses);
  if (t.getUTCDate() < dia) t.setUTCDate(0); // 31/01 + 1 mês = 28 ou 29/02
  return t.toISOString();
}

/** Início de uma licença nova: agora, ou o fim do premium com prazo que já está valendo (soma o período). */
function inicioDaProxima_(usuarioId) {
  var agora = agora_();
  var fim = agora;
  buscar_('licencas', { usuario_id: usuarioId }).forEach(function (l) {
    if (l.fim && l.inicio <= agora && l.fim > fim) fim = l.fim;
  });
  return fim;
}

/** regra: 'periodo:mensal' | 'dias:90' | 'ate:2027-02-15T…' | 'sem_prazo' */
function fimPorRegra_(regra, inicio) {
  if (regra === 'sem_prazo') return null;
  var m = String(regra).match(/^(periodo|dias|ate):(.+)$/);
  if (!m) throw erro_('VALIDACAO', 'Prazo inválido.');
  if (m[1] === 'periodo') return somarMeses_(inicio, APP.PERIODOS[m[2]]);
  if (m[1] === 'dias') return new Date(new Date(inicio).getTime() + Number(m[2]) * 864e5).toISOString();
  return m[2];
}

function regraDoPedido_(d) {
  var modo = opcao_(d.modo, 'prazo', ['periodo', 'dias', 'ate', 'sem_prazo']);
  if (modo === 'sem_prazo') return 'sem_prazo';
  if (modo === 'periodo') return 'periodo:' + opcao_(d.periodo, 'período', Object.keys(APP.PERIODOS));
  if (modo === 'dias') return 'dias:' + numero_(d.dias, 'dias', 1, 3650, false);
  var ate = dataIso_(d.ate, 'data final');
  if (ate <= agora_()) throw erro_('VALIDACAO', 'A data final precisa ser no futuro.');
  return 'ate:' + ate;
}

function concederLicenca_(usuarioId, regra, origem, porId, pedidoId) {
  var inicio = regra.indexOf('ate:') === 0 || regra === 'sem_prazo' ? agora_() : inicioDaProxima_(usuarioId);
  return inserirSemBloqueio_('licencas', {
    usuario_id: usuarioId, origem: origem, inicio: inicio, fim: fimPorRegra_(regra, inicio),
    concedida_por: porId || '', pedido_id: pedidoId || ''
  });
}

/** Aluno: licenças e pedidos dele. */
function minhasLicencas_(d, ctx) {
  var u = ctx.usuario;
  return {
    plano: planoAtual_(u),
    licencas: buscar_('licencas', { usuario_id: u.id }).map(function (l) { return publico_(l, []); })
      .sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }),
    pedidos: meusPedidos_(d, ctx),
    pix_disponivel: !!config_('chave_pix')
  };
}

// ---------- administrador ----------

function listarPedidosAdmin_(d) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (u) { nomes[u.id] = u; });
  return lerTodos_('pedidos')
    .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; })
    .map(function (p) {
      var r = publico_(p, []);
      var c = nomes[p.comprador_id] || {};
      r.comprador_nome = c.nome || '';
      r.comprador_email = c.email || '';
      return r;
    });
}

function liberarPedido_(d, ctx) {
  var id = id_(d.id, 'pedido');
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p) throw erro_('NAO_ENCONTRADO', 'Pedido não encontrado.');
    if (p.status !== 'aguardando' && p.status !== 'informado') throw erro_('VALIDACAO', 'Este pedido já foi ' + p.status + '.');
    var r = { pedido: id };
    if (p.tipo === 'personal') {
      var novos = [];
      for (var i = 0; i < p.quantidade; i++) {
        novos.push({ id: novoId_(), personal_id: p.comprador_id, periodo_ou_fim: 'periodo:' + p.periodo, origem: 'compra', pedido_id: p.id });
      }
      upsertLoteSemBloqueio_('saldo_licencas_personal', novos);
      r.licencas_no_saldo = novos.length;
    } else {
      var l = concederLicenca_(p.comprador_id, 'periodo:' + p.periodo, 'compra', ctx.usuario.id, p.id);
      r.licenca = publico_(l, []);
    }
    atualizarSemBloqueio_('pedidos', id, { status: 'liberado', liberado_em: agora_(), liberado_por: ctx.usuario.id });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'pedido.liberar', alvo: id, detalhes: p.codigo_referencia + ' ' + p.valor });
    return r;
  });
}

function cancelarPedidoAdmin_(d, ctx) {
  var id = id_(d.id, 'pedido');
  var obs = texto_(d.observacao, 'observação', 0, 300, false);
  return comBloqueio_(function () {
    var p = buscarUm_('pedidos', { id: id });
    if (!p || (p.status !== 'aguardando' && p.status !== 'informado')) throw erro_('VALIDACAO', 'Este pedido não pode ser cancelado.');
    atualizarSemBloqueio_('pedidos', id, { status: 'cancelado', observacao: obs });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'pedido.cancelar', alvo: id, detalhes: obs });
    return { cancelado: id };
  });
}

/** Cortesia: { usuario_id, modo: 'dias'|'ate'|'sem_prazo'|'periodo', dias?, ate?, periodo? } */
function cortesia_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var regra = regraDoPedido_(d);
  return comBloqueio_(function () {
    var l = concederLicenca_(alvo.id, regra, 'cortesia', ctx.usuario.id, '');
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.cortesia', alvo: alvo.id, detalhes: regra });
    return publico_(l, []);
  });
}

function revogarLicenca_(d, ctx) {
  var id = id_(d.id, 'licença');
  return comBloqueio_(function () {
    var l = buscarUm_('licencas', { id: id });
    if (!l) throw erro_('NAO_ENCONTRADO', 'Licença não encontrada.');
    atualizarSemBloqueio_('licencas', id, { excluido_em: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.revogar', alvo: id, detalhes: l.usuario_id });
    return { revogada: id };
  });
}

function licencasDeUsuarioAdmin_(d) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  return {
    plano: planoAtual_(alvo),
    licencas: buscar_('licencas', { usuario_id: alvo.id }).map(function (l) { return publico_(l, []); }),
    saldo: alvo.personal_ativo ? saldoDe_(alvo.id) : null
  };
}

/** Lote de licenças para o personal distribuir: { personal_id, quantidade, modo, ... } */
function loteParaPersonal_(d, ctx) {
  var p = buscarUm_('usuarios', { id: id_(d.personal_id, 'personal') });
  if (!p || !p.personal_ativo) throw erro_('VALIDACAO', 'Esta pessoa não tem o papel de personal ativo.');
  var qtd = numero_(d.quantidade, 'quantidade', 1, 100, false);
  var regra = regraDoPedido_(d);
  return comBloqueio_(function () {
    var novos = [];
    for (var i = 0; i < Math.round(qtd); i++) novos.push({ id: novoId_(), personal_id: p.id, periodo_ou_fim: regra, origem: 'lote' });
    upsertLoteSemBloqueio_('saldo_licencas_personal', novos);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.lote', alvo: p.id, detalhes: novos.length + ' ' + regra });
    return { criadas: novos.length };
  });
}

// ---------- personal: saldo e atribuição ----------

function saldoDe_(personalId) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (u) { nomes[u.id] = u.nome; });
  var licencas = {};
  lerTodos_('licencas').forEach(function (l) { licencas[l.id] = l; });
  return buscar_('saldo_licencas_personal', { personal_id: personalId }).map(function (s) {
    var r = publico_(s, []);
    r.aluno_nome = s.atribuida_a ? nomes[s.atribuida_a] || '' : '';
    var l = licencas[s.licenca_id];
    r.fim = l ? l.fim : null;
    r.revogada = !!(s.licenca_id && !l);
    return r;
  }).sort(function (a, b) { return (a.atribuida_em || '') < (b.atribuida_em || '') ? 1 : -1; });
}

function minhasLicencasPersonal_(d, ctx) {
  if (!ctx.usuario.personal_ativo && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  return { saldo: saldoDe_(ctx.usuario.id) };
}

function atribuirLicenca_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return comBloqueio_(function () {
    var livres = buscar_('saldo_licencas_personal', { personal_id: ctx.usuario.id }).filter(function (s) { return !s.atribuida_a; });
    var s = d.saldo_id ? livres.filter(function (x) { return x.id === d.saldo_id; })[0] : livres[0];
    if (!s) throw erro_('SEM_SALDO', 'Você não tem licenças livres. Compre mais ou peça ao administrador.');
    var l = concederLicenca_(aluno.id, s.periodo_ou_fim, 'personal', ctx.usuario.id, s.pedido_id || '');
    atualizarSemBloqueio_('saldo_licencas_personal', s.id, { atribuida_a: aluno.id, atribuida_em: agora_(), licenca_id: l.id });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'licenca.atribuir', alvo: aluno.id, detalhes: s.id });
    return { licenca: publico_(l, []), aluno: aluno.nome };
  });
}
