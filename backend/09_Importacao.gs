/**
 * Importação da planilha antiga (abas PLANO_ATUAL e LOGS_TREINO) para a conta de um aluno.
 *
 * Como usar (só o administrador):
 *   1. Abra o arquivo .xlsx antigo no Google Drive e use Arquivo > Salvar como Planilhas Google.
 *   2. Copie o ID da planilha nova (o trecho longo do endereço, entre /d/ e /edit).
 *   3. No app, Painel > Importar planilha antiga: veja a prévia e confirme.
 *      Ou, no editor do Apps Script: preencha IMPORTAR_PLANILHA_ID e IMPORTAR_EMAIL nas
 *      Propriedades do script e rode previaImportacao() e depois importarPlanilhaAntiga().
 *
 * Pode rodar de novo: os ids são calculados a partir do conteúdo, então nada é duplicado.
 * Fichas e exercícios da ficha que já existem não são sobrescritos (as suas mudanças ficam).
 *
 * Datas: a planilha antiga guardava a hora local sem fuso; usamos -03:00 (Brasília/Fortaleza).
 */
var IMPORTACAO_ = { FUSO: '-03:00', METODOS: { 'drop-set': 'drop-set', 'rest-pause': 'rest-pause', 'bi-set': 'bi-set', 'tri-set': 'tri-set' } };

function previaImportacao() {
  var r = importarPlanilhaAntiga_({ planilha_id: prop_('IMPORTAR_PLANILHA_ID', true), email: prop_('IMPORTAR_EMAIL', true) }, true);
  console.log(JSON.stringify(r, null, 2));
  return r;
}

function importarPlanilhaAntiga() {
  var r = importarPlanilhaAntiga_({ planilha_id: prop_('IMPORTAR_PLANILHA_ID', true), email: prop_('IMPORTAR_EMAIL', true) }, false);
  console.log(JSON.stringify(r.resumo, null, 2));
  return r;
}

/**
 * dados: { planilha_id, email, renomear?: { "nome antigo": "nome novo" }, separar_reps?: true }
 * separar_reps: na planilha antiga, valores como "42.510kg" eram carga e repetições juntas
 * (42,5 kg × 10). Com true (padrão), o app separa os dois.
 */
function importarPlanilhaAntiga_(d, soPrevia, quem) {
  var planilhaId = texto_(d.planilha_id, 'ID da planilha', 20, 100, true);
  if (!/^[A-Za-z0-9_-]+$/.test(planilhaId)) throw erro_('VALIDACAO', 'ID da planilha inválido.');
  var email = email_(d.email);
  var separarReps = d.separar_reps !== false;
  var renomear = {};
  if (d.renomear && typeof d.renomear === 'object') {
    Object.keys(d.renomear).slice(0, 100).forEach(function (k) {
      renomear[normalizarNome_(k)] = texto_(d.renomear[k], 'novo nome', 2, 80, true);
    });
  }

  var aluno = buscarUm_('usuarios', { email: email });
  if (!aluno) throw erro_('NAO_ENCONTRADO', 'Nenhuma conta com o e-mail ' + email + '. Cadastre a conta antes de importar.');

  var antiga;
  try { antiga = SpreadsheetApp.openById(planilhaId); }
  catch (x) { throw erro_('NAO_ENCONTRADO', 'Não consegui abrir a planilha antiga. Confira o ID e se ela está no seu Google Drive.'); }
  var fusoPlanilha = antiga.getSpreadsheetTimeZone ? antiga.getSpreadsheetTimeZone() : 'America/Fortaleza';
  var plano = lerAbaAntiga_(antiga, 'PLANO_ATUAL', ['divisao', 'nome_exercicio']);
  var logs = lerAbaAntiga_(antiga, 'LOGS_TREINO', ['data_hora', 'divisao_realizada', 'nome_exercicio', 'carga_utilizada']);

  var relatorio = { separados: {}, revisar: {}, sem_carga: 0 };
  var nomeFinal = function (bruto) {
    var n = String(bruto == null ? '' : bruto).replace(/\s+/g, ' ').trim();
    return renomear[normalizarNome_(n)] || n;
  };

  // ----- exercícios -----
  var catalogo = {};
  lerTodos_('exercicios').forEach(function (e) { if (e.global) catalogo[normalizarNome_(e.nome)] = e; });
  var exercicios = {};    // chave normalizada -> registro
  var gruposPorNome = {};
  plano.forEach(function (p) { if (p.grupo_muscular) gruposPorNome[normalizarNome_(nomeFinal(p.nome_exercicio))] = String(p.grupo_muscular).trim(); });
  function exercicio(nomeBruto) {
    var nome = nomeFinal(nomeBruto);
    var chave = normalizarNome_(nome);
    if (!chave) return null;
    if (!exercicios[chave]) {
      var existe = catalogo[chave];
      exercicios[chave] = existe
        ? { id: existe.id, nome: existe.nome, novo: false }
        : { id: idImportacao_('ex', chave), nome: nome, novo: true, grupo_muscular: gruposPorNome[chave] || '', usos: 0 };
    }
    return exercicios[chave];
  }

  // ----- fichas (uma por divisão: A, B, C...) -----
  var fichas = {};
  var itens = [];
  plano
    .slice()
    .sort(function (a, b) { return String(a.divisao).localeCompare(String(b.divisao)) || (Number(a.ordem) || 0) - (Number(b.ordem) || 0); })
    .forEach(function (p) {
      var div = String(p.divisao || '').trim().toUpperCase();
      var ex = exercicio(p.nome_exercicio);
      if (!div || !ex) return;
      if (!fichas[div]) {
        fichas[div] = { id: idImportacao_('fi', aluno.id + '|' + div), aluno_id: aluno.id, autor_id: aluno.id, nome: 'Treino ' + div, ordem: Object.keys(fichas).length + 1, ativa: true, _itens: 0 };
      }
      var f = fichas[div];
      f._itens++;
      var metodo = IMPORTACAO_.METODOS[normalizarNome_(p.metodo_avancado).replace(/\s+/g, '-')] || (p.metodo_avancado ? 'outro' : '');
      var reps = p.repeticoes === null || p.repeticoes === '' || p.repeticoes === undefined ? '' : String(p.repeticoes).trim();
      var repsNum = /^\d+$/.test(reps) ? Number(reps) : null;
      itens.push({
        id: idImportacao_('it', aluno.id + '|' + div + '|' + normalizarNome_(ex.nome)),
        ficha_id: f.id, exercicio_id: ex.id, ordem: f._itens,
        series: Math.max(1, Math.round(Number(p.series) || 1)),
        reps_prescritas: reps.slice(0, 40), reps_min: repsNum, reps_max: repsNum,
        carga_prescrita_kg: numeroOuNulo_(p.carga_sugerida), aumento_max_kg: null,
        carga_atual_kg: null, reps_atuais: '',
        descanso_seg: numeroOuNulo_(p.intervalo_seg), metodo: metodo,
        observacoes: String(p.observacoes || '').trim().slice(0, 500),
        _div: div, _chave: normalizarNome_(ex.nome)
      });
    });

  // ----- sessões e séries -----
  var sessoes = {};
  var series = [];
  var ocorrencias = {};
  var ultimaCarga = {}; // div|exercício -> { inicio, carga }
  logs.forEach(function (l) {
    var inicio = dataAntiga_(l.data_hora, fusoPlanilha);
    var div = String(l.divisao_realizada || '').trim().toUpperCase();
    var ex = exercicio(l.nome_exercicio);
    if (!inicio || !ex) return;
    var chaveSessao = inicio + '|' + div;
    if (!sessoes[chaveSessao]) {
      sessoes[chaveSessao] = {
        id: idImportacao_('se', aluno.id + '|' + chaveSessao),
        aluno_id: aluno.id, ficha_id: fichas[div] ? fichas[div].id : null,
        inicio: inicio, fim: inicio, observacao: 'Importado da planilha antiga (treino ' + (div || '?') + ').', _n: 0
      };
    }
    var s = sessoes[chaveSessao];
    s._n++;
    var chaveEx = chaveSessao + '|' + normalizarNome_(ex.nome);
    ocorrencias[chaveEx] = (ocorrencias[chaveEx] || 0) + 1;
    if (ex.novo) ex.usos++;
    var textos = typeof l.carga_utilizada === 'number' ? [String(l.carga_utilizada)] : String(l.carga_utilizada || '').split('/');
    var maior = null;
    textos.forEach(function (t, i) {
      var c = lerCargaAntiga_(t, separarReps);
      if (c.situacao === 'separado') contarNoRelatorio_(relatorio.separados, t.trim(), ex.nome, c);
      if (c.situacao === 'revisar') contarNoRelatorio_(relatorio.revisar, t.trim(), ex.nome, c);
      if (c.carga === null) relatorio.sem_carga++;
      if (c.carga !== null && (maior === null || c.carga > maior)) maior = c.carga;
      series.push({
        id: idImportacao_('sr', aluno.id + '|' + chaveEx + '|' + ocorrencias[chaveEx] + '|' + i),
        sessao_id: s.id, exercicio_id: ex.id, ordem: s._n * 100 + i + 1, tipo: 'normal',
        reps: c.reps, carga_kg: c.carga, rpe: numeroOuNulo_(l.percepcao_esforco)
      });
    });
    var chaveUlt = div + '|' + normalizarNome_(ex.nome);
    if (maior !== null && maior > 0 && (!ultimaCarga[chaveUlt] || ultimaCarga[chaveUlt].inicio <= inicio)) {
      ultimaCarga[chaveUlt] = { inicio: inicio, carga: maior };
    }
  });
  itens.forEach(function (i) {
    var u = ultimaCarga[i._div + '|' + i._chave];
    if (u) i.carga_atual_kg = u.carga;
  });

  var listaSessoes = Object.keys(sessoes).map(function (k) { return sessoes[k]; });
  var datas = listaSessoes.map(function (s) { return s.inicio; }).sort();
  var resumo = {
    aluno: { nome: aluno.nome, email: aluno.email },
    periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    fichas: Object.keys(fichas).map(function (k) { return { nome: fichas[k].nome, exercicios: fichas[k]._itens }; }),
    exercicios_novos: Object.keys(exercicios).filter(function (k) { return exercicios[k].novo; }).length,
    exercicios_existentes: Object.keys(exercicios).filter(function (k) { return !exercicios[k].novo; }).length,
    sessoes: listaSessoes.length,
    series: series.length,
    series_sem_carga: relatorio.sem_carga
  };
  var saida = {
    resumo: resumo,
    exercicios: Object.keys(exercicios).sort().map(function (k) {
      var e = exercicios[k];
      return { nome: e.nome, novo: e.novo, grupo_muscular: e.grupo_muscular || '', parecidos: parecidos_(k, exercicios) };
    }),
    cargas_separadas: listaRelatorio_(relatorio.separados),
    cargas_para_revisar: listaRelatorio_(relatorio.revisar)
  };
  if (soPrevia) return saida;

  saida.gravado = comBloqueio_(function () {
    var admin = quem || buscarUm_('usuarios', { email: prop_('ADMIN_EMAIL', false).toLowerCase() });
    var novosEx = Object.keys(exercicios).map(function (k) { return exercicios[k]; }).filter(function (e) { return e.novo; })
      .map(function (e) { return { id: e.id, nome: e.nome, grupo_muscular: e.grupo_muscular, equipamento: '', video_url: '', criado_por: admin ? admin.id : aluno.id, global: true }; });
    var jaExistem = {};
    lerTodos_('fichas', true).forEach(function (f) { jaExistem[f.id] = f; });
    lerTodos_('ficha_itens', true).forEach(function (i) { jaExistem[i.id] = i; });
    lerTodos_('exercicios', true).forEach(function (e) { jaExistem[e.id] = e; });
    var limpar = function (o) { return publico_(o, []); };
    var r = {
      exercicios: upsertLoteSemBloqueio_('exercicios', novosEx.filter(function (e) { return !jaExistem[e.id]; })),
      fichas: upsertLoteSemBloqueio_('fichas', Object.keys(fichas).map(function (k) { return limpar(fichas[k]); }).filter(function (f) { return !jaExistem[f.id]; })),
      itens: upsertLoteSemBloqueio_('ficha_itens', itens.map(limpar).filter(function (i) { return !jaExistem[i.id]; })),
      sessoes: upsertLoteSemBloqueio_('sessoes', listaSessoes.map(limpar), { podeAlterar: function (a) { return a.aluno_id === aluno.id; } }),
      series: upsertLoteSemBloqueio_('series', series)
    };
    // Conta do dono dos dados antigos vira premium sem prazo (cortesia), se ainda não tiver.
    var idLic = idImportacao_('li', aluno.id);
    if (!buscarUm_('licencas', { id: idLic }, true)) {
      inserirSemBloqueio_('licencas', { id: idLic, usuario_id: aluno.id, origem: 'cortesia', inicio: agora_(), fim: null, concedida_por: admin ? admin.id : null, pedido_id: null });
      r.licenca = 'premium sem prazo concedido';
    } else {
      r.licenca = 'já existia';
    }
    inserirSemBloqueio_('auditoria', { usuario_id: admin ? admin.id : '', acao: 'importacao.planilha_antiga', alvo: aluno.id, detalhes: JSON.stringify(resumo).slice(0, 2000) });
    return r;
  });
  return saida;
}

// ---------- ajudantes da importação ----------

function lerAbaAntiga_(ss, nome, obrigatorias) {
  var aba = ss.getSheetByName(nome);
  if (!aba) throw erro_('VALIDACAO', 'A planilha antiga não tem a aba ' + nome + '.');
  var valores = aba.getDataRange().getValues();
  if (!valores.length) return [];
  var cab = valores[0].map(function (c) { return String(c).trim(); });
  obrigatorias.forEach(function (c) {
    if (cab.indexOf(c) < 0) throw erro_('VALIDACAO', 'Coluna ' + c + ' não encontrada na aba ' + nome + '.');
  });
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var o = {};
    var vazio = true;
    cab.forEach(function (c, j) { o[c] = valores[i][j]; if (valores[i][j] !== '' && valores[i][j] !== null) vazio = false; });
    if (!vazio) lista.push(o);
  }
  return lista;
}

/** Hora da planilha antiga -> ISO em UTC, tratando o horário como -03:00. */
function dataAntiga_(v, fusoPlanilha) {
  var local;
  if (v instanceof Date || (v && typeof v.getTime === 'function')) {
    if (isNaN(v.getTime())) return null;
    local = Utilities.formatDate(v, fusoPlanilha, "yyyy-MM-dd'T'HH:mm:ss");
  } else {
    var m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) local = m[3] + '-' + pad2_(m[2]) + '-' + pad2_(m[1]) + 'T' + pad2_(m[4]) + ':' + m[5] + ':' + (m[6] || '00');
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(String(v || '').trim())) local = String(v).trim().replace(' ', 'T');
    else return null;
    if (local.length === 16) local += ':00';
  }
  var t = new Date(local + IMPORTACAO_.FUSO);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

function pad2_(n) { return ('0' + n).slice(-2); }

function numeroOuNulo_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/**
 * Lê um valor de carga da planilha antiga: "42.5kg", "-", "42.510kg" (= 42,5 kg × 10 repetições).
 * Decimais normais de anilha: ,5 ,25 ,75 (e ,125 etc.). Sobrando exatamente 2 dígitos (01 a 30),
 * eles são as repetições. O que não se encaixa fica como está e vai para a lista "revisar".
 */
function lerCargaAntiga_(texto, separarReps) {
  var t = String(texto == null ? '' : texto).trim().toLowerCase().replace(/\s+/g, '').replace(/kg$/, '').replace(',', '.');
  if (t === '' || t === '-' || t === '—') return { carga: null, reps: null, situacao: 'vazio' };
  var m = t.match(/^(\d{1,4})(?:\.(\d{1,6}))?$/);
  if (!m) return { carga: null, reps: null, situacao: 'revisar' };
  var inteiro = m[1];
  var dec = m[2] || '';
  var normais = ['', '0', '00', '000', '5', '50', '500', '25', '250', '75', '750', '125', '375', '625', '875'];
  if (normais.indexOf(dec) >= 0) {
    var c0 = Number(inteiro + (dec ? '.' + dec : ''));
    return { carga: c0 > 0 ? c0 : null, reps: null, situacao: c0 > 0 ? 'ok' : 'vazio' };
  }
  if (separarReps) {
    var prefixos = ['25', '75', '5', ''];
    for (var i = 0; i < prefixos.length; i++) {
      var p = prefixos[i];
      if (dec.indexOf(p) !== 0 || dec.length - p.length !== 2) continue;
      var reps = Number(dec.slice(p.length));
      if (reps >= 1 && reps <= 30) {
        return { carga: Number(inteiro + (p ? '.' + p : '')), reps: reps, situacao: 'separado' };
      }
    }
  }
  return { carga: Number(inteiro + '.' + dec), reps: null, situacao: 'revisar' };
}

function contarNoRelatorio_(mapa, texto, exercicio, c) {
  var k = texto + '|' + exercicio;
  if (!mapa[k]) mapa[k] = { texto: texto, exercicio: exercicio, carga_kg: c.carga, reps: c.reps, vezes: 0 };
  mapa[k].vezes++;
}

function listaRelatorio_(mapa) {
  return Object.keys(mapa).map(function (k) { return mapa[k]; })
    .sort(function (a, b) { return a.exercicio.localeCompare(b.exercicio, 'pt-BR') || a.texto.localeCompare(b.texto); });
}

/** Nomes que podem ser o mesmo exercício escrito de outro jeito (para você conferir). */
function parecidos_(chave, todos) {
  var palavras = chave.split(' ').filter(function (p) { return p.length > 2; });
  return Object.keys(todos).filter(function (k) {
    if (k === chave) return false;
    if (k.indexOf(chave) >= 0 || chave.indexOf(k) >= 0) return true;
    var outras = k.split(' ').filter(function (p) { return p.length > 2; });
    var comuns = palavras.filter(function (p) { return outras.indexOf(p) >= 0; }).length;
    return comuns >= 2 && comuns >= Math.min(palavras.length, outras.length);
  }).map(function (k) { return todos[k].nome; });
}

function idImportacao_(tipo, chave) {
  return 'imp_' + tipo + '_' + sha256_('importacao|' + tipo + '|' + chave).slice(0, 24);
}
