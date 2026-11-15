/**
 * Fase 2: convites, vínculo personal–aluno, acompanhamento pelo personal e comentários.
 *
 * Convite = código de 8 letras/números (ou link com o código) que vale 7 dias.
 * Só o hash do código fica na planilha; quem cria vê o código uma única vez.
 * O aluno precisa aceitar: é ele quem autoriza o personal a ver os treinos dele.
 */
var ALFABETO_CONVITE_ = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, que se confundem

// ---------- vínculo ----------

function vinculoAtivo_(personalId, alunoId) {
  if (!personalId || !alunoId || personalId === alunoId) return false;
  var p = buscarUm_('usuarios', { id: personalId });
  if (!p || !p.ativo || !p.personal_ativo) return false;
  return buscar_('vinculos_personal', { personal_id: personalId, aluno_id: alunoId })
    .some(function (v) { return v.status === 'ativo'; });
}

function exigirAlunoDoPersonal_(ctx, alunoId) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  var aluno = buscarUm_('usuarios', { id: id_(alunoId, 'aluno') });
  if (!aluno) throw erro_('NAO_ENCONTRADO', 'Aluno não encontrado.');
  if (!vinculoAtivo_(u.id, aluno.id)) throw erro_('PROIBIDO', 'Esta pessoa não é sua aluna.');
  return aluno;
}

/** Plano do aluno decide o limite de fichas, mesmo quando é o personal quem prescreve. */
function limitesDoAluno_(aluno) {
  var gratis = planoAtual_(aluno).tipo !== 'premium';
  return { plano: gratis ? 'gratis' : 'premium', fichas_ativas: gratis ? APP.LIMITE_FICHAS_GRATIS : null, dias_grafico: gratis ? APP.DIAS_GRAFICO_GRATIS : null, exportar: !gratis };
}

function meuVinculo_(d, ctx) {
  var u = ctx.usuario;
  var v = buscar_('vinculos_personal', { aluno_id: u.id }).filter(function (x) { return x.status === 'ativo'; })[0];
  if (!v) return { personal: null };
  var p = buscarUm_('usuarios', { id: v.personal_id });
  return { personal: p ? { vinculo_id: v.id, nome: p.nome, email: p.email, desde: v.inicio, ativo: !!(p.ativo && p.personal_ativo) } : null };
}

/** Qualquer um dos dois lados pode encerrar. As fichas ficam com o aluno, que passa a poder alterá-las. */
function encerrarVinculo_(d, ctx) {
  var u = ctx.usuario;
  var id = id_(d.vinculo_id, 'vínculo');
  return comBloqueio_(function () {
    var v = buscarUm_('vinculos_personal', { id: id });
    if (!v || (v.aluno_id !== u.id && v.personal_id !== u.id) || v.status !== 'ativo') throw erro_('NAO_ENCONTRADO', 'Vínculo não encontrado.');
    atualizarSemBloqueio_('vinculos_personal', id, { status: 'encerrado', fim: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'vinculo.encerrar', alvo: id, detalhes: '' });
    return { encerrado: id };
  });
}

// ---------- convites ----------

function gerarCodigo_() {
  var bytes = bytesAleatorios_(8);
  return bytes.map(function (b) { return ALFABETO_CONVITE_.charAt((b & 0xff) % ALFABETO_CONVITE_.length); }).join('');
}

function normalizarCodigo_(c) {
  var t = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t.length !== 8) throw erro_('VALIDACAO', 'O código tem 8 letras e números.');
  return t;
}

/**
 * dados: { tipo: 'personal' } (personal convida aluno)
 *     ou { tipo: 'grupo', grupo_id, papel: 'membro' | 'personal' | 'gerente' } (gerente ou admin)
 * usos_max: quantas pessoas podem usar (1 a 50; padrão 1 para personal, 30 para grupo).
 */
function criarConvite_(d, ctx) {
  var u = ctx.usuario;
  var tipo = opcao_(d.tipo, 'tipo de convite', ['personal', 'grupo']);
  var reg = { tipo: tipo, criado_por: u.id, grupo_id: '', papel: 'aluno' };
  if (tipo === 'personal') {
    if (!u.personal_ativo) throw erro_('PROIBIDO', 'Só personal ativo convida alunos.');
  } else {
    var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
    reg.grupo_id = g.id;
    reg.papel = opcao_(d.papel || 'membro', 'papel no grupo', APP.PAPEIS_GRUPO);
    if (reg.papel === 'gerente' && !u.admin) throw erro_('PROIBIDO', 'Só o administrador define gerentes.');
  }
  reg.usos_max = numero_(d.usos_max, 'quantidade de usos', 1, 50, true) || (tipo === 'grupo' ? 30 : 1);
  var codigo = gerarCodigo_();
  reg.codigo_hash = sha256_('convite|' + codigo);
  reg.final_codigo = codigo.slice(-3);
  reg.expira_em = new Date(Date.now() + APP.CONVITE_DIAS * 864e5).toISOString();
  reg.usos = 0;
  var salvo = inserir_('convites', reg);
  var base = prop_('APP_URL', false) || '';
  return {
    id: salvo.id, codigo: codigo, expira_em: reg.expira_em, usos_max: reg.usos_max,
    link: base ? base.replace(/\/?$/, '/') + '#/convite/' + codigo : ''
  };
}

function listarConvites_(d, ctx) {
  var u = ctx.usuario;
  var agora = agora_();
  return buscar_('convites', { criado_por: u.id })
    .filter(function (c) { return !c.revogado_em && c.expira_em > agora && c.usos < c.usos_max; })
    .map(function (c) { return publico_(c, ['codigo_hash']); });
}

function revogarConvite_(d, ctx) {
  var id = id_(d.id, 'convite');
  return comBloqueio_(function () {
    var c = buscarUm_('convites', { id: id });
    if (!c || (c.criado_por !== ctx.usuario.id && !ctx.usuario.admin)) throw erro_('NAO_ENCONTRADO', 'Convite não encontrado.');
    atualizarSemBloqueio_('convites', id, { revogado_em: agora_() });
    return { revogado: id };
  });
}

function acharConvite_(codigo, u) {
  var chave = 'convite:' + u.id;
  if (tentativasEsgotadas_(chave)) throw erro_('BLOQUEADO', 'Muitos códigos errados. Espere 15 minutos.');
  var hash = sha256_('convite|' + normalizarCodigo_(codigo));
  var c = buscarUm_('convites', { codigo_hash: hash });
  if (!c || c.revogado_em || c.expira_em < agora_() || c.usos >= c.usos_max) {
    contarTentativa_(chave);
    throw erro_('CONVITE_INVALIDO', 'Código inválido ou vencido. Peça um novo a quem convidou.');
  }
  return c;
}

/** Mostra o que o convite faz antes de aceitar. */
function verConvite_(d, ctx) {
  var c = acharConvite_(d.codigo, ctx.usuario);
  var autor = buscarUm_('usuarios', { id: c.criado_por });
  var r = { tipo: c.tipo, papel: c.papel, de: autor ? autor.nome : '', expira_em: c.expira_em };
  if (c.tipo === 'grupo') {
    var g = buscarUm_('grupos', { id: c.grupo_id });
    r.grupo = g ? g.nome : '';
  } else {
    var atual = meuVinculo_({}, ctx).personal;
    r.personal_atual = atual ? atual.nome : null;
  }
  return r;
}

function aceitarConvite_(d, ctx) {
  var u = ctx.usuario;
  var c0 = acharConvite_(d.codigo, u);
  return comBloqueio_(function () {
    var c = buscarUm_('convites', { id: c0.id });
    if (c.usos >= c.usos_max) throw erro_('CONVITE_INVALIDO', 'Este convite já foi usado.');
    if (c.criado_por === u.id) throw erro_('VALIDACAO', 'Este convite é seu. Envie para outra pessoa.');
    var r;
    if (c.tipo === 'personal') {
      var p = buscarUm_('usuarios', { id: c.criado_por });
      if (!p || !p.ativo || !p.personal_ativo) throw erro_('CONVITE_INVALIDO', 'Quem convidou não está mais como personal.');
      // Um personal por vez: aceitar outro encerra o anterior.
      buscar_('vinculos_personal', { aluno_id: u.id }).forEach(function (v) {
        if (v.status === 'ativo' && v.personal_id !== p.id) atualizarSemBloqueio_('vinculos_personal', v.id, { status: 'encerrado', fim: agora_() });
      });
      var ja = buscar_('vinculos_personal', { aluno_id: u.id, personal_id: p.id }).filter(function (v) { return v.status === 'ativo'; })[0];
      if (!ja) inserirSemBloqueio_('vinculos_personal', { personal_id: p.id, aluno_id: u.id, status: 'ativo', inicio: agora_() });
      r = { tipo: 'personal', personal: p.nome };
    } else {
      var g = buscarUm_('grupos', { id: c.grupo_id });
      if (!g) throw erro_('CONVITE_INVALIDO', 'O grupo não existe mais.');
      if (c.papel === 'personal' && !u.personal_ativo) {
        throw erro_('PROIBIDO', 'Este convite é para personal. Peça ao administrador para ativar seu papel de personal.');
      }
      var m = buscar_('membros_grupo', { grupo_id: g.id, usuario_id: u.id })[0];
      if (m) atualizarSemBloqueio_('membros_grupo', m.id, { papel: maiorPapel_(m.papel, c.papel) });
      else inserirSemBloqueio_('membros_grupo', { grupo_id: g.id, usuario_id: u.id, papel: c.papel });
      r = { tipo: 'grupo', grupo: g.nome, papel: c.papel };
    }
    atualizarSemBloqueio_('convites', c.id, { usos: (c.usos || 0) + 1 });
    inserirSemBloqueio_('auditoria', { usuario_id: u.id, acao: 'convite.aceitar', alvo: c.id, detalhes: c.tipo });
    zerarTentativas_('convite:' + u.id);
    return r;
  });
}

function maiorPapel_(a, b) {
  var ordem = ['membro', 'personal', 'gerente'];
  return ordem.indexOf(a) >= ordem.indexOf(b) ? a : b;
}

// ---------- personal: alunos ----------

function listarAlunos_(d, ctx) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Sem permissão.');
  var vinc = buscar_('vinculos_personal', { personal_id: u.id }).filter(function (v) { return v.status === 'ativo'; });
  if (!vinc.length) return [];
  var ids = {};
  vinc.forEach(function (v) { ids[v.aluno_id] = v; });
  var sessoes = lerTodos_('sessoes').filter(function (s) { return ids[s.aluno_id]; });
  var minhasFichas = {};
  lerTodos_('fichas').forEach(function (f) { if (ids[f.aluno_id]) minhasFichas[f.id] = f.aluno_id; });
  var itemDe = {};
  lerTodos_('ficha_itens').forEach(function (i) { if (minhasFichas[i.ficha_id]) itemDe[i.id] = minhasFichas[i.ficha_id]; });
  var ajustes = lerTodos_('ajustes').filter(function (a) { return ids[a.aluno_id] && !a.visto_pelo_personal; });
  var comentarios = lerTodos_('comentarios').filter(function (c) { return ids[c.aluno_id] && c.autor_id === c.aluno_id && !c.visto; });
  var h7 = new Date(Date.now() - 7 * 864e5).toISOString();
  var h30 = new Date(Date.now() - 30 * 864e5).toISOString();
  return lerTodos_('usuarios')
    .filter(function (a) { return ids[a.id]; })
    .map(function (a) {
      var s = sessoes.filter(function (x) { return x.aluno_id === a.id; });
      var ultima = s.reduce(function (m, x) { return !m || x.inicio > m ? x.inicio : m; }, null);
      return {
        id: a.id, nome: a.nome, email: a.email, vinculo_id: ids[a.id].id, desde: ids[a.id].inicio,
        plano: planoAtual_(a).tipo,
        ultimo_treino: ultima,
        treinos_7d: s.filter(function (x) { return x.inicio >= h7; }).length,
        treinos_30d: s.filter(function (x) { return x.inicio >= h30; }).length,
        ajustes_novos: ajustes.filter(function (x) { return x.aluno_id === a.id; }).length,
        comentarios_novos: comentarios.filter(function (x) { return x.aluno_id === a.id; }).length
      };
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Tudo o que o personal precisa para acompanhar um aluno. */
function lerAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  var fichas = fichasDe_(aluno.id, ctx.usuario, limitesDoAluno_(aluno));
  var hist = historicoDe_(aluno.id, null);
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var itens = {};
  fichas.fichas.forEach(function (f) { f.itens.forEach(function (i) { itens[i.id] = { ficha: f.nome, exercicio_id: i.exercicio_id }; }); });
  // exercícios que aparecem nas fichas e no histórico do aluno, mais os que o personal pode usar
  var vis = exerciciosVisiveis_(ctx.usuario);
  var doAluno = exerciciosVisiveis_(aluno);
  var exercicios = {};
  Object.keys(vis).concat(Object.keys(doAluno)).forEach(function (k) { exercicios[k] = publico_(vis[k] || doAluno[k], []); });
  lerTodos_('exercicios', true).forEach(function (e) {
    if (!exercicios[e.id] && hist.series.some(function (s) { return s.exercicio_id === e.id; })) exercicios[e.id] = publico_(e, []);
  });
  return {
    aluno: { id: aluno.id, nome: aluno.nome, email: aluno.email, plano: planoAtual_(aluno) },
    limites: fichas.limites,
    fichas: fichas.fichas,
    historico: { sessoes: hist.sessoes, series: hist.series },
    exercicios: Object.keys(exercicios).map(function (k) { return exercicios[k]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
    ajustes: buscar_('ajustes', { aluno_id: aluno.id })
      .map(function (a) { var r = publico_(a, []); r.ficha = (itens[a.ficha_item_id] || {}).ficha || ''; r.exercicio_id = (itens[a.ficha_item_id] || {}).exercicio_id || ''; return r; })
      .sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; }),
    comentarios: comentariosDe_(aluno.id, nomes)
  };
}

function salvarFichaDoAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return salvarFichaPara_(ctx.usuario, aluno, d, limitesDoAluno_(aluno));
}

function excluirFichaDoAluno_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  var id = id_(d.id, 'ficha');
  return comBloqueio_(function () {
    var f = buscarUm_('fichas', { id: id });
    if (!f || f.aluno_id !== aluno.id || f.autor_id !== ctx.usuario.id) throw erro_('NAO_ENCONTRADO', 'Só dá para excluir fichas que você prescreveu.');
    atualizarSemBloqueio_('fichas', id, { excluido_em: agora_(), ativa: false });
    return { excluida: id };
  });
}

function marcarAjustesVistos_(d, ctx) {
  var aluno = exigirAlunoDoPersonal_(ctx, d.aluno_id);
  return comBloqueio_(function () {
    var lista = buscar_('ajustes', { aluno_id: aluno.id }).filter(function (a) { return !a.visto_pelo_personal; });
    upsertLoteSemBloqueio_('ajustes', lista.map(function (a) { return { id: a.id, visto_pelo_personal: true }; }));
    return { vistos: lista.length };
  });
}

// ---------- comentários ----------

function comentariosDe_(alunoId, nomes) {
  return buscar_('comentarios', { aluno_id: alunoId })
    .map(function (c) { var r = publico_(c, []); r.autor_nome = nomes[c.autor_id] || ''; return r; })
    .sort(function (a, b) { return a.criado_em < b.criado_em ? -1 : 1; });
}

/** Aluno: os comentários dos treinos dele. Personal: os de um aluno (dados.aluno_id). */
function listarComentarios_(d, ctx) {
  var alunoId = d.aluno_id ? exigirAlunoDoPersonal_(ctx, d.aluno_id).id : ctx.usuario.id;
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  return comentariosDe_(alunoId, nomes);
}

function criarComentario_(d, ctx) {
  var u = ctx.usuario;
  var sessao = buscarUm_('sessoes', { id: id_(d.sessao_id, 'treino') });
  if (!sessao) throw erro_('NAO_ENCONTRADO', 'Treino não encontrado.');
  if (sessao.aluno_id !== u.id && !vinculoAtivo_(u.id, sessao.aluno_id)) throw erro_('PROIBIDO', 'Sem permissão.');
  var texto = texto_(d.texto, 'comentário', 1, 1000, true);
  var c = inserir_('comentarios', { id: d.id ? id_(d.id) : novoId_(), sessao_id: sessao.id, aluno_id: sessao.aluno_id, autor_id: u.id, texto: texto, visto: false });
  var r = publico_(c, []);
  r.autor_nome = u.nome;
  return r;
}

/** Marca como vistos os comentários escritos pelo outro lado. */
function marcarComentariosVistos_(d, ctx) {
  var u = ctx.usuario;
  var alunoId = d.aluno_id ? exigirAlunoDoPersonal_(ctx, d.aluno_id).id : u.id;
  return comBloqueio_(function () {
    var lista = buscar_('comentarios', { aluno_id: alunoId }).filter(function (c) { return !c.visto && c.autor_id !== u.id; });
    upsertLoteSemBloqueio_('comentarios', lista.map(function (c) { return { id: c.id, visto: true }; }));
    return { vistos: lista.length };
  });
}
