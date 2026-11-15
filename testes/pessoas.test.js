// Testes da Fase 2 (convites, personal, comentários, grupos, administração). Rode: node testes/pessoas.test.js
const assert = require('assert');
const crypto = require('crypto');
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

const { ctx, planilha, props } = criarAmbiente();
const api = (acao, dados = {}, token, verComo) =>
  JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ acao, dados, token, verComo }) } }).getContent());
const uid = () => crypto.randomUUID();
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.erro || r)); return r.dados; };
const erro = (r) => (r.ok ? 'OK' : r.erro.codigo);

let passou = 0;
function teste(nome, fn) { fn(); passou++; console.log('ok  ' + nome); }

ctx.setup();
props.ADMIN_EMAIL = 'admin@exemplo.com';
props.APP_URL = 'https://exemplo.github.io/fitness/';
const conta = (nome, email, base) => ok(api('auth.cadastrar', { nome, email, senha: 'senha-' + nome + '-1', cpf: gerarCpf(base), aceite_termos: true }));
const admin = conta('Admin', 'admin@exemplo.com', '529982247');
const pedro = conta('Pedro', 'pedro@exemplo.com', '111444777'); // personal
const ana = conta('Ana', 'ana@exemplo.com', '123456789'); // aluna
const beto = conta('Beto', 'beto@exemplo.com', '987654321'); // aluno sem personal
const gil = conta('Gil', 'gil@exemplo.com', '456789123'); // gerente
const [TA, TP, TANA, TB, TG] = [admin.token, pedro.token, ana.token, beto.token, gil.token];
const idAna = ana.perfil.id;

let codigo, exPrivado;

teste('só personal ativo cria convite de aluno', () => {
  assert.strictEqual(erro(api('convites.criar', { tipo: 'personal' }, TP)), 'PROIBIDO');
  ok(api('admin.usuario.atualizar', { usuario_id: pedro.perfil.id, personal_ativo: true }, TA));
  const c = ok(api('convites.criar', { tipo: 'personal' }, TP));
  assert.match(c.codigo, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.ok(c.link.endsWith('#/convite/' + c.codigo));
  codigo = c.codigo;
  // o código não fica guardado na planilha, só o hash
  assert.ok(!JSON.stringify(planilha.getSheetByName('convites').dados).includes(codigo));
  assert.strictEqual(ok(api('convites.listar', {}, TP)).length, 1);
});

teste('aluno vê o convite antes de aceitar e aceita', () => {
  const v = ok(api('convites.ver', { codigo: codigo.toLowerCase().replace(/(....)/, '$1-') }, TANA));
  assert.strictEqual(v.de, 'Pedro');
  assert.strictEqual(v.personal_atual, null);
  const r = ok(api('convites.aceitar', { codigo }, TANA));
  assert.strictEqual(r.personal, 'Pedro');
  assert.strictEqual(ok(api('vinculo.meu', {}, TANA)).personal.nome, 'Pedro');
});

teste('convite de uso único não serve para outra pessoa; código errado conta tentativa', () => {
  assert.strictEqual(erro(api('convites.aceitar', { codigo }, TB)), 'CONVITE_INVALIDO');
  for (let i = 0; i < 3; i++) assert.strictEqual(erro(api('convites.ver', { codigo: 'ABCDEFGH' }, TB)), 'CONVITE_INVALIDO');
  assert.strictEqual(erro(api('convites.ver', { codigo: 'ABCDEFGH' }, TB)), 'CONVITE_INVALIDO');
  assert.strictEqual(erro(api('convites.ver', { codigo: 'ABCDEFGH' }, TB)), 'BLOQUEADO');
  assert.strictEqual(erro(api('convites.ver', { codigo: '12' }, TANA)), 'VALIDACAO');
});

teste('personal lista os alunos; outros não', () => {
  const l = ok(api('personal.alunos', {}, TP));
  assert.deepStrictEqual(l.map((a) => a.nome), ['Ana']);
  assert.strictEqual(l[0].plano, 'gratis');
  assert.strictEqual(erro(api('personal.alunos', {}, TB)), 'PROIBIDO');
  assert.strictEqual(erro(api('personal.aluno', { aluno_id: beto.perfil.id }, TP)), 'PROIBIDO');
});

const fichaP = uid(), itemP = uid();
teste('personal prescreve ficha com exercício próprio; aluna vê e usa', () => {
  exPrivado = ok(api('exercicios.criar', { nome: 'Remada do Pedro', grupo_muscular: 'Costas' }, TP));
  const supino = ok(api('exercicios.criar', { nome: 'Supino Reto', grupo_muscular: 'Peito' }, TA));
  ok(api('personal.fichaSalvar', {
    aluno_id: idAna,
    ficha: { id: fichaP, nome: 'Treino A (Pedro)' },
    itens: [
      { id: itemP, exercicio_id: exPrivado.id, series: 3, reps_prescritas: '12', carga_prescrita_kg: 30, carga_atual_kg: 30 },
      { id: uid(), exercicio_id: supino.id, series: 3, reps_prescritas: '10' }
    ]
  }, TP));
  const f = ok(api('fichas.listar', {}, TANA)).fichas[0];
  assert.strictEqual(f.prescrita, true);
  assert.strictEqual(f.autor_nome, 'Pedro');
  assert.strictEqual(f.pode_editar, false);
  assert.ok(ok(api('exercicios.listar', {}, TANA)).some((e) => e.id === exPrivado.id), 'aluna vê o exercício da ficha');
  assert.ok(!ok(api('exercicios.listar', {}, TB)).some((e) => e.id === exPrivado.id));
});

teste('aluna não altera a ficha prescrita, mas sobe a carga pelo treino', () => {
  assert.strictEqual(erro(api('fichas.salvar', { ficha: { id: fichaP, nome: 'Mudei' }, itens: [] }, TANA)), 'PROIBIDO');
  assert.strictEqual(erro(api('fichas.excluir', { id: fichaP }, TANA)), 'PROIBIDO');
  const sessao = uid();
  ok(api('treino.sincronizar', {
    sessoes: [{ id: sessao, ficha_id: fichaP, inicio: '2026-11-14T07:00:00-03:00', fim: '2026-11-14T08:00:00-03:00' }],
    series: [{ id: uid(), sessao_id: sessao, exercicio_id: exPrivado.id, ordem: 1, reps: 12, carga_kg: 32.5 }],
    ajustes: [{ id: uid(), ficha_item_id: itemP, campo: 'carga_atual_kg', valor_novo: 32.5 }]
  }, TANA));
  const a = ok(api('personal.aluno', { aluno_id: idAna }, TP));
  assert.strictEqual(a.historico.sessoes.length, 1);
  assert.strictEqual(a.ajustes.length, 1);
  assert.strictEqual(a.ajustes[0].valor_novo, '32.5');
  assert.strictEqual(a.ajustes[0].ficha, 'Treino A (Pedro)');
  assert.ok(a.exercicios.some((e) => e.id === exPrivado.id));
  assert.strictEqual(ok(api('personal.alunos', {}, TP))[0].ajustes_novos, 1);
  ok(api('personal.ajustesVistos', { aluno_id: idAna }, TP));
  assert.strictEqual(ok(api('personal.alunos', {}, TP))[0].ajustes_novos, 0);
});

teste('limite do plano grátis vale também para o que o personal prescreve', () => {
  ok(api('personal.fichaSalvar', { aluno_id: idAna, ficha: { id: uid(), nome: 'B' }, itens: [] }, TP));
  ok(api('personal.fichaSalvar', { aluno_id: idAna, ficha: { id: uid(), nome: 'C' }, itens: [] }, TP));
  const r = api('personal.fichaSalvar', { aluno_id: idAna, ficha: { id: uid(), nome: 'D' }, itens: [] }, TP);
  assert.strictEqual(erro(r), 'LIMITE_PLANO');
  assert.match(r.erro.mensagem, /Este aluno está no plano grátis/);
});

teste('comentários: personal comenta, aluna responde, cada lado marca como visto', () => {
  const sessao = ok(api('historico.listar', {}, TANA)).sessoes[0].id;
  ok(api('comentarios.criar', { sessao_id: sessao, texto: '<b>Boa!</b> Mantenha a postura.' }, TP));
  ok(api('comentarios.criar', { sessao_id: sessao, texto: 'Obrigada!' }, TANA));
  assert.strictEqual(erro(api('comentarios.criar', { sessao_id: sessao, texto: 'intruso' }, TB)), 'PROIBIDO');
  const l = ok(api('comentarios.listar', {}, TANA));
  assert.deepStrictEqual(l.map((c) => c.autor_nome), ['Pedro', 'Ana']);
  assert.strictEqual(l[0].texto, '<b>Boa!</b> Mantenha a postura.'); // guardado como texto; a tela mostra como texto
  assert.strictEqual(ok(api('personal.alunos', {}, TP))[0].comentarios_novos, 1);
  ok(api('comentarios.vistos', {}, TANA));
  assert.strictEqual(ok(api('comentarios.listar', {}, TANA))[0].visto, true);
  ok(api('comentarios.vistos', { aluno_id: idAna }, TP));
  assert.strictEqual(ok(api('personal.alunos', {}, TP))[0].comentarios_novos, 0);
});

teste('encerrar o vínculo devolve a ficha para a aluna e tira o acesso do personal', () => {
  const v = ok(api('vinculo.meu', {}, TANA)).personal;
  ok(api('vinculo.encerrar', { vinculo_id: v.vinculo_id }, TANA));
  assert.strictEqual(erro(api('personal.aluno', { aluno_id: idAna }, TP)), 'PROIBIDO');
  assert.strictEqual(erro(api('personal.fichaSalvar', { aluno_id: idAna, ficha: { id: fichaP, nome: 'X' }, itens: [] }, TP)), 'PROIBIDO');
  const f = ok(api('fichas.listar', {}, TANA)).fichas.find((x) => x.id === fichaP);
  assert.strictEqual(f.pode_editar, true);
  ok(api('fichas.salvar', { ficha: { id: fichaP, nome: 'Treino A (minha)' }, itens: [] }, TANA));
});

teste('aceitar um novo personal encerra o anterior', () => {
  ok(api('admin.usuario.atualizar', { usuario_id: beto.perfil.id, personal_ativo: true }, TA));
  ok(api('convites.aceitar', { codigo: ok(api('convites.criar', { tipo: 'personal' }, TP)).codigo }, TANA));
  const c2 = ok(api('convites.criar', { tipo: 'personal' }, TB)).codigo;
  assert.strictEqual(ok(api('convites.ver', { codigo: c2 }, TANA)).personal_atual, 'Pedro');
  ok(api('convites.aceitar', { codigo: c2 }, TANA));
  assert.strictEqual(ok(api('vinculo.meu', {}, TANA)).personal.nome, 'Beto');
  assert.strictEqual(ok(api('personal.alunos', {}, TP)).length, 0);
});

let grupo;
teste('admin cria grupo com gerente; gerente convida membros', () => {
  assert.strictEqual(erro(api('admin.grupos.criar', { nome: 'Turma da manhã' }, TG)), 'PROIBIDO');
  grupo = ok(api('admin.grupos.criar', { nome: 'Turma da manhã', descricao: 'Academia X', gerente_email: 'gil@exemplo.com' }, TA));
  const perfilGil = ok(api('perfil.ler', {}, TG));
  assert.ok(perfilGil.papeis.includes('gerente'));
  const c = ok(api('convites.criar', { tipo: 'grupo', grupo_id: grupo.id, papel: 'membro' }, TG));
  assert.strictEqual(c.usos_max, 30);
  assert.strictEqual(erro(api('convites.criar', { tipo: 'grupo', grupo_id: grupo.id, papel: 'gerente' }, TG)), 'PROIBIDO');
  assert.strictEqual(erro(api('convites.criar', { tipo: 'grupo', grupo_id: grupo.id }, TANA)), 'PROIBIDO');
  assert.strictEqual(ok(api('convites.ver', { codigo: c.codigo }, TANA)).grupo, 'Turma da manhã');
  ok(api('convites.aceitar', { codigo: c.codigo }, TANA));
  ok(api('convites.aceitar', { codigo: c.codigo }, TP)); // mesmo código, várias pessoas
  const pc = ok(api('convites.criar', { tipo: 'grupo', grupo_id: grupo.id, papel: 'personal' }, TG)).codigo;
  assert.strictEqual(erro(api('convites.aceitar', { codigo: pc }, TA)), 'PROIBIDO'); // admin não é personal
});

teste('gerente vê só o resumo de frequência; membro vê só o nome do grupo', () => {
  const g = ok(api('grupos.ler', { id: grupo.id }, TG));
  assert.strictEqual(g.resumo.membros, 3);
  const anaM = g.membros.find((m) => m.nome === 'Ana');
  assert.strictEqual(anaM.treinos_30d >= 0, true);
  assert.ok(!('series' in g) && !('historico' in g));
  const m = ok(api('grupos.ler', { id: grupo.id }, TANA));
  assert.strictEqual(m.membros, undefined);
  assert.deepStrictEqual(m.gerentes, ['Gil']);
  assert.strictEqual(erro(api('grupos.ler', { id: grupo.id }, TB)), 'PROIBIDO');
  assert.deepStrictEqual(ok(api('grupos.listar', {}, TANA)).map((x) => x.meu_papel), ['membro']);
});

teste('gerente muda papel e remove membro; não mexe em gerente', () => {
  const g = ok(api('grupos.ler', { id: grupo.id }, TG));
  const pedroM = g.membros.find((m) => m.nome === 'Pedro');
  const gilM = g.membros.find((m) => m.nome === 'Gil');
  ok(api('grupos.papel', { grupo_id: grupo.id, membro_id: pedroM.id, papel: 'personal' }, TG));
  const anaM = g.membros.find((m) => m.nome === 'Ana');
  assert.strictEqual(erro(api('grupos.papel', { grupo_id: grupo.id, membro_id: anaM.id, papel: 'personal' }, TG)), 'VALIDACAO');
  assert.strictEqual(erro(api('grupos.remover', { grupo_id: grupo.id, membro_id: gilM.id }, TG)), 'PROIBIDO');
  ok(api('grupos.remover', { grupo_id: grupo.id, membro_id: anaM.id }, TG));
  assert.strictEqual(ok(api('grupos.ler', { id: grupo.id }, TG)).resumo.membros, 2);
  ok(api('grupos.sair', { grupo_id: grupo.id }, TP));
  assert.strictEqual(ok(api('grupos.listar', {}, TP)).length, 0);
});

teste('admin: desativar conta derruba a sessão; não se desativa a si mesmo', () => {
  assert.strictEqual(erro(api('admin.usuario.atualizar', { usuario_id: admin.perfil.id, admin: false }, TA)), 'VALIDACAO');
  ok(api('admin.usuario.atualizar', { usuario_id: gil.perfil.id, ativo: false }, TA));
  assert.strictEqual(erro(api('perfil.ler', {}, TG)), 'SESSAO_INVALIDA');
  assert.strictEqual(erro(api('auth.entrar', { login: 'gil@exemplo.com', senha: 'senha-Gil-1' })), 'CREDENCIAIS');
  ok(api('admin.usuario.atualizar', { usuario_id: gil.perfil.id, ativo: true }, TA));
  assert.ok(api('auth.entrar', { login: 'gil@exemplo.com', senha: 'senha-Gil-1' }).ok);
});

teste('catálogo: personal propõe, admin aceita e o exercício vira geral', () => {
  assert.strictEqual(erro(api('exercicios.propor', { id: exPrivado.id }, TANA)), 'PROIBIDO');
  ok(api('exercicios.propor', { id: exPrivado.id }, TP));
  const cat = ok(api('admin.catalogo', {}, TA));
  const e = cat.find((x) => x.id === exPrivado.id);
  assert.strictEqual(e.status, 'proposto');
  assert.strictEqual(e.autor_nome, 'Pedro');
  ok(api('admin.exercicio.decidir', { id: exPrivado.id, aceitar: true }, TA));
  assert.ok(ok(api('exercicios.listar', {}, TB)).some((x) => x.id === exPrivado.id));
  ok(api('admin.exercicio.atualizar', { id: exPrivado.id, nome: 'Remada Baixa Neutra', video_url: 'https://youtu.be/dQw4w9WgXcQ' }, TA));
  assert.strictEqual(erro(api('admin.catalogo', {}, TP)), 'PROIBIDO');
});

teste('"ver como" não grava nas rotas novas; nenhuma fórmula; nenhum erro inesperado', () => {
  assert.strictEqual(erro(api('convites.criar', { tipo: 'personal' }, TA, 'personal')), 'SOMENTE_LEITURA');
  assert.strictEqual(erro(api('admin.grupos.criar', { nome: 'Z' }, TA, 'gerente')), 'SOMENTE_LEITURA');
  planilha.abas.forEach((a) => assert.strictEqual(a.formulas.length, 0, a.nome));
  assert.strictEqual(ctx._erros.length, 0, ctx._erros.join('\n'));
});

console.log(`\n${passou} testes passaram.`);
