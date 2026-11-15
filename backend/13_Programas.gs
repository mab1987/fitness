/**
 * Fase 3: programas prontos, medidas corporais e exportação.
 *
 * Programa = conjunto de fichas modelo. Quem publica:
 *   administrador → para todos (marcando quais são grátis);
 *   gerente → para o próprio grupo;
 *   personal → programa privado, que ele aplica nos alunos.
 * "Usar" um programa copia as fichas para a conta do aluno.
 */
var NIVEIS_ = ['', 'iniciante', 'intermediario', 'avancado'];

function meusGrupos_(u) {
  var m = {};
  buscar_('membros_grupo', { usuario_id: u.id }).forEach(function (x) { m[x.grupo_id] = x.papel; });
  return m;
}

function programaComFichas_(p, comItens) {
  var r = publico_(p, []);
  var fichas = buscar_('programa_fichas', { programa_id: p.id }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
  var itens = comItens ? lerTodos_('programa_itens') : [];
  r.fichas = fichas.map(function (f) {
    var x = publico_(f, []);
    if (comItens) x.itens = itens.filter(function (i) { return i.programa_ficha_id === f.id; }).sort(function (a, b) { return a.ordem - b.ordem; }).map(function (i) { return publico_(i, []); });
    return x;
  });
  return r;
}

/** Programas que a pessoa pode usar. No grátis, os premium aparecem com cadeado (sem os exercícios). */
function listarProgramas_(d, ctx) {
  var u = ctx.usuario;
  var premium = planoEfetivo_(ctx).tipo === 'premium';
  var grupos = meusGrupos_(u);
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  return lerTodos_('programas')
    .filter(function (p) {
      if (!p.publicado) return false;
      return p.publico === 'todos' || (p.publico === 'grupo' && grupos[p.grupo_id]);
    })
    .map(function (p) {
      var livre = premium || p.gratis;
      var r = programaComFichas_(p, livre);
      r.bloqueado = !livre;
      r.autor_nome = nomes[p.autor_id] || '';
      return r;
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Programas que a pessoa escreveu (o administrador vê todos). */
function programasAutor_(d, ctx) {
  var u = ctx.usuario;
  return lerTodos_('programas')
    .filter(function (p) { return u.admin || p.autor_id === u.id; })
    .map(function (p) { return programaComFichas_(p, true); })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function salvarPrograma_(d, ctx) {
  var u = ctx.usuario;
  var p = d.programa && typeof d.programa === 'object' ? d.programa : {};
  var reg = {
    id: id_(p.id, 'programa'),
    nome: texto_(p.nome, 'nome do programa', 2, 80, true),
    descricao: texto_(p.descricao, 'descrição', 0, 1000, false),
    objetivo: texto_(p.objetivo, 'objetivo', 0, 60, false),
    nivel: opcao_(p.nivel || '', 'nível', NIVEIS_),
    dias_semana: numero_(p.dias_semana, 'dias por semana', 1, 7, true),
    semanas: numero_(p.semanas, 'semanas', 1, 52, true),
    publico: opcao_(p.publico || 'privado', 'quem vê', ['todos', 'grupo', 'privado']),
    grupo_id: p.publico === 'grupo' ? id_(p.grupo_id, 'grupo') : '',
    gratis: p.gratis === true,
    publicado: p.publicado !== false
  };
  if (reg.publico === 'todos' && !u.admin) throw erro_('PROIBIDO', 'Só o administrador publica para todos.');
  if (reg.publico === 'grupo') exigirGerenteDoGrupo_(ctx, reg.grupo_id);
  if (reg.publico === 'privado' && !u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Só personal cria programas para os alunos.');
  if (reg.publico !== 'todos') reg.gratis = true; // grupo e personal: quem recebe usa, qualquer plano

  var fichas = lista_(d.fichas, 'fichas', 14).map(function (f, n) {
    var fid = id_(f.id, 'ficha');
    return {
      ficha: { id: fid, programa_id: reg.id, nome: texto_(f.nome, 'nome da ficha', 1, 60, true), ordem: n + 1 },
      itens: lista_(f.itens, 'itens', 40).map(function (i, k) {
        return {
          id: id_(i.id, 'item'), programa_ficha_id: fid, exercicio_id: id_(i.exercicio_id, 'exercício'), ordem: k + 1,
          series: numero_(i.series, 'séries', 1, 20, false),
          reps_prescritas: texto_(i.reps_prescritas, 'repetições', 0, 40, false),
          descanso_seg: numero_(i.descanso_seg, 'descanso', 0, 1800, true),
          metodo: opcao_(i.metodo || '', 'método', APP.METODOS),
          observacoes: texto_(i.observacoes, 'observações', 0, 500, false)
        };
      })
    };
  });
  if (!fichas.length) throw erro_('VALIDACAO', 'Um programa precisa de pelo menos uma ficha.');

  return comBloqueio_(function () {
    var atual = buscarUm_('programas', { id: reg.id }, true);
    if (atual && (atual.excluido_em || (atual.autor_id !== u.id && !u.admin))) throw erro_('PROIBIDO', 'Programa de outra pessoa.');
    // Para todos ou para um grupo, só exercícios do catálogo geral (quem recebe precisa enxergar).
    var exercicios = {};
    lerTodos_('exercicios').forEach(function (e) { exercicios[e.id] = e; });
    var vis = exerciciosVisiveis_(u);
    fichas.forEach(function (f) {
      f.itens.forEach(function (i) {
        var e = exercicios[i.exercicio_id];
        if (!e || !vis[e.id]) throw erro_('VALIDACAO', 'Exercício não encontrado no catálogo.');
        if (reg.publico !== 'privado' && !e.global) throw erro_('VALIDACAO', '"' + e.nome + '" é um exercício próprio. Para publicar, use exercícios do catálogo geral (ou proponha este ao administrador).');
      });
    });
    reg.autor_id = atual ? atual.autor_id : u.id;
    upsertLoteSemBloqueio_('programas', [reg]);
    // substitui fichas e itens
    var t = agora_();
    var velhasFichas = buscar_('programa_fichas', { programa_id: reg.id });
    var idsVelhas = {};
    velhasFichas.forEach(function (f) { idsVelhas[f.id] = true; });
    var mantidas = {};
    fichas.forEach(function (f) { mantidas[f.ficha.id] = true; });
    var outros = lerTodos_('programa_fichas', true).filter(function (f) { return mantidas[f.id] && f.programa_id !== reg.id; });
    if (outros.length) throw erro_('PROIBIDO', 'Identificador de ficha já usado.');
    upsertLoteSemBloqueio_('programa_fichas', fichas.map(function (f) { return Object.assign({}, f.ficha, { excluido_em: null }); })
      .concat(velhasFichas.filter(function (f) { return !mantidas[f.id]; }).map(function (f) { return { id: f.id, excluido_em: t }; })));
    var novosItens = [];
    fichas.forEach(function (f) { f.itens.forEach(function (i) { novosItens.push(Object.assign({}, i, { excluido_em: null })); }); });
    var manterItem = {};
    novosItens.forEach(function (i) { manterItem[i.id] = true; });
    var velhosItens = lerTodos_('programa_itens').filter(function (i) { return (idsVelhas[i.programa_ficha_id] || mantidas[i.programa_ficha_id]) && !manterItem[i.id]; });
    upsertLoteSemBloqueio_('programa_itens', novosItens.concat(velhosItens.map(function (i) { return { id: i.id, excluido_em: t }; })));
    return programaComFichas_(buscarUm_('programas', { id: reg.id }), true);
  });
}

function excluirPrograma_(d, ctx) {
  var id = id_(d.id, 'programa');
  return comBloqueio_(function () {
    var p = buscarUm_('programas', { id: id });
    if (!p || (p.autor_id !== ctx.usuario.id && !ctx.usuario.admin)) throw erro_('NAO_ENCONTRADO', 'Programa não encontrado.');
    atualizarSemBloqueio_('programas', id, { excluido_em: agora_(), publicado: false });
    return { excluido: id };
  });
}

/**
 * Copia as fichas do programa para um aluno.
 * dados: { id, aluno_id? } — sem aluno_id, para a própria conta; com aluno_id, o personal aplica no aluno.
 * No plano grátis, entram ativas só até o limite; as demais ficam arquivadas.
 */
function usarPrograma_(d, ctx) {
  var u = ctx.usuario;
  var p = buscarUm_('programas', { id: id_(d.id, 'programa') });
  if (!p) throw erro_('NAO_ENCONTRADO', 'Programa não encontrado.');
  var aluno = u;
  var lim;
  if (d.aluno_id) {
    aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
    if (p.autor_id !== u.id && !(p.publicado && (p.publico === 'todos' || (p.publico === 'grupo' && meusGrupos_(u)[p.grupo_id])))) throw erro_('PROIBIDO', 'Programa não disponível.');
    lim = limitesDoAluno_(aluno);
  } else {
    var disp = p.publicado && (p.publico === 'todos' || (p.publico === 'grupo' && meusGrupos_(u)[p.grupo_id]));
    if (!disp && p.autor_id !== u.id) throw erro_('PROIBIDO', 'Programa não disponível.');
    lim = limites_(ctx);
    if (!p.gratis && lim.plano !== 'premium') throw erro_('LIMITE_PLANO', 'Este programa é do plano premium.');
  }
  var completo = programaComFichas_(p, true);
  return comBloqueio_(function () {
    var ativas = buscar_('fichas', { aluno_id: aluno.id }).filter(function (f) { return f.ativa; }).length;
    var ordemBase = buscar_('fichas', { aluno_id: aluno.id }).reduce(function (m, f) { return Math.max(m, f.ordem || 0); }, 0);
    var fichas = [];
    var itens = [];
    var arquivadas = 0;
    completo.fichas.forEach(function (f, n) {
      var ativa = lim.fichas_ativas === null || ativas < lim.fichas_ativas;
      if (ativa) ativas++; else arquivadas++;
      var fid = novoId_();
      fichas.push({ id: fid, aluno_id: aluno.id, autor_id: u.id, nome: f.nome, ordem: ordemBase + n + 1, ativa: ativa });
      f.itens.forEach(function (i) {
        itens.push({
          id: novoId_(), ficha_id: fid, exercicio_id: i.exercicio_id, ordem: i.ordem, series: i.series,
          reps_prescritas: i.reps_prescritas, reps_min: null, reps_max: null, carga_prescrita_kg: null, aumento_max_kg: null,
          carga_atual_kg: null, reps_atuais: '', descanso_seg: i.descanso_seg, metodo: i.metodo, observacoes: i.observacoes, sugestao: '', incremento_kg: null
        });
      });
    });
    upsertLoteSemBloqueio_('fichas', fichas);
    upsertLoteSemBloqueio_('ficha_itens', itens);
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'programa.usar', alvo: p.id, detalhes: aluno.id });
    return { fichas: fichas.length, arquivadas: arquivadas };
  });
}

// ---------- medidas corporais ----------

var CAMPOS_MEDIDA_ = ['peso_kg', 'gordura_pct', 'peito_cm', 'cintura_cm', 'abdomen_cm', 'quadril_cm', 'braco_d_cm', 'braco_e_cm', 'coxa_d_cm', 'coxa_e_cm', 'panturrilha_cm'];
var FAIXAS_MEDIDA_ = { peso_kg: [20, 400], gordura_pct: [2, 70] };

function alvoDasMedidas_(d, ctx) {
  if (d.aluno_id && d.aluno_id !== ctx.usuario.id) return exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return ctx.usuario;
}

function listarMedidas_(d, ctx) {
  var aluno = alvoDasMedidas_(d, ctx);
  return buscar_('medidas', { aluno_id: aluno.id })
    .map(function (m) { return publico_(m, []); })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
}

/** No grátis, só o peso; no premium, todas as medidas. Vale o plano do aluno, mesmo quando o personal registra. */
function salvarMedida_(d, ctx) {
  var aluno = alvoDasMedidas_(d, ctx);
  var m = d.medida && typeof d.medida === 'object' ? d.medida : {};
  var premium = aluno.id === ctx.usuario.id ? limites_(ctx).plano === 'premium' : limitesDoAluno_(aluno).plano === 'premium';
  var reg = { id: id_(m.id, 'medida'), aluno_id: aluno.id, autor_id: ctx.usuario.id, data: dataIso_(m.data, 'data'), observacao: texto_(m.observacao, 'observação', 0, 300, false) };
  var algum = false;
  CAMPOS_MEDIDA_.forEach(function (c) {
    var f = FAIXAS_MEDIDA_[c] || [5, 300];
    var v = numero_(m[c], c.replace(/_/g, ' '), f[0], f[1], true);
    if (v !== null && c !== 'peso_kg' && !premium) throw erro_('LIMITE_PLANO', 'No plano grátis dá para registrar o peso. As outras medidas são do premium.');
    reg[c] = v;
    if (v !== null) algum = true;
  });
  if (!algum) throw erro_('VALIDACAO', 'Preencha pelo menos uma medida.');
  return comBloqueio_(function () {
    var atual = buscarUm_('medidas', { id: reg.id }, true);
    if (atual && atual.aluno_id !== aluno.id) throw erro_('PROIBIDO', 'Registro de outra pessoa.');
    upsertLoteSemBloqueio_('medidas', [reg]);
    return publico_(buscarUm_('medidas', { id: reg.id }), []);
  });
}

function excluirMedida_(d, ctx) {
  var id = id_(d.id, 'medida');
  return comBloqueio_(function () {
    var m = buscarUm_('medidas', { id: id });
    if (!m) throw erro_('NAO_ENCONTRADO', 'Registro não encontrado.');
    if (m.aluno_id !== ctx.usuario.id && !(m.autor_id === ctx.usuario.id && vinculoAtivo_(ctx.usuario.id, m.aluno_id))) throw erro_('PROIBIDO', 'Sem permissão.');
    atualizarSemBloqueio_('medidas', id, { excluido_em: agora_() });
    return { excluida: id };
  });
}

// ---------- exportação ----------

/**
 * Dados para o app montar as planilhas (CSV). Premium exporta os próprios; o personal, os dos alunos.
 * O app neutraliza fórmulas nas células antes de salvar o arquivo.
 */
function exportarDados_(d, ctx) {
  var aluno;
  if (d.aluno_id && d.aluno_id !== ctx.usuario.id) {
    aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  } else {
    aluno = ctx.usuario;
    if (limites_(ctx).plano !== 'premium') throw erro_('LIMITE_PLANO', 'Exportar é do plano premium. Para uma cópia dos seus dados, fale com o administrador.');
  }
  var h = historicoDe_(aluno.id, null);
  var ex = {};
  lerTodos_('exercicios', true).forEach(function (e) { ex[e.id] = e; });
  var fichas = {};
  buscar_('fichas', { aluno_id: aluno.id }, true).forEach(function (f) { fichas[f.id] = f.nome; });
  var sessoes = {};
  h.sessoes.forEach(function (s) { sessoes[s.id] = s; });
  var series = h.series.map(function (s) {
    var se = sessoes[s.sessao_id] || {};
    var e = ex[s.exercicio_id] || {};
    return [se.inicio || '', fichas[se.ficha_id] || '', e.nome || '', e.grupo_muscular || '', s.ordem, s.carga_kg, s.reps, s.rpe, s.tipo];
  }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[4] - b[4]; });
  return {
    aluno: aluno.nome,
    series: { colunas: ['data_hora', 'ficha', 'exercicio', 'grupo_muscular', 'ordem', 'carga_kg', 'repeticoes', 'rpe', 'tipo'], linhas: series },
    treinos: { colunas: ['inicio', 'fim', 'ficha', 'observacao'], linhas: h.sessoes.map(function (s) { return [s.inicio, s.fim, fichas[s.ficha_id] || '', s.observacao || '']; }) },
    medidas: { colunas: ['data'].concat(CAMPOS_MEDIDA_).concat(['observacao']), linhas: buscar_('medidas', { aluno_id: aluno.id }).map(function (m) { return [m.data].concat(CAMPOS_MEDIDA_.map(function (c) { return m[c]; })).concat([m.observacao || '']); }) }
  };
}
