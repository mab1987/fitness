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

/** O aluno dono da ficha e quem a escreveu (o personal, na fase 2) podem alterá-la. */
function podeEditarFicha_(ficha, u) {
  return ficha.aluno_id === u.id || ficha.autor_id === u.id;
}

function exercicioVisivel_(ex, u) {
  return ex.global || ex.criado_por === u.id;
}

// ---------- exercícios ----------

function listarExercicios_(d, ctx) {
  var u = ctx.usuario;
  return lerTodos_('exercicios')
    .filter(function (e) { return exercicioVisivel_(e, u); })
    .map(function (e) { return publico_(e, []); })
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
    return publico_(atualizarSemBloqueio_('exercicios', id, campos), []);
  });
}

function normalizarNome_(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- fichas ----------

function listarFichas_(d, ctx) {
  var u = ctx.usuario;
  var fichas = buscar_('fichas', { aluno_id: u.id });
  var ids = {};
  fichas.forEach(function (f) { ids[f.id] = true; });
  var itens = lerTodos_('ficha_itens').filter(function (i) { return ids[i.ficha_id]; });
  return {
    limites: limites_(ctx),
    fichas: fichas
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); })
      .map(function (f) {
        var r = publico_(f, []);
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
    observacoes: texto_(i.observacoes, 'observações', 0, 500, false)
  };
}

/**
 * Cria ou altera uma ficha com todos os seus itens.
 * dados: { ficha: { id, nome, ordem, ativa }, itens: [ ... ] }
 * Itens que não vierem na lista são removidos da ficha (exclusão lógica).
 */
function salvarFicha_(d, ctx) {
  var u = ctx.usuario;
  var f = d.ficha && typeof d.ficha === 'object' ? d.ficha : {};
  var fichaId = id_(f.id, 'ficha');
  var nome = texto_(f.nome, 'nome da ficha', 1, 60, true);
  var ativa = f.ativa !== false;
  var ordem = numero_(f.ordem, 'ordem', 0, 999, true) || 0;
  var itens = lista_(d.itens, 'itens', 60).map(function (i, n) { return validarItem_(i, fichaId, n + 1); });
  var lim = limites_(ctx);

  return comBloqueio_(function () {
    var todas = buscar_('fichas', { aluno_id: u.id });
    var atual = buscarUm_('fichas', { id: fichaId }, true);
    if (atual && (atual.excluido_em || !podeEditarFicha_(atual, u))) throw erro_('PROIBIDO', 'Ficha de outra pessoa.');
    if (ativa && lim.fichas_ativas !== null) {
      var outrasAtivas = todas.filter(function (x) { return x.ativa && x.id !== fichaId; }).length;
      if (outrasAtivas >= lim.fichas_ativas) {
        throw erro_('LIMITE_PLANO', 'No plano grátis você pode ter até ' + lim.fichas_ativas + ' fichas ativas. Arquive uma ou assine o premium.');
      }
    }
    var visiveis = {};
    lerTodos_('exercicios').forEach(function (e) { if (exercicioVisivel_(e, u)) visiveis[e.id] = true; });
    itens.forEach(function (i) {
      if (!visiveis[i.exercicio_id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
    });

    var ficha = atual
      ? atualizarSemBloqueio_('fichas', fichaId, { nome: nome, ativa: ativa, ordem: ordem })
      : inserirSemBloqueio_('fichas', { id: fichaId, aluno_id: u.id, autor_id: u.id, nome: nome, ordem: ordem, ativa: ativa });

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
    if (!f || !podeEditarFicha_(f, u)) throw erro_('NAO_ENCONTRADO', 'Ficha não encontrada.');
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
    var visiveis = {};
    lerTodos_('exercicios', true).forEach(function (e) { if (exercicioVisivel_(e, u)) visiveis[e.id] = true; });
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
  var u = ctx.usuario;
  var desde = dataIso_(d.desde, 'desde', true);
  var sessoes = buscar_('sessoes', { aluno_id: u.id }, !!desde);
  var ids = {};
  sessoes.forEach(function (s) { ids[s.id] = true; });
  var series = lerTodos_('series', !!desde).filter(function (s) { return ids[s.sessao_id]; });
  if (desde) {
    sessoes = sessoes.filter(function (s) { return s.atualizado_em > desde; });
    series = series.filter(function (s) { return s.atualizado_em > desde; });
  }
  return {
    limites: limites_(ctx),
    servidor_em: agora_(),
    sessoes: sessoes.map(function (s) { return publico_(s, []); }).sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; }),
    series: series.map(function (s) { return publico_(s, []); })
  };
}
