// Testes do catálogo base (carga com prévia, nomes antigos, junção). Rode: node testes/catalogo.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const { ctx, planilha, props, criarOutraPlanilha } = criarAmbiente();
const api = (acao, dados = {}, token) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ acao, dados, token }) } }).getContent());
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.erro || r)); return r.dados; };
const uid = () => crypto.randomUUID();
let passou = 0;
function teste(nome, fn) { fn(); passou++; console.log('ok  ' + nome); }

ctx.setup();
props.ADMIN_EMAIL = 'admin@exemplo.com';
const admin = ok(api('auth.cadastrar', { nome: 'Admin', email: 'admin@exemplo.com', senha: 'senha-admin-1', cpf: gerarCpf('529982247'), aceite_termos: true }));
const TA = admin.token;
const N = ctx.CATALOGO_BASE_.length;

teste('catálogo base: nomes únicos e grupos da lista padrão', () => {
  const nomes = new Set(ctx.CATALOGO_BASE_.map((c) => ctx.normalizarNome_(c[0])));
  assert.strictEqual(nomes.size, N);
  ctx.CATALOGO_BASE_.forEach((c) => assert.ok(ctx.GRUPOS_MUSCULARES.includes(c[1]), c[0]));
  assert.ok(N >= 300);
});

// planilha antiga pequena com nomes do app antigo
const d = (s) => new Date(s + '-03:00');
criarOutraPlanilha('planilha-antiga-pequena-000000', {
  PLANO_ATUAL: [
    ['id_exercicio', 'divisao', 'ordem', 'grupo_muscular', 'nome_exercicio', 'series', 'repeticoes', 'carga_sugerida', 'intervalo_seg', 'metodo_avancado', 'link_video', 'observacoes'],
    ['A1', 'A', 1, 'Peito', 'Supino Inclinado', 4, 15, '', 60, '', '', ''],
    ['A2', 'A', 2, 'Tríceps', 'Tríceps Corda', 3, '10 + 10', '', 45, '', '', ''],
    ['A3', 'A', 3, 'Pernas', 'Panturrilha Sentadilha', 4, 15, '', 45, '', '', ''],
    ['A4', 'A', 4, 'Dorsal', 'Puxada Pronada', 3, '10', '', 90, '', '', '']
  ],
  LOGS_TREINO: [
    ['data_hora', 'divisao_realizada', 'id_exercicio', 'nome_exercicio', 'carga_utilizada', 'series_feitas', 'percepcao_esforco'],
    [d('2026-01-19T22:48:59'), 'A', 'A1', 'Supino Inclinado', '10kg / 10kg', 2, ''],
    [d('2026-01-19T22:48:59'), 'A', 'A2', 'Tríceps Corda', '16.25kg', 1, ''],
    [d('2026-01-19T22:48:59'), 'A', 'A3', 'Panturrilha Sentadilha', '40kg', 1, ''],
    [d('2026-01-19T22:48:59'), 'A', 'A4', 'Puxada Pronada + Supinada', '40kg', 1, '']
  ]
}, 'America/Sao_Paulo');

let tricepsAntigo;
teste('prévia: renomeia nomes antigos, deixa os duvidosos para confirmar e não grava', () => {
  ok(api('admin.importar.executar', { planilha_id: 'planilha-antiga-pequena-000000', email: 'admin@exemplo.com' }, TA));
  tricepsAntigo = ctx.lerTodos_('exercicios').find((e) => e.nome === 'Tríceps Corda');
  const antes = ctx.lerTodos_('exercicios').length;
  const p = ok(api('admin.catalogo.previa', {}, TA));
  const ren = Object.fromEntries(p.renomear.map((r) => [r.antigo, r.novo]));
  assert.strictEqual(ren['Tríceps Corda'], 'Tríceps na polia com corda');
  assert.strictEqual(ren['Panturrilha Sentadilha'], 'Panturrilha sentado (máquina)');
  assert.strictEqual(ren['Puxada Pronada'], 'Puxada frontal pronada');
  assert.deepStrictEqual(p.duvidas.map((x) => x.antigo), ['Supino Inclinado']);
  assert.strictEqual(p.criar, N - 3); // 3 nomes do catálogo já vêm dos renomeados
  assert.strictEqual(ctx.lerTodos_('exercicios').length, antes);
});

teste('carga: cria o catálogo, renomeia sem perder histórico, idempotente', () => {
  const r = ok(api('admin.catalogo.semear', { confirmar: ['Supino Inclinado'] }, TA));
  assert.strictEqual(r.feito, true);
  const ex = ctx.lerTodos_('exercicios');
  const t = ex.find((e) => e.id === tricepsAntigo.id);
  assert.strictEqual(t.nome, 'Tríceps na polia com corda');
  assert.strictEqual(t.grupo_muscular, 'Tríceps');
  assert.strictEqual(t.mecanica, 'isolado');
  assert.ok(ctx.lerTodos_('series').some((s) => s.exercicio_id === t.id), 'séries continuam ligadas');
  assert.ok(ex.some((e) => e.nome === 'Supino inclinado com halteres' && e.grupo_muscular === 'Peito'));
  assert.ok(ex.some((e) => e.nome === 'Puxada Pronada + Supinada'), 'o bi-set fica para decidir');
  const total = ex.filter((e) => e.global).length;
  assert.ok(total >= N, String(total));
  const de2 = ok(api('admin.catalogo.semear', {}, TA));
  assert.strictEqual(de2.criar, 0);
  assert.strictEqual(de2.renomear.length, 0);
  assert.strictEqual(ctx.lerTodos_('exercicios').filter((e) => e.global).length, total);
});

teste('juntar dois exercícios leva fichas e séries junto', () => {
  const ex = ctx.lerTodos_('exercicios');
  const bi = ex.find((e) => e.nome === 'Puxada Pronada + Supinada');
  const pron = ex.find((e) => e.nome === 'Puxada frontal pronada');
  const r = ok(api('admin.exercicios.juntar', { de: bi.id, para: pron.id }, TA));
  assert.strictEqual(r.series, 1);
  assert.ok(!ctx.lerTodos_('exercicios').some((e) => e.id === bi.id));
  assert.ok(ctx.lerTodos_('series').filter((s) => s.exercicio_id === pron.id).length >= 1);
  assert.strictEqual(api('admin.exercicios.juntar', { de: pron.id, para: pron.id }, TA).erro.codigo, 'VALIDACAO');
});

teste('exercício novo aceita secundários e tipo de movimento; grupos disponíveis', () => {
  const e = ok(api('exercicios.criar', { nome: 'Remada no TRX', grupo_muscular: 'Costas', secundarios: 'Bíceps', mecanica: 'composto' }, TA));
  assert.strictEqual(e.mecanica, 'composto');
  assert.strictEqual(api('exercicios.criar', { nome: 'X Y', mecanica: '=1' }, TA).erro.codigo, 'VALIDACAO');
  assert.strictEqual(ok(api('exercicios.grupos', {}, TA)).length, 16);
  planilha.abas.forEach((a) => assert.strictEqual(a.formulas.length, 0, a.nome));
  assert.strictEqual(ctx._erros.length, 0, ctx._erros.join('\n'));
});

// Com a planilha real (só na máquina de quem tem o arquivo)
const real = path.join(__dirname, 'planilha-antiga.local.json');
if (fs.existsSync(real)) {
  teste('planilha real: o que a carga faria', () => {
    const amb = criarAmbiente();
    const a2 = (acao, dados = {}, token) => JSON.parse(amb.ctx.doPost({ postData: { contents: JSON.stringify({ acao, dados, token }) } }).getContent());
    amb.ctx.setup();
    amb.props.ADMIN_EMAIL = 'admin@exemplo.com';
    const t = a2('auth.cadastrar', { nome: 'Admin', email: 'admin@exemplo.com', senha: 'senha-admin-1', cpf: gerarCpf('529982247'), aceite_termos: true }).dados.token;
    const j = JSON.parse(fs.readFileSync(real, 'utf8'));
    const abas = {};
    Object.keys(j).forEach((n) => { abas[n] = j[n].map((l) => l.map((v) => (v && v.$data ? new Date(v.$data + '-03:00') : v))); });
    amb.criarOutraPlanilha('planilha-antiga-real-0000000000', abas, 'America/Sao_Paulo');
    a2('admin.importar.executar', { planilha_id: 'planilha-antiga-real-0000000000', email: 'admin@exemplo.com' }, t);
    const p = a2('admin.catalogo.previa', {}, t).dados;
    fs.writeFileSync(path.join(__dirname, 'previa-catalogo.local.json'), JSON.stringify(p, null, 2));
    console.log(`    renomear ${p.renomear.length}, juntar ${p.juntar.length}, confirmar ${p.duvidas.length}, criar ${p.criar}, completar ${p.completar}`);
    const ex = amb.ctx.lerTodos_('exercicios').filter((e) => !p.renomear.some((r) => r.antigo === e.nome) && !p.duvidas.some((r) => r.antigo === e.nome));
    console.log('    ficam como estão: ' + ex.map((e) => e.nome).join(', '));
  });
}

console.log(`\n${passou} testes passaram.`);
