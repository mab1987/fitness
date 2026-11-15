/**
 * Fase 2: grupos (gerente e membros) e administração (usuários, papéis e catálogo).
 * O gerente vê só um resumo dos membros (quantos treinos fizeram), nunca cargas e séries:
 * os detalhes do treino são do aluno e do personal dele.
 */

// ---------- grupos ----------

function exigirGerenteDoGrupo_(ctx, grupoId) {
  var g = buscarUm_('grupos', { id: id_(grupoId, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  if (ctx.usuario.admin) return g;
  var m = buscar_('membros_grupo', { grupo_id: g.id, usuario_id: ctx.usuario.id })[0];
  if (!m || m.papel !== 'gerente') throw erro_('PROIBIDO', 'Só o gerente do grupo faz isso.');
  return g;
}

function criarGrupo_(d, ctx) {
  var nome = texto_(d.nome, 'nome do grupo', 2, 60, true);
  var descricao = texto_(d.descricao, 'descrição', 0, 300, false);
  var gerente = null;
  if (d.gerente_email) {
    gerente = buscarUm_('usuarios', { email: email_(d.gerente_email) });
    if (!gerente) throw erro_('NAO_ENCONTRADO', 'Nenhuma conta com esse e-mail. A pessoa precisa se cadastrar antes, ou envie um convite de gerente.');
  }
  return comBloqueio_(function () {
    if (lerTodos_('grupos').some(function (g) { return normalizarNome_(g.nome) === normalizarNome_(nome); })) throw erro_('DUPLICADO', 'Já existe um grupo com esse nome.');
    var g = inserirSemBloqueio_('grupos', { nome: nome, descricao: descricao });
    if (gerente) inserirSemBloqueio_('membros_grupo', { grupo_id: g.id, usuario_id: gerente.id, papel: 'gerente' });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.criar', alvo: g.id, detalhes: nome });
    return publico_(g, []);
  });
}

function atualizarGrupo_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.id);
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome do grupo', 2, 60, true);
  if (d.descricao !== undefined) campos.descricao = texto_(d.descricao, 'descrição', 0, 300, false);
  return publico_(atualizar_('grupos', g.id, campos), []);
}

function excluirGrupo_(d, ctx) {
  var g = buscarUm_('grupos', { id: id_(d.id, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  return comBloqueio_(function () {
    var t = agora_();
    atualizarSemBloqueio_('grupos', g.id, { excluido_em: t });
    upsertLoteSemBloqueio_('membros_grupo', buscar_('membros_grupo', { grupo_id: g.id }).map(function (m) { return { id: m.id, excluido_em: t }; }));
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.excluir', alvo: g.id, detalhes: g.nome });
    return { excluido: g.id };
  });
}

/** Admin: todos. Outros: os grupos de que participa, com o papel. */
function listarGrupos_(d, ctx) {
  var u = ctx.usuario;
  var membros = lerTodos_('membros_grupo');
  var meus = {};
  membros.forEach(function (m) { if (m.usuario_id === u.id) meus[m.grupo_id] = m.papel; });
  return lerTodos_('grupos')
    .filter(function (g) { return u.admin || meus[g.id]; })
    .map(function (g) {
      var r = publico_(g, []);
      r.meu_papel = meus[g.id] || (u.admin ? 'admin' : null);
      r.membros = membros.filter(function (m) { return m.grupo_id === g.id; }).length;
      return r;
    })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Gerente e admin: membros com resumo de frequência. Membro comum: só nome do grupo e do gerente. */
function lerGrupo_(d, ctx) {
  var u = ctx.usuario;
  var g = buscarUm_('grupos', { id: id_(d.id, 'grupo') });
  if (!g) throw erro_('NAO_ENCONTRADO', 'Grupo não encontrado.');
  var membros = buscar_('membros_grupo', { grupo_id: g.id });
  var eu = membros.filter(function (m) { return m.usuario_id === u.id; })[0];
  if (!eu && !u.admin) throw erro_('PROIBIDO', 'Você não participa deste grupo.');
  var usuarios = {};
  lerTodos_('usuarios').forEach(function (x) { usuarios[x.id] = x; });
  var gerentes = membros.filter(function (m) { return m.papel === 'gerente'; }).map(function (m) { return (usuarios[m.usuario_id] || {}).nome; });
  var base = { grupo: publico_(g, []), meu_papel: eu ? eu.papel : 'admin', gerentes: gerentes.filter(Boolean) };
  if (!u.admin && eu.papel !== 'gerente') return base;

  var ids = {};
  membros.forEach(function (m) { ids[m.usuario_id] = true; });
  var sessoes = lerTodos_('sessoes').filter(function (s) { return ids[s.aluno_id]; });
  var h7 = new Date(Date.now() - 7 * 864e5).toISOString();
  var h30 = new Date(Date.now() - 30 * 864e5).toISOString();
  base.membros = membros.map(function (m) {
    var p = usuarios[m.usuario_id] || {};
    var s = sessoes.filter(function (x) { return x.aluno_id === m.usuario_id; });
    return {
      id: m.id, usuario_id: m.usuario_id, nome: p.nome || '(conta removida)', email: p.email || '', papel: m.papel,
      desde: m.criado_em,
      treinos_7d: s.filter(function (x) { return x.inicio >= h7; }).length,
      treinos_30d: s.filter(function (x) { return x.inicio >= h30; }).length,
      ultimo_treino: s.reduce(function (mx, x) { return !mx || x.inicio > mx ? x.inicio : mx; }, null)
    };
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  base.resumo = {
    membros: membros.length,
    ativos_7d: base.membros.filter(function (m) { return m.treinos_7d > 0; }).length,
    treinos_30d: base.membros.reduce(function (t, m) { return t + m.treinos_30d; }, 0)
  };
  base.convites = buscar_('convites', { grupo_id: g.id })
    .filter(function (c) { return !c.revogado_em && c.expira_em > agora_() && c.usos < c.usos_max; })
    .map(function (c) { return publico_(c, ['codigo_hash']); });
  return base;
}

function definirPapelMembro_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
  var papel = opcao_(d.papel, 'papel no grupo', APP.PAPEIS_GRUPO);
  if (papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador define gerentes.');
  return comBloqueio_(function () {
    var m = buscarUm_('membros_grupo', { id: id_(d.membro_id, 'membro') });
    if (!m || m.grupo_id !== g.id) throw erro_('NAO_ENCONTRADO', 'Membro não encontrado.');
    if (m.papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador muda um gerente.');
    if (papel === 'personal') {
      var p = buscarUm_('usuarios', { id: m.usuario_id });
      if (!p || !p.personal_ativo) throw erro_('VALIDACAO', 'Esta pessoa não tem o papel de personal ativo.');
    }
    atualizarSemBloqueio_('membros_grupo', m.id, { papel: papel });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.papel', alvo: m.id, detalhes: papel });
    return { membro_id: m.id, papel: papel };
  });
}

function removerMembro_(d, ctx) {
  var g = exigirGerenteDoGrupo_(ctx, d.grupo_id);
  return comBloqueio_(function () {
    var m = buscarUm_('membros_grupo', { id: id_(d.membro_id, 'membro') });
    if (!m || m.grupo_id !== g.id) throw erro_('NAO_ENCONTRADO', 'Membro não encontrado.');
    if (m.papel === 'gerente' && !ctx.usuario.admin) throw erro_('PROIBIDO', 'Só o administrador remove um gerente.');
    atualizarSemBloqueio_('membros_grupo', m.id, { excluido_em: agora_() });
    inserirSemBloqueio_('auditoria', { usuario_id: ctx.usuario.id, acao: 'grupo.remover', alvo: m.id, detalhes: m.usuario_id });
    return { removido: m.id };
  });
}

function sairDoGrupo_(d, ctx) {
  var gid = id_(d.grupo_id, 'grupo');
  return comBloqueio_(function () {
    var m = buscar_('membros_grupo', { grupo_id: gid, usuario_id: ctx.usuario.id })[0];
    if (!m) throw erro_('NAO_ENCONTRADO', 'Você não participa deste grupo.');
    atualizarSemBloqueio_('membros_grupo', m.id, { excluido_em: agora_() });
    return { saiu: gid };
  });
}

// ---------- administração ----------

/** Liga ou desliga conta, papel de personal e de administrador. */
function atualizarUsuarioAdmin_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: id_(d.usuario_id, 'usuário') });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var campos = {};
  if (d.ativo !== undefined) campos.ativo = d.ativo === true;
  if (d.personal_ativo !== undefined) campos.personal_ativo = d.personal_ativo === true;
  if (d.admin !== undefined) campos.admin = d.admin === true;
  if (alvo.id === ctx.usuario.id && (campos.ativo === false || campos.admin === false)) {
    throw erro_('VALIDACAO', 'Você não pode desativar a própria conta nem tirar o seu acesso de administrador.');
  }
  if (!Object.keys(campos).length) throw erro_('VALIDACAO', 'Nada para alterar.');
  var novo = atualizar_('usuarios', alvo.id, campos);
  registrarAuditoria_(ctx.usuario.id, 'admin.usuario', alvo.id, JSON.stringify(campos));
  if (campos.ativo === false) revogarSessoesDe_(alvo.id);
  return publico_(Object.assign({}, novo, { plano: planoAtual_(novo) }), CAMPOS_OCULTOS_USUARIO_);
}

function revogarSessoesDe_(usuarioId) {
  comBloqueio_(function () {
    var t = agora_();
    var cache = CacheService.getScriptCache();
    var lista = buscar_('sessoes_login', { usuario_id: usuarioId }).filter(function (s) { return !s.revogada_em; });
    upsertLoteSemBloqueio_('sessoes_login', lista.map(function (s) { cache.remove('sess:' + s.token_hash); return { id: s.id, revogada_em: t }; }));
  });
}

/** Catálogo inteiro para o administrador: gerais, propostos e os de cada pessoa. */
function catalogoAdmin_(d, ctx) {
  var nomes = {};
  lerTodos_('usuarios').forEach(function (x) { nomes[x.id] = x.nome; });
  var usos = {};
  lerTodos_('ficha_itens').forEach(function (i) { usos[i.exercicio_id] = (usos[i.exercicio_id] || 0) + 1; });
  return lerTodos_('exercicios').map(function (e) {
    var r = publico_(e, []);
    r.autor_nome = nomes[e.criado_por] || '';
    r.usos = usos[e.id] || 0;
    return r;
  }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/** Personal propõe um exercício seu para o catálogo geral. */
function proporExercicio_(d, ctx) {
  var u = ctx.usuario;
  if (!u.personal_ativo && !u.admin) throw erro_('PROIBIDO', 'Só personal propõe exercícios para o catálogo.');
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex || ex.criado_por !== u.id) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  if (ex.global) throw erro_('VALIDACAO', 'Este exercício já está no catálogo geral.');
  return publico_(atualizar_('exercicios', ex.id, { status: 'proposto' }), []);
}

function decidirExercicio_(d, ctx) {
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var aceitar = d.aceitar === true;
  var r = atualizar_('exercicios', ex.id, aceitar ? { global: true, status: '' } : { status: 'recusado' });
  registrarAuditoria_(ctx.usuario.id, aceitar ? 'catalogo.aceitar' : 'catalogo.recusar', ex.id, ex.nome);
  return publico_(r, []);
}

/** Admin altera qualquer exercício, inclusive tirar do catálogo geral. */
function atualizarExercicioAdmin_(d, ctx) {
  var ex = buscarUm_('exercicios', { id: id_(d.id, 'exercício') });
  if (!ex) throw erro_('NAO_ENCONTRADO', 'Exercício não encontrado.');
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
  if (d.grupo_muscular !== undefined) campos.grupo_muscular = texto_(d.grupo_muscular, 'grupo muscular', 0, 40, false);
  if (d.equipamento !== undefined) campos.equipamento = texto_(d.equipamento, 'equipamento', 0, 40, false);
  if (d.video_url !== undefined) campos.video_url = videoYoutube_(d.video_url);
  if (d.global !== undefined) campos.global = d.global === true;
  var r = atualizar_('exercicios', ex.id, campos);
  registrarAuditoria_(ctx.usuario.id, 'catalogo.editar', ex.id, JSON.stringify(campos).slice(0, 500));
  return publico_(r, []);
}
