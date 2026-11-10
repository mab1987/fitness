/**
 * Contas: cadastro, login, sessão, recuperação de senha, perfil e plano.
 */

var CAMPOS_OCULTOS_USUARIO_ = ['hash_senha', 'cpf_hash'];
var HASH_FICTICIO_ = '$2a$10$u7O9.QGREUzWVgzXp57hBOLIh3FvpRL1a0UWmN54eO2v07fhV0iH2';

function cadastrar_(d) {
  var nome = texto_(d.nome, 'nome', 2, 80, true);
  var email = email_(d.email);
  var usuario = nomeUsuario_(d.usuario);
  var senha = senha_(d.senha);
  if (!cpfValido_(d.cpf)) throw erro_('VALIDACAO', 'CPF inválido.');
  if (d.aceite_termos !== true) throw erro_('VALIDACAO', 'É preciso aceitar os termos de uso.');

  var cpfHash = cpfHash_(d.cpf);
  var hash = hashSenha_(senha); // fora do bloqueio: é a parte lenta
  var adminEmail = prop_('ADMIN_EMAIL', false).trim().toLowerCase();

  var novo = comBloqueio_(function () {
    var todos = lerTodos_('usuarios', true);
    if (todos.some(function (u) { return u.cpf_hash === cpfHash; })) throw erro_('DUPLICADO', 'Já existe uma conta com este CPF.');
    if (todos.some(function (u) { return u.email === email; })) throw erro_('DUPLICADO', 'Já existe uma conta com este e-mail.');
    if (usuario && todos.some(function (u) { return u.usuario === usuario; })) throw erro_('DUPLICADO', 'Este nome de usuário já está em uso.');
    return inserirSemBloqueio_('usuarios', {
      email: email, usuario: usuario, hash_senha: hash, cpf_hash: cpfHash, cpf_mascarado: cpfMascarado_(d.cpf),
      nome: nome, admin: !!adminEmail && email === adminEmail, personal_ativo: false, ativo: true,
      tema: 'sistema', paleta: 'verde-agua', aceite_termos_em: agora_()
    });
  });
  registrarAuditoria_(novo.id, 'conta.cadastro', novo.id, novo.admin ? 'admin' : '');
  return criarSessao_(novo);
}

function entrar_(d) {
  var login = texto_(d.login, 'e-mail ou usuário', 3, 120, true).toLowerCase();
  if (typeof d.senha !== 'string' || !d.senha) throw erro_('VALIDACAO', 'Informe a senha.');
  if (tentativasEsgotadas_(login)) {
    throw erro_('BLOQUEADO', 'Muitas tentativas. Espere 15 minutos e tente de novo, ou recupere a senha.');
  }
  var u = lerTodos_('usuarios').filter(function (x) { return x.email === login || (x.usuario && x.usuario === login); })[0];
  // Sem conta, compara com um hash fictício: a resposta demora o mesmo e não revela quem tem cadastro.
  var senhaOk = confereSenha_(d.senha, u ? u.hash_senha : HASH_FICTICIO_);
  if (!u || !u.ativo || !senhaOk) {
    contarTentativa_(login);
    throw erro_('CREDENCIAIS', 'E-mail/usuário ou senha incorretos.');
  }
  zerarTentativas_(login);
  return criarSessao_(u);
}

function criarSessao_(u) {
  var token = tokenAleatorio_();
  var expira = new Date(Date.now() + APP.SESSAO_DIAS * 864e5).toISOString();
  inserir_('sessoes_login', { usuario_id: u.id, token_hash: sha256_(token), expira_em: expira });
  return { token: token, expira_em: expira, perfil: perfil_(u) };
}

/** Confere o token e devolve o usuário logado. */
function autenticar_(token) {
  if (typeof token !== 'string' || token.length < 32) throw erro_('SESSAO_INVALIDA', 'Entre novamente.');
  var th = sha256_(token);
  var cache = CacheService.getScriptCache();
  var usuarioId = cache.get('sess:' + th);
  if (!usuarioId) {
    var s = buscarUm_('sessoes_login', { token_hash: th });
    if (!s || s.revogada_em || s.expira_em < agora_()) throw erro_('SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');
    usuarioId = s.usuario_id;
    cache.put('sess:' + th, usuarioId, 600);
  }
  var u = buscarUm_('usuarios', { id: usuarioId });
  if (!u || !u.ativo) throw erro_('SESSAO_INVALIDA', 'Entre novamente.');
  u._tokenHash = th;
  return u;
}

function sair_(ctx) {
  var s = buscarUm_('sessoes_login', { token_hash: ctx.usuario._tokenHash });
  if (s) atualizar_('sessoes_login', s.id, { revogada_em: agora_() });
  CacheService.getScriptCache().remove('sess:' + ctx.usuario._tokenHash);
  return { saiu: true };
}

function trocarSenha_(d, ctx) {
  if (!confereSenha_(String(d.senha_atual || ''), ctx.usuario.hash_senha)) throw erro_('CREDENCIAIS', 'Senha atual incorreta.');
  var nova = senha_(d.senha_nova);
  atualizar_('usuarios', ctx.usuario.id, { hash_senha: hashSenha_(nova) });
  registrarAuditoria_(ctx.usuario.id, 'conta.troca_senha', ctx.usuario.id, '');
  return { trocada: true };
}

/** Envia link de recuperação. Responde igual exista ou não a conta (não revela quem tem cadastro). */
function pedirRecuperacao_(d) {
  var email = email_(d.email);
  if (contarTentativa_('rec:' + email) > 3) return { enviado: true };
  var u = buscarUm_('usuarios', { email: email });
  if (u && u.ativo) {
    var token = tokenAleatorio_();
    var expira = new Date(Date.now() + APP.RECUPERACAO_MINUTOS * 6e4).toISOString();
    inserir_('recuperacoes_senha', { usuario_id: u.id, token_hash: sha256_(token), expira_em: expira });
    var base = prop_('APP_URL', true).replace(/\/+$/, '');
    MailApp.sendEmail({
      to: email,
      subject: APP.NOME + ': redefinir senha',
      body: 'Olá, ' + u.nome + '.\n\nPara criar uma nova senha, abra o link abaixo em até ' + APP.RECUPERACAO_MINUTOS +
        ' minutos:\n\n' + base + '/#/redefinir?token=' + token + '\n\nSe você não pediu isso, ignore este e-mail.'
    });
  }
  return { enviado: true };
}

function redefinirSenha_(d) {
  var token = String(d.token || '');
  var nova = senha_(d.senha_nova);
  var r = buscarUm_('recuperacoes_senha', { token_hash: sha256_(token) });
  if (!r || r.usado_em || r.expira_em < agora_()) throw erro_('LINK_INVALIDO', 'Link inválido ou expirado. Peça um novo.');
  atualizar_('usuarios', r.usuario_id, { hash_senha: hashSenha_(nova) });
  atualizar_('recuperacoes_senha', r.id, { usado_em: agora_() });
  registrarAuditoria_(r.usuario_id, 'conta.redefinicao_senha', r.usuario_id, '');
  return { redefinida: true };
}

// ---------- Perfil e plano ----------

function perfil_(u) {
  var p = publico_(u, CAMPOS_OCULTOS_USUARIO_);
  p.plano = planoAtual_(u);
  p.papeis = papeis_(u);
  return p;
}

/** Plano vigente: premium se for personal ativo ou tiver licença válida; senão, grátis. */
function planoAtual_(u) {
  if (u.personal_ativo) return { tipo: 'premium', origem: 'personal', fim: null, dias_restantes: null };
  var agora = agora_();
  var validas = buscar_('licencas', { usuario_id: u.id }).filter(function (l) {
    return l.inicio && l.inicio <= agora && (!l.fim || l.fim > agora);
  });
  if (!validas.length) return { tipo: 'gratis', origem: null, fim: null, dias_restantes: null };
  var semPrazo = validas.filter(function (l) { return !l.fim; })[0];
  if (semPrazo) return { tipo: 'premium', origem: semPrazo.origem, fim: null, dias_restantes: null };
  var maior = validas.sort(function (a, b) { return a.fim < b.fim ? 1 : -1; })[0];
  return {
    tipo: 'premium', origem: maior.origem, fim: maior.fim,
    dias_restantes: Math.ceil((new Date(maior.fim).getTime() - Date.now()) / 864e5)
  };
}

function papeis_(u) {
  var papeis = ['aluno'];
  if (u.personal_ativo) papeis.push('personal');
  if (buscar_('membros_grupo', { usuario_id: u.id }).some(function (m) { return m.papel === 'gerente'; })) papeis.push('gerente');
  if (u.admin) papeis.push('admin');
  return papeis;
}

function atualizarPerfil_(d, ctx) {
  var campos = {};
  if (d.nome !== undefined) campos.nome = texto_(d.nome, 'nome', 2, 80, true);
  if (d.tema !== undefined) campos.tema = opcao_(d.tema, 'tema', APP.TEMAS);
  if (d.paleta !== undefined) campos.paleta = opcao_(d.paleta, 'paleta', APP.PALETAS);
  if (!Object.keys(campos).length) throw erro_('VALIDACAO', 'Nada para atualizar.');
  return perfil_(atualizar_('usuarios', ctx.usuario.id, campos));
}

// ---------- Administração ----------

function listarUsuarios_() {
  return lerTodos_('usuarios').map(function (u) {
    return publico_(Object.assign({}, u, { plano: planoAtual_(u) }), CAMPOS_OCULTOS_USUARIO_);
  });
}

function definirPersonal_(d, ctx) {
  var alvo = buscarUm_('usuarios', { id: texto_(d.usuario_id, 'usuário', 10, 60, true) });
  if (!alvo) throw erro_('NAO_ENCONTRADO', 'Usuário não encontrado.');
  var ativo = d.ativo === true;
  atualizar_('usuarios', alvo.id, { personal_ativo: ativo });
  registrarAuditoria_(ctx.usuario.id, ativo ? 'admin.personal.ativar' : 'admin.personal.desativar', alvo.id, '');
  return { usuario_id: alvo.id, personal_ativo: ativo };
}

function registrarVerComo_(d, ctx) {
  var papel = opcao_(d.papel, 'papel', APP.PAPEIS_VER_COMO);
  registrarAuditoria_(ctx.usuario.id, 'admin.ver_como', papel, '');
  return { papel: papel };
}

function registrarAuditoria_(usuarioId, acao, alvo, detalhes) {
  inserir_('auditoria', { usuario_id: usuarioId, acao: acao, alvo: alvo || '', detalhes: detalhes || '' });
}
