/**
 * Carga do catálogo base (14_Catalogo.gs) e junção de exercícios repetidos.
 *
 * semear (administrador, com prévia):
 *   1. Nomes antigos conhecidos (APELIDOS_CATALOGO_) viram o nome padrão. Se o nome padrão já existe
 *      como outro exercício, os dois são juntados: fichas, séries e programas passam para o padrão.
 *      Apelidos marcados com "?" só entram se o administrador confirmar (o equipamento é suposição).
 *   2. Exercícios do catálogo que ainda não existem são criados no catálogo geral.
 *   3. Os que já existem com o mesmo nome ganham grupo, músculos secundários, equipamento e tipo
 *      de movimento quando esses campos estão vazios (ou com grupo fora da lista padrão).
 * Pode rodar de novo: nada é duplicado.
 */

function idCatalogo_(nome) {
  return 'cat_' + sha256_('catalogo|' + normalizarNome_(nome)).slice(0, 24);
}

function planoSemeadura_(confirmados) {
  confirmados = confirmados || {};
  var todos = lerTodos_('exercicios');
  var porNome = {};
  todos.forEach(function (e) { porNome[normalizarNome_(e.nome)] = porNome[normalizarNome_(e.nome)] || e; });
  var base = {};
  CATALOGO_BASE_.forEach(function (c) { base[normalizarNome_(c[0])] = c; });

  var renomear = [];
  var juntar = [];
  var duvidas = [];
  var tocados = {};
  Object.keys(APELIDOS_CATALOGO_).forEach(function (antigo) {
    var alvoBruto = APELIDOS_CATALOGO_[antigo];
    var duvidoso = /\?$/.test(alvoBruto);
    var alvo = alvoBruto.replace(/\?$/, '');
    var ex = porNome[normalizarNome_(antigo)];
    if (!ex || normalizarNome_(antigo) === normalizarNome_(alvo)) return;
    var item = { antigo: ex.nome, novo: alvo, id: ex.id };
    if (duvidoso && !confirmados[ex.nome]) { duvidas.push(item); return; }
    var existente = porNome[normalizarNome_(alvo)];
    if (existente && existente.id !== ex.id) { item.para_id = existente.id; juntar.push(item); }
    else renomear.push(item);
    tocados[normalizarNome_(alvo)] = true;
  });

  var criar = [];
  var completar = [];
  CATALOGO_BASE_.forEach(function (c) {
    var k = normalizarNome_(c[0]);
    var ex = porNome[k];
    if (!ex) {
      if (!tocados[k]) criar.push(c);
      return;
    }
    var campos = {};
    if (ex.global && ex.nome !== c[0]) campos.nome = c[0]; // mesma palavra, grafia do catálogo
    if (!ex.grupo_muscular || GRUPOS_MUSCULARES.indexOf(ex.grupo_muscular) < 0) campos.grupo_muscular = c[1];
    if (!ex.secundarios && c[2]) campos.secundarios = c[2];
    if (!ex.equipamento && c[3]) campos.equipamento = c[3];
    if (!ex.mecanica) campos.mecanica = c[4];
    if (Object.keys(campos).length) completar.push({ id: ex.id, nome: ex.nome, campos: campos });
  });
  return { renomear: renomear, juntar: juntar, duvidas: duvidas, criar: criar, completar: completar, base: base };
}

/** dados: { confirmar: ["Supino Inclinado", ...] } — apelidos com "?" que o administrador aceitou. */
function semearCatalogo_(d, soPrevia, ctx) {
  var confirmados = {};
  (Array.isArray(d.confirmar) ? d.confirmar : []).slice(0, 100).forEach(function (n) { if (typeof n === 'string') confirmados[n] = true; });
  var plano = planoSemeadura_(confirmados);
  var resumo = {
    catalogo: CATALOGO_BASE_.length,
    criar: plano.criar.length,
    completar: plano.completar.length,
    renomear: plano.renomear.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    juntar: plano.juntar.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    duvidas: plano.duvidas.map(function (r) { return { antigo: r.antigo, novo: r.novo }; }),
    grupos: GRUPOS_MUSCULARES
  };
  if (soPrevia) return resumo;

  comBloqueio_(function () {
    var autor = ctx.usuario.id;
    // renomear (e completar com os dados do catálogo)
    upsertLoteSemBloqueio_('exercicios', plano.renomear.map(function (r) {
      var c = plano.base[normalizarNome_(r.novo)] || [];
      return { id: r.id, nome: r.novo, grupo_muscular: c[1] || '', secundarios: c[2] || '', equipamento: c[3] || '', mecanica: c[4] || '', global: true };
    }));
    // juntar repetidos
    plano.juntar.forEach(function (r) { mesclarSemBloqueio_(r.id, r.para_id); });
    // completar campos vazios
    upsertLoteSemBloqueio_('exercicios', plano.completar.map(function (x) { return Object.assign({ id: x.id }, x.campos); }));
    // criar os que faltam
    var existentes = {};
    lerTodos_('exercicios', true).forEach(function (e) { existentes[e.id] = true; });
    upsertLoteSemBloqueio_('exercicios', plano.criar
      .map(function (c) {
        return { id: idCatalogo_(c[0]), nome: c[0], grupo_muscular: c[1], secundarios: c[2], equipamento: c[3], mecanica: c[4], video_url: '', criado_por: autor, global: true, status: '', excluido_em: null };
      })
      .filter(function (x) { return !existentes[x.id]; }));
    inserirSemBloqueio_('auditoria', { usuario_id: autor, acao: 'catalogo.semear', alvo: '', detalhes: JSON.stringify({ criar: resumo.criar, renomear: resumo.renomear.length, juntar: resumo.juntar.length }) });
  });
  resumo.feito = true;
  return resumo;
}

/** Junta dois exercícios: tudo o que usa "de" passa a usar "para"; "de" sai do catálogo. */
function mesclarSemBloqueio_(deId, paraId) {
  if (deId === paraId) throw erro_('VALIDACAO', 'Escolha dois exercícios diferentes.');
  var de = buscarUm_('exercicios', { id: deId });
  var para = buscarUm_('exercicios', { id: paraId });
  if (!de || !para) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var r = {};
  ['ficha_itens', 'series', 'programa_itens'].forEach(function (tabela) {
    var lista = lerTodos_(tabela, true).filter(function (x) { return x.exercicio_id === deId; });
    upsertLoteSemBloqueio_(tabela, lista.map(function (x) { return { id: x.id, exercicio_id: paraId }; }));
    r[tabela] = lista.length;
  });
  var campos = { excluido_em: agora_(), status: 'juntado:' + paraId };
  atualizarSemBloqueio_('exercicios', deId, campos);
  if (!para.video_url && de.video_url) atualizarSemBloqueio_('exercicios', paraId, { video_url: de.video_url });
  return r;
}

function mesclarExercicios_(d, ctx) {
  var de = id_(d.de, 'exercício');
  var para = id_(d.para, 'exercício');
  return comBloqueio_(function () {
    var r = mesclarSemBloqueio_(de, para);
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'catalogo.juntar', alvo: de, detalhes: para + ' ' + JSON.stringify(r) });
    return r;
  });
}

/** Pelo editor do Apps Script: prévia e carga do catálogo (usa o ADMIN_EMAIL como autor). */
function previaCatalogo() {
  var r = semearCatalogo_({}, true, null);
  console.log(JSON.stringify(r, null, 2));
  return r;
}

function carregarCatalogo() {
  var admin = buscarUm_('usuarios', { email: prop_('ADMIN_EMAIL', true).toLowerCase() });
  if (!admin) throw new Error('Cadastre a conta do administrador antes.');
  var r = semearCatalogo_({}, false, { usuario: admin });
  console.log(JSON.stringify(r, null, 2));
  return r;
}
