/**
 * Fase 1: exercícios, fichas, treinos e histórico do aluno.
 *
 * Os ids de fichas, itens, sessões e séries são criados no aparelho (o app funciona sem internet)
 * e enviados depois. Por isso o servidor confere o formato do id e quem é o dono de cada registro.
 */

// ---------- validações deste módulo ----------

function id_(valor, campo) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(valor)) {
    throw erro_('VALIDACAO', 'Identificador inválido em ' + (campo || 'id') + '.');
  }
  return valor;
}

function idOpcional_(valor, campo) {
  return valor === null || valor === undefined || valor === '' ? null : id_(valor, campo);
}

function numero_(valor, campo, min, max, opcional) {
  if (valor === null || valor === undefined || valor === '') {
    if (opcional) return null;
    throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
  }
  var n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  return Math.round(n * 1000) / 1000;
}

function dataIso_(valor, campo, opcional) {
  if (valor === null || valor === undefined || valor === '') {
    if (opcional) return null;
    throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
  }
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw erro_('VALIDACAO', 'Data inválida em ' + campo + '.');
  }
  var t = new Date(valor);
  if (isNaN(t.getTime())) throw erro_('VALIDACAO', 'Data inválida em ' + campo + '.');
  return t.toISOString();
}

function lista_(valor, campo, max) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw erro_('VALIDACAO', 'Lista inválida em ' + campo + '.');
  if (valor.length > max) throw erro_('VALIDACAO', 'Itens demais em ' + campo + ' (máximo ' + max + ').');
  return valor.map(function (x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw erro_('VALIDACAO', 'Item inválido em ' + campo + '.');
    return x;
  });
}

/**
 * Aceita só links do YouTube e guarda no formato padrão.
 * Vídeos próprios do personal: suba no YouTube como "não listado" e cole o link.
 */
function videoYoutube_(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  var id = idYoutube_(valor);
  if (!id) throw erro_('VALIDACAO', 'Use um link do YouTube (youtube.com ou youtu.be).');
  return 'https://www.youtube.com/watch?v=' + id;
}

function idYoutube_(url) {
  if (typeof url !== 'string' || url.length > 300) return null;
  var m = url.trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/);
  return m ? m[1] : null;
}

// ---------- plano e permissões ----------

/** Plano que vale nesta chamada: no "ver como aluno grátis" o admin vê os limites do grátis. */
function planoEfetivo_(ctx) {
  if (ctx.verComo === 'aluno_gratis') return { tipo: 'gratis' };
  if (ctx.verComo) return { tipo: 'premium' };
  return planoAtual_(ctx.usuario);
}

function limites_(ctx) {
  var gratis = planoEfetivo_(ctx).tipo !== 'premium';
  return {
    plano: gratis ? 'gratis' : 'premium',
    fichas_ativas: gratis ? APP.LIMITE_FICHAS_GRATIS : null,
    dias_grafico: gratis ? APP.DIAS_GRAFICO_GRATIS : null,
    exportar: !gratis
  };
}

/**
 * Quem altera uma ficha:
 * - o personal que a prescreveu, enquanto o vínculo com o aluno estiver ativo;
 * - o aluno, se a ficha é dele e foi ele quem fez, ou se o vínculo com quem prescreveu já acabou.
 * Enquanto o vínculo existe, a ficha prescrita só muda pelo personal; o aluno sobe carga e repetições pelo treino.
 */
function podeEditarFicha_(ficha, u) {
  if (ficha.autor_id === u.id && ficha.aluno_id !== u.id) return vinculoAtivo_(u.id, ficha.aluno_id);
  if (ficha.aluno_id !== u.id) return false;
  return ficha.autor_id === u.id || !ficha.autor_id || !vinculoAtivo_(ficha.autor_id, u.id);
}

/**
 * Exercícios que a pessoa pode ver e usar: os do catálogo geral, os que ela criou
 * e os que aparecem nas fichas dela (um exercício próprio do personal numa ficha prescrita).
 */
function exerciciosVisiveis_(u, todos) {
  var nasFichas = {};
  var minhas = {};
  buscar_('fichas', { aluno_id: u.id }).forEach(function (f) { minhas[f.id] = true; });
  lerTodos_('ficha_itens').forEach(function (i) { if (minhas[i.ficha_id]) nasFichas[i.exercicio_id] = true; });
  var vis = {};
  (todos || lerTodos_('exercicios', true)).forEach(function (e) {
    if (e.excluido_em && !nasFichas[e.id]) return;
    if (e.global || e.criado_por === u.id || nasFichas[e.id]) vis[e.id] = e;
  });
  return vis;
}

function exercicioVisivel_(ex, u) {
  return ex.global || ex.criado_por === u.id;
}

// ---------- exercícios ----------

function listarExercicios_(d, ctx) {
  var vis = exerciciosVisiveis_(ctx.usuario);
  return Object.keys(vis).map(function (k) { return publico_(vis[k], []); })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function criarExercicio_(d, ctx) {
  var u = ctx.usuario;
  var nome = texto_(d.nome, 'nome', 2, 80, true);
  var reg = {
    id: d.id ? id_(d.id) : novoId_(),
    nome: nome,
    grupo_muscular: texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false),
    equipamento: texto_(d.equipamento, 'equipamento', 0, 40, false),
    video_url: videoYoutube_(d.video_url),
    secundarios: texto_(d.secundarios, 'músculos secundários', 0, 120, false),
    mecanica: opcao_(d.mecanica || '', 'tipo de movimento', ['', 'composto', 'isolado', 'cardio']),
    criado_por: u.id,
    global: !!u.admin && d.global !== false
  };
  return comBloqueio_(function () {
    var chave = normalizarNome_(nome);
    var igual = lerTodos_('exercicios').filter(function (e) {
      return exercicioVisivel_(e, u) && normalizarNome_(e.nome) === chave;
    })[0];
    if (igual) throw erro_('DUPLICADO', 'Já existe o exercício "' + igual.nome + '".');
    if (buscarUm_('exercicios', { id: reg.id }, true)) throw erro_('DUPLICADO', 'Identificador já usado.');
    return publico_(inserirSemBloqueio_('exercicios', reg), []);
  });
}

function atualizarExercicio_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.id);
  return comBloqueio_(function () {
    var ex = buscarUm_('exercicios', { id: id });
    if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
    var pode = ex.global ? !!u.admin : ex.criado_por === u.id;
    if (!pode) throw erro_('PROIBIDO', 'Só quem criou pode alterar este exercício.');
    var campos = {};
    if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
    if (d.grupo_muscular !== undefined) campos.grupo_muscular = texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false);
    if (d.equipamento !== undefined) campos.equipamento = texto_(d.equipamento, 'equipamento', 0, 40, false);
    if (d.video_url !== undefined) campos.video_url = videoYoutube_(d.video_url);
    if (d.secundarios !== undefined) campos.secundarios = texto_(d.secundarios, 'músculos secundários', 0, 120, false);
    if (d.mecanica !== undefined) campos.mecanica = opcao_(d.mecanica || '', 'tipo de movimento', ['', 'composto', 'isolado', 'cardio']);
    return publico_(atualizarSemBloqueio_('exercicios', id, campos), []);
  });
}

function normalizarNome_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- fichas ----------

function listarFichas_(d, ctx) {
  var r = fichasDe_(ctx.usuario.id, ctx.usuario, limites_(ctx));
  r.config = { incremento_padrao_kg: Number(config_('incremento_padrao_kg', APP.INCREMENTO_PADRAO_KG)) };
  return r;
}

/**
 * No plano grátis valem as N primeiras fichas ativas (pela ordem). Se o premium acabou com mais
 * fichas ativas, as outras ficam bloqueadas: dá para ver e arquivar, não para treinar nem alterar.
 */
function fichasLiberadas_(fichas, limite) {
  var ok = {};
  fichas.filter(function (f) { return f.ativa && !f.excluido_em; })
    .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0) || (a.criado_em < b.criado_em ? -1 : 1); })
    .slice(0, limite)
    .forEach(function (f) { ok[f.id] = true; });
  return ok;
}

function dentroDoLimite_(fichas, fichaId, limite) {
  return !!fichasLiberadas_(fichas, limite)[fichaId];
}

/** Fichas de um aluno com os itens, quem prescreveu e se quem pede pode alterar. */
function fichasDe_(alunoId, quem, limites) {
  var u = quem;
  var fichas = buscar_('fichas', { aluno_id: alunoId });
  var liberadas = limites.fichas_ativas !== null ? fichasLiberadas_(fichas, limites.fichas_ativas) : {};
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var ids = {};
  fichas.forEach(function (f) { ids[f.id] = true; });
  var itens = lerTodos_('ficha_itens').filter(function (i) { return ids[i.ficha_id]; });
  return {
    limites: limites,
    fichas: fichas
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); })
      .map(function (f) {
        var r = publico_(f, []);
        r.prescrita = !!f.autor_id && f.autor_id !== f.aluno_id;
        r.autor_nome = r.prescrita ? nomes[f.autor_id] || '' : '';
        r.pode_editar = podeEditarFicha_(f, u);
        r.bloqueada = limites.fichas_ativas !== null && f.ativa && !liberadas[f.id];
        r.itens = itens
          .filter(function (i) { return i.ficha_id === f.id; })
          .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); })
          .map(function (i) { return publico_(i, []); });
        return r;
      })
  };
}

function validarItem_(i, fichaId, ordem) {
  return {
    id: id_(i.id, 'item'),
    ficha_id: fichaId,
    exercicio_id: id_(i.exercicio_id, 'exercício'),
    ordem: ordem,
    series: numero_(i.series, 'séries', 1, 20, false),
    reps_prescritas: texto_(i.reps_prescritas, 'repetições', 0, 40, false),
    reps_min: numero_(i.reps_min, 'repetições mínimas', 0, 200, true),
    reps_max: numero_(i.reps_max, 'repetições máximas', 0, 200, true),
    carga_prescrita_kg: numero_(i.carga_prescrita_kg, 'carga', 0, 1000, true),
    aumento_max_kg: numero_(i.aumento_max_kg, 'aumento máximo', 0, 100, true),
    carga_atual_kg: numero_(i.carga_atual_kg, 'carga atual', 0, 1000, true),
    reps_atuais: texto_(i.reps_atuais, 'repetições atuais', 0, 40, false),
    descanso_seg: numero_(i.descanso_seg, 'descanso', 0, 1800, true),
    metodo: opcao_(i.metodo || '', 'método', APP.METODOS),
    observacoes: texto_(i.observacoes, 'observações', 0, 500, false),
    sugestao: opcao_(i.sugestao || '', 'sugestão de carga', ['', 'desligada']),
    incremento_kg: numero_(i.incremento_kg, 'incremento', 0.25, 20, true)
  };
}

/**
 * Cria ou altera uma ficha com todos os seus itens.
 * dados: { ficha: { id, nome, ordem, ativa }, itens: [ ... ] }
 * Itens que não vierem na lista são removidos da ficha (exclusão lógica).
 */
function salvarFicha_(d, ctx) {
  return salvarFichaPara_(ctx.usuario, ctx.usuario, d, limites_(ctx));
}

/** u = quem salva; aluno = dono da ficha (o próprio u, ou um aluno do personal). */
function salvarFichaPara_(u, aluno, d, lim) {
  var f = d.ficha && typeof d.ficha === 'object' ? d.ficha : {};
  var fichaId = id_(f.id, 'ficha');
  var nome = texto_(f.nome, 'nome da ficha', 1, 60, true);
  var ativa = f.ativa !== false;
  var ordem = numero_(f.ordem, 'ordem', 0, 999, true) || 0;
  var itens = lista_(d.itens, 'itens', 60).map(function (i, n) { return validarItem_(i, fichaId, n + 1); });

  return comBloqueio_(function () {
    if (u.id !== aluno.id && !vinculoAtivo_(u.id, aluno.id)) throw erro_('PROIBIDO', 'Esta pessoa não é sua aluna.');
    var todas = buscar_('fichas', { aluno_id: aluno.id });
    var atual = buscarUm_('fichas', { id: fichaId }, true);
    if (atual && (atual.excluido_em || atual.aluno_id !== aluno.id)) throw erro_('PROIBIDO', 'Ficha de outra pessoa.');
    if (atual && !podeEditarFicha_(atual, u)) {
      throw erro_('PROIBIDO', atual.aluno_id === u.id ? 'Esta ficha foi prescrita pelo seu personal. Peça a ele para alterar.' : 'Ficha de outra pessoa.');
    }
    if (ativa && lim.fichas_ativas !== null && !dentroDoLimite_(todas, fichaId, lim.fichas_ativas)) {
      var outrasAtivas = todas.filter(function (x) { return x.ativa && x.id !== fichaId; }).length;
      if (outrasAtivas >= lim.fichas_ativas) {
        throw erro_('LIMITE_PLANO', u.id === aluno.id
          ? 'No plano grátis você pode ter até ' + lim.fichas_ativas + ' fichas ativas. Arquive uma ou assine o premium.'
          : 'Este aluno está no plano grátis: até ' + lim.fichas_ativas + ' fichas ativas. Arquive uma antes.');
      }
    }
    var visiveis = exerciciosVisiveis_(u);
    var doAluno = exerciciosVisiveis_(aluno);
    itens.forEach(function (i) {
      if (!visiveis[i.exercicio_id] && !doAluno[i.exercicio_id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
    });

    var ficha = atual
      ? atualizarSemBloqueio_('fichas', fichaId, { nome: nome, ativa: ativa, ordem: ordem })
      : inserirSemBloqueio_('fichas', { id: fichaId, aluno_id: aluno.id, autor_id: u.id, nome: nome, ordem: ordem, ativa: ativa });

    var existentes = lerTodos_('ficha_itens', true);
    var porId = {};
    existentes.forEach(function (i) { porId[i.id] = i; });
    itens.forEach(function (i) {
      var e = porId[i.id];
      if (e && e.ficha_id !== fichaId) throw erro_('PROIBIDO', 'Item de outra ficha.');
      i.excluido_em = null;
    });
    var mantidos = {};
    itens.forEach(function (i) { mantidos[i.id] = true; });
    var t = agora_();
    var removidos = existentes
      .filter(function (i) { return i.ficha_id === fichaId && !i.excluido_em && !mantidos[i.id]; })
      .map(function (i) { return { id: i.id, excluido_em: t }; });
    upsertLoteSemBloqueio_('ficha_itens', itens.concat(removidos));
    return { ficha: publico_(ficha, []), itens: itens.length, removidos: removidos.length };
  });
}

function excluirFicha_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.id, 'ficha');
  return comBloqueio_(function () {
    var f = buscarUm_('fichas', { id: id });
    if (!f || (f.aluno_id !== u.id && f.autor_id !== u.id)) throw erro_('NAO_ENCONTRADO', 'Ficha não encontrada.');
    if (!podeEditarFicha_(f, u)) throw erro_('PROIBIDO', 'Esta ficha foi prescrita pelo seu personal. Peça a ele para alterar.');
    atualizarSemBloqueio_('fichas', id, { excluido_em: agora_(), ativa: false });
    return { excluida: id };
  });
}

// ---------- treinos (sincronização do aparelho) ----------

/**
 * Recebe o que foi feito no aparelho, de uma vez:
 *   { sessoes: [...], series: [...], ajustes: [...] }
 * Pode ser enviado de novo sem duplicar nada (os ids vêm do aparelho).
 * Ajuste = o aluno decidiu subir a carga ou as repetições de um exercício da ficha.
 */
function sincronizarTreino_(d, ctx) {
  var u = ctx.usuario;
  var sessoes = lista_(d.sessoes, 'sessões', APP.MAX_LOTE_SESSOES).map(function (s) {
    var r = {
      id: id_(s.id, 'sessão'),
      ficha_id: idOpcional_(s.ficha_id, 'ficha'),
      inicio: dataIso_(s.inicio, 'início'),
      fim: dataIso_(s.fim, 'fim', true),
      observacao: texto_(s.observacao, 'observação', 0, 500, false)
    };
    if (s.excluido) r.excluido_em = agora_();
    return r;
  });
  var series = lista_(d.series, 'séries', APP.MAX_LOTE_SERIES).map(function (s) {
    var r = {
      id: id_(s.id, 'série'),
      sessao_id: id_(s.sessao_id, 'sessão'),
      exercicio_id: id_(s.exercicio_id, 'exercício'),
      ordem: numero_(s.ordem, 'ordem', 0, 999, false),
      tipo: opcao_(s.tipo || 'normal', 'tipo de série', APP.TIPOS_SERIE),
      reps: numero_(s.reps, 'repetições', 0, 500, true),
      carga_kg: numero_(s.carga_kg, 'carga', 0, 1000, true),
      rpe: numero_(s.rpe, 'esforço', 0, 10, true)
    };
    r.excluido_em = s.excluido ? agora_() : null;
    return r;
  });
  var ajustes = lista_(d.ajustes, 'ajustes', 500).map(function (a) {
    var campo = opcao_(a.campo, 'campo do ajuste', ['carga_atual_kg', 'reps_atuais']);
    return {
      id: id_(a.id, 'ajuste'),
      ficha_item_id: id_(a.ficha_item_id, 'item'),
      campo: campo,
      valor_novo: campo === 'carga_atual_kg'
        ? numero_(a.valor_novo, 'nova carga', 0, 1000, false)
        : texto_(String(a.valor_novo == null ? '' : a.valor_novo), 'novas repetições', 1, 40, true)
    };
  });

  return comBloqueio_(function () {
    // sessões: só do próprio aluno; ficha (se houver) precisa ser dele
    var minhasFichas = {};
    buscar_('fichas', { aluno_id: u.id }, true).forEach(function (f) { minhasFichas[f.id] = true; });
    sessoes.forEach(function (s) {
      if (s.ficha_id && !minhasFichas[s.ficha_id]) throw erro_('PROIBIDO', 'Ficha de outra pessoa.');
    });
    var rSess = upsertLoteSemBloqueio_('sessoes', sessoes, {
      fixos: { aluno_id: u.id },
      podeAlterar: function (atual) { return atual.aluno_id === u.id; }
    });

    // séries: a sessão precisa ser do aluno (já gravada ou chegando agora)
    var minhasSessoes = {};
    buscar_('sessoes', { aluno_id: u.id }, true).forEach(function (s) { minhasSessoes[s.id] = true; });
    var visiveis = exerciciosVisiveis_(u);
    series.forEach(function (s) {
      if (!minhasSessoes[s.sessao_id]) throw erro_('PROIBIDO', 'Sessão de outra pessoa.');
      if (!visiveis[s.exercicio_id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
    });
    var rSer = upsertLoteSemBloqueio_('series', series, {
      podeAlterar: function (atual) { return !!minhasSessoes[atual.sessao_id]; }
    });

    // ajustes: aplicados na ficha; cada ajuste só vale uma vez
    var rAj = { criados: 0, ignorados: 0 };
    if (ajustes.length) {
      var jaFeitos = {};
      lerTodos_('ajustes', true).forEach(function (a) { jaFeitos[a.id] = a; });
      var itens = {};
      lerTodos_('ficha_itens', true).forEach(function (i) { itens[i.id] = i; });
      var novosAjustes = [];
      var mudancas = {};
      ajustes.forEach(function (a) {
        if (jaFeitos[a.id]) {
          if (jaFeitos[a.id].aluno_id !== u.id) throw erro_('PROIBIDO', 'Ajuste de outra pessoa.');
          rAj.ignorados++;
          return;
        }
        var item = itens[a.ficha_item_id];
        if (!item || !minhasFichas[item.ficha_id]) throw erro_('PROIBIDO', 'Exercício de outra ficha.');
        var atual = mudancas[item.id] || { id: item.id };
        var anterior = atual[a.campo] !== undefined ? atual[a.campo] : item[a.campo];
        atual[a.campo] = a.valor_novo;
        mudancas[item.id] = atual;
        novosAjustes.push({
          id: a.id, ficha_item_id: item.id, aluno_id: u.id, campo: a.campo,
          valor_anterior: anterior === null || anterior === undefined ? '' : String(anterior),
          valor_novo: String(a.valor_novo), visto_pelo_personal: false
        });
      });
      upsertLoteSemBloqueio_('ajustes', novosAjustes);
      upsertLoteSemBloqueio_('ficha_itens', Object.keys(mudancas).map(function (k) { return mudancas[k]; }));
      rAj.criados = novosAjustes.length;
    }
    return { sessoes: rSess, series: rSer, ajustes: rAj, servidor_em: agora_() };
  });
}

// ---------- histórico ----------

/**
 * Sessões do aluno com as séries de cada uma.
 * dados.desde (opcional, ISO): só o que mudou depois dessa hora, para o app atualizar o que já tem.
 * O histórico completo aparece nos dois planos; exportar é só no premium (rota própria, fase 3).
 */
function listarHistorico_(d, ctx) {
  var h = historicoDe_(ctx.usuario.id, dataIso_(d.desde, 'desde', true));
  h.limites = limites_(ctx);
  return h;
}

function historicoDe_(alunoId, desde) {
  var sessoes = buscar_('sessoes', { aluno_id: alunoId }, !!desde);
  var ids = {};
  sessoes.forEach(function (s) { ids[s.id] = true; });
  var series = lerTodos_('series', !!desde).filter(function (s) { return ids[s.sessao_id]; });
  if (desde) {
    sessoes = sessoes.filter(function (s) { return s.atualizado_em > desde; });
    series = series.filter(function (s) { return s.atualizado_em > desde; });
  }
  return {
    servidor_em: agora_(),
    sessoes: sessoes.map(function (s) { return publico_(s, []); }).sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }),
    series: series.map(function (s) { return publico_(s, []); })
  };
}
