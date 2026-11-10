// Testes do backend no simulador. Rode: node testes/backend.test.js
const assert = require('assert');
const { criarAmbiente } = require('./simulador-gas');

function gerarCpf(base9) {
  const d = base9.split('').map(Number);
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += d[i] * (t + 1 - i);
    d.push(((s * 10) % 11) % 10);
  }
  return d.join('');
}
const CPF1 = gerarCpf('529982247'); // 529.982.247-25
const CPF2 = gerarCpf('111444777'); // 111.444.777-35
const CPF3 = gerarCpf('123456789'); // 123.456.789-09

const { ctx, planilha, props, emails } = criarAmbiente();
const api = (acao, dados = {}, token, verComo) =>
  JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ acao, dados, token, verComo }) } }).getContent());

let passou = 0;
function teste(nome, fn) {
  fn();
  passou++;
  console.log('ok  ' + nome);
}

teste('setup cria todas as abas e os segredos', () => {
  ctx.setup();
  assert.strictEqual(planilha.getSheets().length, Object.keys(ctx.ESQUEMA).length);
  assert.ok(!planilha.getSheetByName('Página1'));
  assert.ok(props.PLANILHA_ID && props.CPF_SEGREDO.length === 64);
  const cab = planilha.getSheetByName('usuarios').dados[0];
  assert.deepStrictEqual(cab.slice(0, 3), ['id', 'email', 'usuario']);
  ctx.setup(); // de novo, sem duplicar
  assert.strictEqual(planilha.getSheetByName('usuarios').getLastRow(), 1);
});

props.ADMIN_EMAIL = 'admin@exemplo.com';
props.APP_URL = 'https://exemplo.github.io/fitness/';
let tokenAdmin, tokenAluno, idAluno;

teste('status responde sem login', () => {
  const r = api('sistema.status');
  assert.ok(r.ok && r.dados.app === 'Meu treino');
});

teste('cadastro do administrador', () => {
  const r = api('auth.cadastrar', { nome: 'Matheus', email: 'Admin@Exemplo.com', senha: 'senha-forte-1', cpf: CPF1, aceite_termos: true });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.dados.perfil.admin, true);
  assert.deepStrictEqual(r.dados.perfil.papeis, ['aluno', 'admin']);
  assert.strictEqual(r.dados.perfil.plano.tipo, 'gratis');
  assert.strictEqual(r.dados.perfil.hash_senha, undefined);
  assert.strictEqual(r.dados.perfil.cpf_hash, undefined);
  assert.strictEqual(r.dados.perfil.cpf_mascarado, '***.982.247-**');
  tokenAdmin = r.dados.token;
});

teste('CPF completo nunca vai para a planilha', () => {
  const tudo = JSON.stringify(planilha.abas.map((a) => a.dados));
  assert.ok(!tudo.includes(CPF1));
});

teste('mesmo CPF com pontuação diferente é recusado', () => {
  const formatado = CPF1.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const r = api('auth.cadastrar', { nome: 'Outro', email: 'outro@exemplo.com', senha: 'senha-forte-1', cpf: formatado, aceite_termos: true });
  assert.strictEqual(r.erro.codigo, 'DUPLICADO');
});

teste('CPF inválido e sequência repetida são recusados', () => {
  for (const cpf of ['12345678900', '11111111111', '123']) {
    const r = api('auth.cadastrar', { nome: 'X Y', email: 'x@exemplo.com', senha: 'senha-forte-1', cpf, aceite_termos: true });
    assert.strictEqual(r.erro.codigo, 'VALIDACAO');
  }
});

teste('texto que parece fórmula é gravado como texto e lido igual', () => {
  const nome = '=HYPERLINK("http://mal.com","oi")';
  const r = api('auth.cadastrar', { nome, email: 'aluno@exemplo.com', usuario: 'aluno.um', senha: 'senha-aluno-1', cpf: CPF2, aceite_termos: true });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.dados.perfil.nome, nome);
  const usuarios = planilha.getSheetByName('usuarios');
  assert.ok(usuarios.brutos.includes("'" + nome));
  assert.strictEqual(usuarios.formulas.length, 0);
  tokenAluno = r.dados.token;
  idAluno = r.dados.perfil.id;
  assert.strictEqual(api('perfil.ler', {}, tokenAluno).dados.nome, nome);
});

teste('nenhuma aba recebeu fórmula', () => {
  planilha.abas.forEach((a) => assert.strictEqual(a.formulas.length, 0, a.nome));
});

teste('login por usuário e por e-mail; senha errada bloqueia após 5 tentativas', () => {
  assert.ok(api('auth.entrar', { login: 'aluno.um', senha: 'senha-aluno-1' }).ok);
  assert.ok(api('auth.entrar', { login: 'ALUNO@exemplo.com', senha: 'senha-aluno-1' }).ok);
  for (let i = 0; i < 5; i++) assert.strictEqual(api('auth.entrar', { login: 'aluno.um', senha: 'errada' }).erro.codigo, 'CREDENCIAIS');
  assert.strictEqual(api('auth.entrar', { login: 'aluno.um', senha: 'senha-aluno-1' }).erro.codigo, 'BLOQUEADO');
});

teste('usuário inexistente recebe a mesma mensagem de senha errada', () => {
  const r = api('auth.entrar', { login: 'ninguem@exemplo.com', senha: 'qualquer-1' });
  assert.strictEqual(r.erro.codigo, 'CREDENCIAIS');
});

teste('perfil: tema e paleta vão e voltam da planilha', () => {
  const r = api('perfil.atualizar', { tema: 'escuro', paleta: 'vermelho' }, tokenAluno);
  assert.ok(r.ok);
  const lido = api('perfil.ler', {}, tokenAluno).dados;
  assert.strictEqual(lido.tema, 'escuro');
  assert.strictEqual(lido.paleta, 'vermelho');
  assert.strictEqual(api('perfil.atualizar', { paleta: '<script>' }, tokenAluno).erro.codigo, 'VALIDACAO');
});

teste('aluno não acessa rotas de administrador', () => {
  assert.strictEqual(api('admin.usuarios.listar', {}, tokenAluno).erro.codigo, 'PROIBIDO');
  assert.strictEqual(api('perfil.ler', {}, tokenAluno, 'aluno_gratis').erro.codigo, 'PROIBIDO');
});

teste('administrador lista usuários sem dados sensíveis e ativa personal', () => {
  const lista = api('admin.usuarios.listar', {}, tokenAdmin).dados;
  assert.strictEqual(lista.length, 2);
  lista.forEach((u) => assert.ok(!('hash_senha' in u) && !('cpf_hash' in u)));
  assert.ok(api('admin.personal.definir', { usuario_id: idAluno, ativo: true }, tokenAdmin).ok);
  const p = api('perfil.ler', {}, tokenAluno).dados;
  assert.strictEqual(p.plano.tipo, 'premium');
  assert.strictEqual(p.plano.origem, 'personal');
  assert.ok(p.papeis.includes('personal'));
  api('admin.personal.definir', { usuario_id: idAluno, ativo: false }, tokenAdmin);
});

teste('"ver como" do administrador é somente leitura', () => {
  assert.ok(api('admin.verComo', { papel: 'personal' }, tokenAdmin).ok);
  assert.ok(api('perfil.ler', {}, tokenAdmin, 'aluno_gratis').ok);
  assert.strictEqual(api('perfil.atualizar', { tema: 'claro' }, tokenAdmin, 'aluno_gratis').erro.codigo, 'SOMENTE_LEITURA');
  const aud = planilha.getSheetByName('auditoria').dados.map((l) => l[2]);
  assert.ok(aud.includes('admin.ver_como'));
});

teste('licença com prazo deixa o aluno premium e conta os dias', () => {
  const fim = new Date(Date.now() + 10 * 864e5).toISOString();
  ctx.inserir_('licencas', { usuario_id: idAluno, origem: 'cortesia', inicio: new Date(Date.now() - 1000).toISOString(), fim });
  const p = api('perfil.ler', {}, tokenAluno).dados.plano;
  assert.strictEqual(p.tipo, 'premium');
  assert.strictEqual(p.dias_restantes, 10);
});

teste('recuperação de senha por e-mail', () => {
  assert.ok(api('auth.pedirRecuperacao', { email: 'aluno@exemplo.com' }).dados.enviado);
  assert.ok(api('auth.pedirRecuperacao', { email: 'naoexiste@exemplo.com' }).dados.enviado);
  assert.strictEqual(emails.length, 1);
  const token = emails[0].body.match(/token=([0-9a-f]{64})/)[1];
  assert.ok(emails[0].body.includes('https://exemplo.github.io/fitness/#/redefinir?token='));
  assert.ok(api('auth.redefinirSenha', { token, senha_nova: 'nova-senha-123' }).ok);
  assert.strictEqual(api('auth.redefinirSenha', { token, senha_nova: 'outra-senha-123' }).erro.codigo, 'LINK_INVALIDO');
  assert.ok(api('auth.entrar', { login: 'aluno@exemplo.com', senha: 'nova-senha-123' }).ok);
});

teste('troca de senha confere a senha atual', () => {
  assert.strictEqual(api('auth.trocarSenha', { senha_atual: 'errada', senha_nova: 'x-nova-senha-9' }, tokenAdmin).erro.codigo, 'CREDENCIAIS');
  assert.ok(api('auth.trocarSenha', { senha_atual: 'senha-forte-1', senha_nova: 'x-nova-senha-9' }, tokenAdmin).ok);
});

teste('sair invalida o token', () => {
  assert.ok(api('auth.sair', {}, tokenAluno).ok);
  assert.strictEqual(api('perfil.ler', {}, tokenAluno).erro.codigo, 'SESSAO_INVALIDA');
});

teste('pedidos estranhos não quebram o servidor', () => {
  for (const acao of ['__proto__', 'constructor', 'toString', 'nada']) {
    assert.strictEqual(api(acao).erro.codigo, 'ACAO_DESCONHECIDA');
  }
  const r = JSON.parse(ctx.doPost({ postData: { contents: '{nao é json' } }).getContent());
  assert.strictEqual(r.erro.codigo, 'PEDIDO_INVALIDO');
  assert.strictEqual(api('perfil.ler', {}, 'token-falso').erro.codigo, 'SESSAO_INVALIDA');
  assert.strictEqual(ctx._erros.length, 0, ctx._erros.join('\n'));
});

teste('terceiro cadastro sem nome de usuário funciona', () => {
  assert.ok(api('auth.cadastrar', { nome: 'Maria', email: 'maria@exemplo.com', senha: 'senha-maria-1', cpf: CPF3, aceite_termos: true }).ok);
});

console.log(`\n${passou} testes passaram.`);
