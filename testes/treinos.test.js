// Testes da Fase 1 (exercícios, fichas, treinos, histórico, importação). Rode: node testes/treinos.test.js
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
const api = (acao, dados = {}, token, verComo) =>
  JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ acao, dados, token, verComo }) } }).getContent());
const uid = () => crypto.randomUUID();
const ok = (r) => { assert.ok(r.ok, JSON.stringify(r.erro || r)); return r.dados; };

let passou = 0;
function teste(nome, fn) { fn(); passou++; console.log('ok  ' + nome); }

ctx.setup();
props.ADMIN_EMAIL = 'admin@exemplo.com';
const admin = ok(api('auth.cadastrar', { nome: 'Admin', email: 'admin@exemplo.com', senha: 'senha-admin-1', cpf: gerarCpf('529982247'), aceite_termos: true }));
const ana = ok(api('auth.cadastrar', { nome: 'Ana', email: 'ana@exemplo.com', senha: 'senha-ana-12', cpf: gerarCpf('111444777'), aceite_termos: true }));
const beto = ok(api('auth.cadastrar', { nome: 'Beto', email: 'beto@exemplo.com', senha: 'senha-beto-1', cpf: gerarCpf('123456789'), aceite_termos: true }));
const TA = admin.token, TANA = ana.token, TBETO = beto.token;

let supino, remada, privado;

teste('admin cria exercício do catálogo geral com vídeo do YouTube', () => {
  supino = ok(api('exercicios.criar', { nome: 'Supino Reto', grupo_muscular: 'Peito', video_url: 'https://youtu.be/dQw4w9WgXcQ?t=10' }, TA));
  assert.strictEqual(supino.global, true);
  assert.strictEqual(supino.video_url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  remada = ok(api('exercicios.criar', { nome: 'Remada Baixa', grupo_muscular: 'Costas' }, TA));
});

teste('vídeo fora do YouTube e nome repetido são recusados', () => {
  assert.strictEqual(api('exercicios.criar', { nome: 'X1', video_url: 'javascript:alert(1)' }, TA).erro.codigo, 'VALIDACAO');
  assert.strictEqual(api('exercicios.criar', { nome: 'X2', video_url: 'https://youtube.com.mal.com/watch?v=dQw4w9WgXcQ' }, TA).erro.codigo, 'VALIDACAO');
  assert.strictEqual(api('exercicios.criar', { nome: 'supino  reto' }, TANA).erro.codigo, 'DUPLICADO');
});

teste('exercício criado pelo aluno é só dele', () => {
  privado = ok(api('exercicios.criar', { nome: 'Prancha com peso', global: true }, TANA));
  assert.strictEqual(privado.global, false);
  assert.ok(ok(api('exercicios.listar', {}, TANA)).some((e) => e.id === privado.id));
  assert.ok(!ok(api('exercicios.listar', {}, TBETO)).some((e) => e.id === privado.id));
  assert.strictEqual(api('exercicios.atualizar', { id: privado.id, nome: 'Roubado' }, TBETO).erro.codigo, 'PROIBIDO');
  assert.strictEqual(api('exercicios.atualizar', { id: supino.id, nome: 'Supino' }, TANA).erro.codigo, 'PROIBIDO');
});

const fichaA = uid(), itemSupino = uid(), itemPrancha = uid();
teste('aluno salva ficha com itens e lê de volta', () => {
  ok(api('fichas.salvar', {
    ficha: { id: fichaA, nome: 'Treino A', ordem: 1 },
    itens: [
      { id: itemSupino, exercicio_id: supino.id, series: 4, reps_prescritas: '12 / 10 / 8 / 6', carga_prescrita_kg: 20, carga_atual_kg: 20, descanso_seg: 90, metodo: 'drop-set' },
      { id: itemPrancha, exercicio_id: privado.id, series: 3, reps_prescritas: '30 s', observacoes: '=1+1' }
    ]
  }, TANA));
  const l = ok(api('fichas.listar', {}, TANA));
  assert.strictEqual(l.limites.plano, 'gratis');
  assert.strictEqual(l.fichas.length, 1);
  assert.deepStrictEqual(l.fichas[0].itens.map((i) => i.id), [itemSupino, itemPrancha]);
  assert.strictEqual(l.fichas[0].itens[1].observacoes, '=1+1');
  assert.strictEqual(planilha.getSheetByName('ficha_itens').formulas.length, 0);
});

teste('ficha não aceita exercício privado de outra pessoa', () => {
  const r = api('fichas.salvar', { ficha: { id: uid(), nome: 'B' }, itens: [{ id: uid(), exercicio_id: privado.id, series: 3 }] }, TBETO);
  assert.strictEqual(r.erro.codigo, 'VALIDACAO');
});

teste('remover item da ficha e reordenar', () => {
  ok(api('fichas.salvar', { ficha: { id: fichaA, nome: 'Treino A' }, itens: [{ id: itemSupino, exercicio_id: supino.id, series: 4, carga_prescrita_kg: 20, carga_atual_kg: 20 }] }, TANA));
  assert.strictEqual(ok(api('fichas.listar', {}, TANA)).fichas[0].itens.length, 1);
});

teste('outra pessoa não altera nem exclui a ficha', () => {
  assert.strictEqual(api('fichas.salvar', { ficha: { id: fichaA, nome: 'Invadida' }, itens: [] }, TBETO).erro.codigo, 'PROIBIDO');
  assert.strictEqual(api('fichas.excluir', { id: fichaA }, TBETO).erro.codigo, 'NAO_ENCONTRADO');
});

teste('plano grátis: no máximo 3 fichas ativas (checado no servidor)', () => {
  ok(api('fichas.salvar', { ficha: { id: uid(), nome: 'B' }, itens: [] }, TANA));
  ok(api('fichas.salvar', { ficha: { id: uid(), nome: 'C' }, itens: [] }, TANA));
  const quarta = uid();
  assert.strictEqual(api('fichas.salvar', { ficha: { id: quarta, nome: 'D' }, itens: [] }, TANA).erro.codigo, 'LIMITE_PLANO');
  ok(api('fichas.salvar', { ficha: { id: quarta, nome: 'D', ativa: false }, itens: [] }, TANA)); // arquivada pode
  assert.strictEqual(ok(api('fichas.listar', {}, TANA)).fichas.length, 4);
});

teste('premium não tem limite de fichas', () => {
  ctx.inserir_('licencas', { usuario_id: beto.perfil.id, origem: 'cortesia', inicio: new Date(Date.now() - 1000).toISOString(), fim: null });
  for (let i = 0; i < 5; i++) ok(api('fichas.salvar', { ficha: { id: uid(), nome: 'F' + i }, itens: [] }, TBETO));
  assert.strictEqual(ok(api('fichas.listar', {}, TBETO)).limites.fichas_ativas, null);
});

teste('"ver como aluno grátis" mostra os limites do grátis e não grava', () => {
  assert.strictEqual(ok(api('fichas.listar', {}, TA, 'aluno_gratis')).limites.plano, 'gratis');
  assert.strictEqual(api('fichas.salvar', { ficha: { id: uid(), nome: 'X' }, itens: [] }, TA, 'aluno_gratis').erro.codigo, 'SOMENTE_LEITURA');
});

const sessao = uid(), s1 = uid(), s2 = uid(), aj = uid();
const lote = () => ({
  sessoes: [{ id: sessao, ficha_id: fichaA, inicio: '2026-11-10T07:00:00-03:00', fim: '2026-11-10T08:05:00-03:00' }],
  series: [
    { id: s1, sessao_id: sessao, exercicio_id: supino.id, ordem: 1, reps: 12, carga_kg: 20 },
    { id: s2, sessao_id: sessao, exercicio_id: supino.id, ordem: 2, reps: 10, carga_kg: 22.5 }
  ],
  ajustes: [{ id: aj, ficha_item_id: itemSupino, campo: 'carga_atual_kg', valor_novo: 22.5 }]
});

teste('treino feito no aparelho é sincronizado; o aluno sobe a própria carga', () => {
  const r = ok(api('treino.sincronizar', lote(), TANA));
  assert.deepStrictEqual(r.sessoes, { criados: 1, atualizados: 0 });
  assert.strictEqual(r.series.criados, 2);
  assert.strictEqual(r.ajustes.criados, 1);
  const item = ok(api('fichas.listar', {}, TANA)).fichas.find((f) => f.id === fichaA).itens[0];
  assert.strictEqual(item.carga_atual_kg, 22.5);
  assert.strictEqual(item.carga_prescrita_kg, 20); // a prescrição do personal continua registrada
  const a = ctx.buscarUm_('ajustes', { id: aj });
  assert.strictEqual(a.valor_anterior, '20');
  assert.strictEqual(a.visto_pelo_personal, false);
});

teste('reenviar o mesmo lote não duplica nada', () => {
  const r = ok(api('treino.sincronizar', lote(), TANA));
  assert.deepStrictEqual(r.sessoes, { criados: 0, atualizados: 1 });
  assert.strictEqual(r.series.criados, 0);
  assert.strictEqual(r.ajustes.ignorados, 1);
  assert.strictEqual(ctx.lerTodos_('series').length, 2);
});

teste('histórico devolve sessões e séries; "desde" traz só o que mudou', () => {
  const h = ok(api('historico.listar', {}, TANA));
  assert.strictEqual(h.sessoes.length, 1);
  assert.strictEqual(h.sessoes[0].inicio, '2026-11-10T10:00:00.000Z');
  assert.strictEqual(h.series.length, 2);
  assert.strictEqual(h.limites.exportar, false);
  const depois = ok(api('historico.listar', { desde: h.servidor_em }, TANA));
  assert.strictEqual(depois.sessoes.length + depois.series.length, 0);
  assert.strictEqual(ok(api('historico.listar', {}, TBETO)).sessoes.length, 0);
});

teste('ninguém grava série ou sessão na conta de outra pessoa', () => {
  const r1 = api('treino.sincronizar', { series: [{ id: uid(), sessao_id: sessao, exercicio_id: supino.id, ordem: 3, carga_kg: 99 }] }, TBETO);
  assert.strictEqual(r1.erro.codigo, 'PROIBIDO');
  const r2 = api('treino.sincronizar', { sessoes: [{ id: sessao, inicio: '2026-11-10T07:00:00-03:00' }] }, TBETO);
  assert.strictEqual(r2.erro.codigo, 'PROIBIDO');
  const r3 = api('treino.sincronizar', { ajustes: [{ id: uid(), ficha_item_id: itemSupino, campo: 'carga_atual_kg', valor_novo: 200 }] }, TBETO);
  assert.strictEqual(r3.erro.codigo, 'PROIBIDO');
  const r4 = api('treino.sincronizar', { ajustes: [{ id: uid(), ficha_item_id: itemSupino, campo: 'carga_prescrita_kg', valor_novo: 200 }] }, TANA);
  assert.strictEqual(r4.erro.codigo, 'VALIDACAO'); // o aluno muda a carga atual, não a prescrita
});

teste('valores estranhos são recusados', () => {
  const ruins = [
    { sessoes: [{ id: 'curto', inicio: '2026-11-10T07:00:00Z' }] },
    { sessoes: [{ id: uid(), inicio: 'ontem' }] },
    { series: [{ id: uid(), sessao_id: sessao, exercicio_id: supino.id, ordem: 1, carga_kg: -5 }] },
    { series: [{ id: uid(), sessao_id: sessao, exercicio_id: supino.id, ordem: 1, tipo: '<b>' }] },
    { sessoes: 'não é lista' }
  ];
  ruins.forEach((d) => assert.strictEqual(api('treino.sincronizar', d, TANA).erro.codigo, 'VALIDACAO', JSON.stringify(d)));
});

teste('excluir série pelo aparelho (exclusão lógica)', () => {
  ok(api('treino.sincronizar', { series: [{ id: s2, sessao_id: sessao, exercicio_id: supino.id, ordem: 2, excluido: true }] }, TANA));
  assert.strictEqual(ok(api('historico.listar', {}, TANA)).series.length, 1);
});

// ---------- importação ----------

function planilhaAntigaPequena() {
  const d = (s) => new Date(s + '-03:00');
  return {
    PLANO_ATUAL: [
      ['id_exercicio', 'divisao', 'ordem', 'grupo_muscular', 'nome_exercicio', 'series', 'repeticoes', 'carga_sugerida', 'intervalo_seg', 'metodo_avancado', 'link_video', 'observacoes'],
      ['T_A_01', 'A', 1, 'Peito', 'Supino Reto', 3, '6 / 8 / 12', '', 90, 'Drop-set', '', 'Drop-set'],
      ['T_A_02', 'A', 2, 'Tríceps', 'Tríceps Corda', 3, '10 + 10', '', 45, 'Rest-pause', '', ''],
      ['T_B_01', 'B', 1, 'Pernas', 'Cadeira Extensora', 3, 15, '', 60, '', '', ''],
      ['T_B_02', 'B', 2, 'Cardio', 'Esteira', 1, '15-20 min', '', 0, '', '', '']
    ],
    LOGS_TREINO: [
      ['data_hora', 'divisao_realizada', 'id_exercicio', 'nome_exercicio', 'carga_utilizada', 'series_feitas', 'percepcao_esforco'],
      [d('2026-01-19T22:48:59'), 'A', 'T_A_01', 'Supino Reto', '30kg / 25.5kg / -', 3, ''],
      [d('2026-01-19T22:48:59'), 'A', 'T_A_02', 'Tríceps Corda', '16.2510kg / 16.512kg / 9.7kg', 3, ''],
      [d('2026-01-21T18:00:00'), 'B', 'T_B_01', 'Cadeira Extensora', '65.10kg / 65kg / 60kg', 3, ''],
      [d('2026-01-21T18:00:00'), 'B', 'T_B_02', 'Esteira', 0, 1, ''],
      [d('2026-01-23T07:10:00'), 'A', 'T_A_01', 'Supino Reto', '32.5kg / 30kg / 25kg', 3, '']
    ]
  };
}

teste('cargas da planilha antiga: carga e repetições juntas são separadas', () => {
  const c = (t) => JSON.parse(JSON.stringify(ctx.lerCargaAntiga_(t, true)));
  assert.deepStrictEqual(c('42.510kg'), { carga: 42.5, reps: 10, situacao: 'separado' });
  assert.deepStrictEqual(c('16.2510kg'), { carga: 16.25, reps: 10, situacao: 'separado' });
  assert.deepStrictEqual(c('42.509kg'), { carga: 42.5, reps: 9, situacao: 'separado' });
  assert.deepStrictEqual(c('40.10kg'), { carga: 40, reps: 10, situacao: 'separado' });
  assert.deepStrictEqual(c('11.25kg'), { carga: 11.25, reps: null, situacao: 'ok' });
  assert.deepStrictEqual(c('25.5kg'), { carga: 25.5, reps: null, situacao: 'ok' });
  assert.deepStrictEqual(c('-'), { carga: null, reps: null, situacao: 'vazio' });
  assert.strictEqual(c('9.7kg').situacao, 'revisar');
  assert.strictEqual(c('47.51kg').situacao, 'revisar');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.lerCargaAntiga_('42.510kg', false))), { carga: 42.51, reps: null, situacao: 'revisar' });
});

teste('importação: prévia não grava nada', () => {
  criarOutraPlanilha('planilha-antiga-pequena-000000', planilhaAntigaPequena(), 'America/Sao_Paulo');
  const antes = ctx.lerTodos_('sessoes').length;
  const p = ok(api('admin.importar.previa', { planilha_id: 'planilha-antiga-pequena-000000', email: 'ana@exemplo.com' }, TA));
  assert.strictEqual(p.resumo.sessoes, 3);
  assert.strictEqual(p.resumo.series, 13);
  assert.strictEqual(p.resumo.exercicios_existentes, 1); // Supino Reto já estava no catálogo
  assert.strictEqual(p.resumo.periodo.de, '2026-01-20T01:48:59.000Z');
  assert.strictEqual(p.cargas_separadas.length, 3);
  assert.deepStrictEqual(p.cargas_para_revisar.map((x) => x.texto), ['9.7kg']);
  assert.strictEqual(ctx.lerTodos_('sessoes').length, antes);
  assert.strictEqual(api('admin.importar.previa', { planilha_id: 'planilha-antiga-pequena-000000', email: 'ana@exemplo.com' }, TANA).erro.codigo, 'PROIBIDO');
});

teste('importação grava fichas, histórico e licença; rodar de novo não duplica', () => {
  const args = { planilha_id: 'planilha-antiga-pequena-000000', email: 'beto@exemplo.com' };
  const r = ok(api('admin.importar.executar', args, TA));
  assert.strictEqual(r.gravado.sessoes.criados, 3);
  assert.strictEqual(r.gravado.fichas.criados, 2);
  const f = ok(api('fichas.listar', {}, TBETO)).fichas.filter((x) => x.nome.startsWith('Treino '));
  const a = f.find((x) => x.nome === 'Treino A');
  assert.strictEqual(a.itens[0].carga_atual_kg, 32.5); // maior carga do último treino A
  assert.strictEqual(a.itens[0].metodo, 'drop-set');
  assert.strictEqual(a.itens[1].reps_prescritas, '10 + 10');
  const h = ok(api('historico.listar', {}, TBETO));
  const corda = h.series.filter((s) => s.carga_kg === 16.25);
  assert.strictEqual(corda[0].reps, 10);
  const de2 = ok(api('admin.importar.executar', args, TA));
  assert.strictEqual(de2.gravado.sessoes.criados, 0);
  assert.strictEqual(de2.gravado.series.criados, 0);
  assert.strictEqual(de2.gravado.licenca, 'já existia');
  assert.strictEqual(ok(api('historico.listar', {}, TBETO)).sessoes.length, 3);
});

teste('nenhuma aba recebeu fórmula; nenhum erro inesperado', () => {
  planilha.abas.forEach((a) => assert.strictEqual(a.formulas.length, 0, a.nome));
  assert.strictEqual(ctx._erros.length, 0, ctx._erros.join('\n'));
});

// Planilha real (só na máquina de quem tem o arquivo; não vai para o GitHub)
const real = path.join(__dirname, 'planilha-antiga.local.json');
if (fs.existsSync(real)) {
  teste('importação da planilha real (prévia e gravação)', () => {
    const j = JSON.parse(fs.readFileSync(real, 'utf8'));
    const abas = {};
    Object.keys(j).forEach((n) => {
      abas[n] = j[n].map((l) => l.map((v) => (v && v.$data ? new Date(v.$data + '-03:00') : v)));
    });
    criarOutraPlanilha('planilha-antiga-real-0000000000', abas, 'America/Sao_Paulo');
    const args = { planilha_id: 'planilha-antiga-real-0000000000', email: 'admin@exemplo.com' };
    const p = ok(api('admin.importar.previa', args, TA));
    fs.writeFileSync(path.join(__dirname, 'previa-importacao.local.json'), JSON.stringify(p, null, 2));
    console.log('    ' + JSON.stringify(p.resumo));
    console.log('    separadas: ' + p.cargas_separadas.length + ' tipos; para revisar: ' + p.cargas_para_revisar.map((x) => x.texto + ' (' + x.exercicio + ')').join(', '));
    const inicio = Date.now();
    const r = ok(api('admin.importar.executar', args, TA));
    console.log('    gravado em ' + (Date.now() - inicio) + ' ms: ' + JSON.stringify(r.gravado));
    assert.strictEqual(r.gravado.sessoes.criados, p.resumo.sessoes);
  });
}

console.log(`\n${passou} testes passaram.`);
