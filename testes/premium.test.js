// Testes da Fase 3 (Pix, pedidos, licenças, programas, medidas, exportação). Rode: node testes/premium.test.js
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
const json = (x) => JSON.parse(JSON.stringify(x));

let passou = 0;
function teste(nome, fn) { fn(); passou++; console.log('ok  ' + nome); }

ctx.setup();
props.ADMIN_EMAIL = 'admin@exemplo.com';
const conta = (nome, email, base) => ok(api('auth.cadastrar', { nome, email, senha: 'senha-' + nome + '-1', cpf: gerarCpf(base), aceite_termos: true }));
const admin = conta('Admin', 'admin@exemplo.com', '529982247');
const pedro = conta('Pedro', 'pedro@exemplo.com', '111444777');
const ana = conta('Ana', 'ana@exemplo.com', '123456789');
const beto = conta('Beto', 'beto@exemplo.com', '987654321');
const [TA, TP, TANA, TB] = [admin.token, pedro.token, ana.token, beto.token];
const plano = (t) => ok(api('perfil.ler', {}, t)).plano;

teste('setup cria a tabela de preços simbólica uma vez só', () => {
  const p = ok(api('admin.precos', {}, TA));
  assert.strictEqual(p.length, 8);
  assert.strictEqual(p.find((x) => x.id === 'preco_aluno_mensal').valor, 4.9);
  ctx.setup();
  assert.strictEqual(ok(api('admin.precos', {}, TA)).length, 8);
  assert.deepStrictEqual(ok(api('precos.listar', {}, TANA)).map((x) => x.publico), ['aluno', 'aluno', 'aluno', 'aluno']);
});

teste('Pix: CRC confere com o exemplo do Banco Central', () => {
  const ex = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.strictEqual(ctx.crc16_(ex), '1D3D');
  const pix = ctx.pixCopiaECola_('fulano@exemplo.com', 'José da Silva', 'Fortaleza', 4.9, 'MTABCD2345');
  assert.ok(pix.includes('0014br.gov.bcb.pix0118fulano@exemplo.com'));
  assert.ok(pix.includes('54044.90') && pix.includes('5913JOSE DA SILVA') && pix.includes('6009FORTALEZA'));
  assert.ok(pix.includes('62140510MTABCD2345'));
  assert.strictEqual(ctx.crc16_(pix.slice(0, -4)), pix.slice(-4));
});

teste('sem chave Pix cadastrada a compra fica indisponível', () => {
  assert.strictEqual(erro(api('pedidos.criar', { periodo: 'mensal' }, TANA)), 'INDISPONIVEL');
  assert.strictEqual(erro(api('admin.config.salvar', { chave_pix: '=HYPERLINK("x")' }, TA)), 'VALIDACAO');
  ok(api('admin.config.salvar', { chave_pix: 'pix@exemplo.com', nome_recebedor: 'Matheus Barbosa', cidade: 'João Pessoa' }, TA));
  assert.strictEqual(erro(api('admin.config.salvar', { chave_pix: 'x' }, TANA)), 'PROIBIDO');
});

let pedidoAna;
teste('aluna compra: valor vem do servidor, Pix copia e cola pronto', () => {
  pedidoAna = ok(api('pedidos.criar', { periodo: 'trimestral', quantidade: 50, valor: 0.01 }, TANA));
  assert.strictEqual(pedidoAna.valor, 12.9);
  assert.strictEqual(pedidoAna.quantidade, 1);
  assert.match(pedidoAna.codigo_referencia, /^MT[A-Z2-9]{8}$/);
  assert.ok(pedidoAna.pix.includes('540512.90') && pedidoAna.pix.includes(pedidoAna.codigo_referencia));
  assert.strictEqual(ok(api('pedidos.paguei', { id: pedidoAna.id }, TANA)).status, 'informado');
  assert.strictEqual(erro(api('pedidos.paguei', { id: pedidoAna.id }, TB)), 'NAO_ENCONTRADO');
});

teste('admin muda o preço depois: pedido antigo continua com o valor da compra', () => {
  ok(api('admin.precos.salvar', { precos: [{ id: 'preco_aluno_trimestral', valor: 19.9, ativo: true }] }, TA));
  assert.strictEqual(ok(api('licencas.minhas', {}, TANA)).pedidos[0].valor, 12.9);
});

teste('liberar cria o premium; segunda compra soma ao fim atual', () => {
  assert.strictEqual(plano(TANA).tipo, 'gratis');
  const r = ok(api('admin.pedido.liberar', { id: pedidoAna.id }, TA));
  const p1 = plano(TANA);
  assert.strictEqual(p1.tipo, 'premium');
  assert.ok(p1.dias_restantes >= 89 && p1.dias_restantes <= 93, String(p1.dias_restantes));
  assert.strictEqual(erro(api('admin.pedido.liberar', { id: pedidoAna.id }, TA)), 'VALIDACAO');
  const p2 = ok(api('pedidos.criar', { periodo: 'mensal' }, TANA));
  ok(api('admin.pedido.liberar', { id: p2.id }, TA));
  const fim = new Date(r.licenca.fim);
  const novoFim = new Date(ok(api('licencas.minhas', {}, TANA)).plano.fim);
  const meses = (novoFim.getUTCFullYear() - fim.getUTCFullYear()) * 12 + novoFim.getUTCMonth() - fim.getUTCMonth();
  assert.strictEqual(meses, 1);
  const aud = planilha.getSheetByName('auditoria').dados.map((l) => l[2]);
  assert.ok(aud.includes('pedido.liberar'));
});

teste('no máximo 3 pedidos em aberto; cancelar libera', () => {
  const ids = [1, 2, 3].map(() => ok(api('pedidos.criar', { periodo: 'mensal' }, TB)).id);
  assert.strictEqual(erro(api('pedidos.criar', { periodo: 'mensal' }, TB)), 'LIMITE');
  ok(api('pedidos.cancelar', { id: ids[0] }, TB));
  ok(api('pedidos.criar', { periodo: 'mensal' }, TB));
  ok(api('admin.pedido.cancelar', { id: ids[1], observacao: 'valor diferente' }, TA));
});

teste('expirou: volta ao grátis e fichas além de 3 ficam bloqueadas', () => {
  const ids = [1, 2, 3, 4, 5].map(() => uid());
  ids.forEach((id, i) => ok(api('fichas.salvar', { ficha: { id, nome: 'F' + i, ordem: i + 1 }, itens: [] }, TANA)));
  // força o vencimento
  ctx.lerTodos_('licencas').filter((l) => l.usuario_id === ana.perfil.id).forEach((l) => ctx.atualizar_('licencas', l.id, { fim: new Date(Date.now() - 1000).toISOString() }));
  assert.strictEqual(plano(TANA).tipo, 'gratis');
  const f = ok(api('fichas.listar', {}, TANA)).fichas;
  assert.deepStrictEqual(f.map((x) => x.bloqueada), [false, false, false, true, true]);
  ok(api('fichas.salvar', { ficha: { id: ids[0], nome: 'F0 editada', ordem: 1 }, itens: [] }, TANA)); // das 3 primeiras: pode
  assert.strictEqual(erro(api('fichas.salvar', { ficha: { id: ids[4], nome: 'F4', ordem: 5 }, itens: [] }, TANA)), 'LIMITE_PLANO');
  ok(api('fichas.salvar', { ficha: { id: ids[4], nome: 'F4', ordem: 5, ativa: false }, itens: [] }, TANA)); // arquivar pode
  assert.strictEqual(ok(api('historico.listar', {}, TANA)).sessoes.length, 0);
});

teste('cortesia: por dias, até uma data e sem prazo; revogar', () => {
  const c = ok(api('admin.cortesia', { usuario_id: beto.perfil.id, modo: 'dias', dias: 10 }, TA));
  assert.strictEqual(plano(TB).dias_restantes, 10);
  ok(api('admin.licenca.revogar', { id: c.id }, TA));
  assert.strictEqual(plano(TB).tipo, 'gratis');
  assert.strictEqual(erro(api('admin.cortesia', { usuario_id: beto.perfil.id, modo: 'ate', ate: '2020-01-01T00:00:00Z' }, TA)), 'VALIDACAO');
  ok(api('admin.cortesia', { usuario_id: beto.perfil.id, modo: 'sem_prazo' }, TA));
  assert.strictEqual(plano(TB).fim, null);
  assert.strictEqual(erro(api('admin.cortesia', { usuario_id: beto.perfil.id, modo: 'sem_prazo' }, TANA)), 'PROIBIDO');
});

teste('personal: compra lote, admin dá lote, atribui a aluna vinculada', () => {
  ok(api('admin.usuario.atualizar', { usuario_id: pedro.perfil.id, personal_ativo: true }, TA));
  assert.strictEqual(ok(api('precos.listar', {}, TP)).length, 8);
  const ped = ok(api('pedidos.criar', { tipo: 'personal', periodo: 'mensal', quantidade: 3 }, TP));
  assert.strictEqual(ped.valor, 10.2);
  assert.strictEqual(erro(api('pedidos.criar', { tipo: 'personal', periodo: 'mensal', quantidade: 2 }, TANA)), 'PROIBIDO');
  ok(api('admin.pedido.liberar', { id: ped.id }, TA));
  ok(api('admin.lote', { personal_id: pedro.perfil.id, quantidade: 2, modo: 'dias', dias: 45 }, TA));
  assert.strictEqual(ok(api('personal.licencas', {}, TP)).saldo.length, 5);
  assert.strictEqual(erro(api('personal.atribuir', { aluno_id: ana.perfil.id }, TP)), 'PROIBIDO'); // ainda não é aluna dele
  ok(api('convites.aceitar', { codigo: ok(api('convites.criar', { tipo: 'personal' }, TP)).codigo }, TANA));
  const r = ok(api('personal.atribuir', { aluno_id: ana.perfil.id }, TP));
  assert.strictEqual(r.aluno, 'Ana');
  assert.strictEqual(plano(TANA).tipo, 'premium');
  assert.strictEqual(plano(TANA).origem, 'personal');
  const saldo = ok(api('personal.licencas', {}, TP)).saldo;
  assert.strictEqual(saldo.filter((s) => !s.atribuida_a).length, 4);
  assert.strictEqual(saldo.find((s) => s.atribuida_a).aluno_nome, 'Ana');
});

let ex1, ex2, programa;
teste('programas: admin publica para todos; grátis vê com cadeado os premium', () => {
  ex1 = ok(api('exercicios.criar', { nome: 'Agachamento', grupo_muscular: 'Pernas' }, TA));
  ex2 = ok(api('exercicios.criar', { nome: 'Supino', grupo_muscular: 'Peito' }, TA));
  const fichas = ['A', 'B', 'C', 'D'].map((n) => ({ id: uid(), nome: 'Treino ' + n, itens: [{ id: uid(), exercicio_id: ex1.id, series: 3, reps_prescritas: '12' }, { id: uid(), exercicio_id: ex2.id, series: 3, reps_prescritas: '10' }] }));
  programa = ok(api('programas.salvar', { programa: { id: uid(), nome: 'Hipertrofia ABCD', publico: 'todos', gratis: false, nivel: 'intermediario', dias_semana: 4 }, fichas }, TA));
  ok(api('programas.salvar', { programa: { id: uid(), nome: 'Iniciante', publico: 'todos', gratis: true }, fichas: [fichas[0]].map((f) => ({ ...f, id: uid(), itens: f.itens.map((i) => ({ ...i, id: uid() })) })) }, TA));
  const vistos = ok(api('programas.listar', {}, TB)); // Beto: premium sem prazo
  assert.strictEqual(vistos.length, 2);
  const gratis = ok(api('programas.listar', {}, TA, 'aluno_gratis'));
  const h = gratis.find((p) => p.nome === 'Hipertrofia ABCD');
  assert.strictEqual(h.bloqueado, true);
  assert.strictEqual(h.fichas[0].itens, undefined);
  assert.strictEqual(erro(api('programas.salvar', { programa: { id: uid(), nome: 'Do Pedro', publico: 'todos' }, fichas }, TP)), 'PROIBIDO');
});

teste('programa público não aceita exercício próprio', () => {
  const meu = ok(api('exercicios.criar', { nome: 'Exercício do Pedro' }, TP));
  const fichas = [{ id: uid(), nome: 'P', itens: [{ id: uid(), exercicio_id: meu.id, series: 3 }] }];
  ok(api('programas.salvar', { programa: { id: uid(), nome: 'Privado do Pedro', publico: 'privado' }, fichas }, TP));
  ok(api('admin.grupos.criar', { nome: 'Grupo P', gerente_email: 'pedro@exemplo.com' }, TA));
  const g = ok(api('grupos.listar', {}, TP))[0];
  const r = api('programas.salvar', { programa: { id: uid(), nome: 'Do grupo', publico: 'grupo', grupo_id: g.id }, fichas: [{ id: uid(), nome: 'P', itens: [{ id: uid(), exercicio_id: meu.id, series: 3 }] }] }, TP);
  assert.strictEqual(erro(r), 'VALIDACAO');
  assert.match(r.erro.mensagem, /exercício próprio/);
});

teste('usar programa copia fichas; no grátis, além de 3 ficam arquivadas', () => {
  const r = ok(api('programas.usar', { id: programa.id }, TB));
  assert.deepStrictEqual(json(r), { fichas: 4, arquivadas: 0 });
  // Ana está premium pela licença do personal; Pedro aplica o programa nela
  const r2 = ok(api('programas.usar', { id: programa.id, aluno_id: ana.perfil.id }, TP));
  assert.strictEqual(r2.fichas, 4);
  const fAna = ok(api('fichas.listar', {}, TANA)).fichas.filter((f) => f.nome.startsWith('Treino '));
  assert.ok(fAna.every((f) => f.prescrita && f.autor_nome === 'Pedro'));
  assert.strictEqual(erro(api('programas.usar', { id: programa.id }, TA, 'aluno_gratis')), 'SOMENTE_LEITURA');
});

teste('medidas: grátis só peso; premium todas; personal registra para a aluna', () => {
  const gil = conta('Gil', 'gil@exemplo.com', '456789123');
  assert.strictEqual(erro(api('medidas.salvar', { medida: { id: uid(), data: '2026-11-15T08:00:00-03:00', peso_kg: 80, cintura_cm: 90 } }, gil.token)), 'LIMITE_PLANO');
  ok(api('medidas.salvar', { medida: { id: uid(), data: '2026-11-15T08:00:00-03:00', peso_kg: 80.5 } }, gil.token));
  assert.strictEqual(erro(api('medidas.salvar', { medida: { id: uid(), data: '2026-11-15T08:00:00-03:00', peso_kg: 5000 } }, gil.token)), 'VALIDACAO');
  ok(api('medidas.salvar', { aluno_id: ana.perfil.id, medida: { id: uid(), data: '2026-11-14T08:00:00-03:00', peso_kg: 61, cintura_cm: 70, gordura_pct: 22, observacao: '=1+1' } }, TP));
  const m = ok(api('medidas.listar', {}, TANA));
  assert.strictEqual(m[0].cintura_cm, 70);
  assert.strictEqual(m[0].observacao, '=1+1');
  assert.strictEqual(erro(api('medidas.listar', { aluno_id: ana.perfil.id }, TB)), 'PROIBIDO');
});

teste('exportação: premium e personal sim; grátis não', () => {
  const e = ok(api('exportar', {}, TB));
  assert.deepStrictEqual(e.series.colunas.slice(0, 3), ['data_hora', 'ficha', 'exercicio']);
  ok(api('exportar', { aluno_id: ana.perfil.id }, TP));
  assert.strictEqual(erro(api('exportar', {}, TA, 'aluno_gratis')), 'LIMITE_PLANO');
});

teste('grátis usando programa grátis com 4 fichas: 3 ativas e 1 arquivada', () => {
  const fichas = ['A', 'B', 'C', 'D'].map((n) => ({ id: uid(), nome: 'G' + n, itens: [{ id: uid(), exercicio_id: ex1.id, series: 3 }] }));
  const p = ok(api('programas.salvar', { programa: { id: uid(), nome: 'Grátis ABCD', publico: 'todos', gratis: true }, fichas }, TA));
  const gil = ok(api('auth.entrar', { login: 'gil@exemplo.com', senha: 'senha-Gil-1' }));
  assert.deepStrictEqual(json(ok(api('programas.usar', { id: p.id }, gil.token))), { fichas: 4, arquivadas: 1 });
  assert.strictEqual(ok(api('fichas.listar', {}, gil.token)).fichas.filter((f) => f.ativa).length, 3);
});

teste('nenhuma fórmula; nenhum erro inesperado', () => {
  planilha.abas.forEach((a) => assert.strictEqual(a.formulas.length, 0, a.nome));
  assert.strictEqual(ctx._erros.length, 0, ctx._erros.join('\n'));
});

console.log(`\n${passou} testes passaram.`);
