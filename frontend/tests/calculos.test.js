import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  repsPorSerie, planejarSeries, sugestaoProgresso, proximaFicha, umaRepeticao, pontosExercicio, idYoutube, kg, lerNumero,
} from '../src/servicos/calculos.js';

test('repetições por série a partir do texto da ficha', () => {
  assert.deepEqual(repsPorSerie('6 / 8 / 12', 3), [6, 8, 12]);
  assert.deepEqual(repsPorSerie('15 / 12 / 10 / 8', 4), [15, 12, 10, 8]);
  assert.deepEqual(repsPorSerie('12', 3), [12, 12, 12]);
  assert.deepEqual(repsPorSerie('10 + 10', 2), [10, 10]);
  assert.deepEqual(repsPorSerie('Máxima', 2), [null, null]);
  assert.deepEqual(repsPorSerie('15-20 min', 1), [null]);
  assert.deepEqual(repsPorSerie('12 / 10', 3), [12, 10, 10]);
});

test('números e kg no jeito brasileiro', () => {
  assert.equal(lerNumero('42,5'), 42.5);
  assert.equal(lerNumero(''), null);
  assert.equal(lerNumero('abc'), null);
  assert.equal(kg(42.5), '42,5');
  assert.equal(kg(40), '40');
  assert.equal(kg(null), '–');
});

const item = { id: 'i1', exercicio_id: 'e1', series: 3, reps_prescritas: '6 / 8 / 12', carga_atual_kg: 30, carga_prescrita_kg: 25 };

test('séries do dia vêm da última vez; sem histórico, da ficha', () => {
  const sem = planejarSeries(item, null);
  assert.deepEqual(sem.map((s) => [s.carga, s.reps]), [[30, 6], [30, 8], [30, 12]]);
  const ultima = { series: [{ carga_kg: 32.5, reps: 6 }, { carga_kg: 25, reps: 8 }] };
  const com = planejarSeries(item, ultima);
  assert.deepEqual(com.map((s) => [s.carga, s.reps]), [[32.5, 6], [25, 8], [30, 12]]);
  assert.deepEqual(com[0].antes, { carga: 32.5, reps: 6 });
});

test('sugere subir a carga quando o aluno usou mais', () => {
  const s = [{ carga: 32.5, reps: 6, feita: true }, { carga: 30, reps: 8, feita: true }, { carga: 30, reps: 12, feita: true }];
  assert.deepEqual(sugestaoProgresso(item, s), { campo: 'carga_atual_kg', valor: 32.5, anterior: 30 });
  const iguais = [{ carga: 30, reps: 8, feita: true }, { carga: 30, reps: 10, feita: true }, { carga: 30, reps: 14, feita: true }];
  assert.deepEqual(sugestaoProgresso(item, iguais), { campo: 'reps_atuais', valor: '8 / 10 / 14', anterior: '6 / 8 / 12' });
  assert.equal(sugestaoProgresso(item, [{ carga: 30, reps: 6, feita: true }]), null);
});

test('próxima ficha segue a ordem e volta ao começo', () => {
  const fichas = [{ id: 'a', ordem: 1, ativa: true }, { id: 'b', ordem: 2, ativa: true }, { id: 'c', ordem: 3, ativa: false }];
  assert.equal(proximaFicha(fichas, { sessoes: [] }).id, 'a');
  assert.equal(proximaFicha(fichas, { sessoes: [{ ficha_id: 'a', inicio: '2026-01-01' }] }).id, 'b');
  assert.equal(proximaFicha(fichas, { sessoes: [{ ficha_id: 'b', inicio: '2026-01-02' }, { ficha_id: 'a', inicio: '2026-01-01' }] }).id, 'a');
});

test('1RM de Epley e pontos do gráfico', () => {
  assert.equal(umaRepeticao(100, 10), 133.3);
  assert.equal(umaRepeticao(100, 1), 100);
  assert.equal(umaRepeticao(100, 20), null);
  const h = {
    sessoes: [{ id: 's1', inicio: '2026-01-01T10:00:00Z' }, { id: 's2', inicio: '2026-02-01T10:00:00Z' }],
    series: [
      { sessao_id: 's1', exercicio_id: 'e1', carga_kg: 30, reps: 10 },
      { sessao_id: 's1', exercicio_id: 'e1', carga_kg: 35, reps: 6 },
      { sessao_id: 's2', exercicio_id: 'e1', carga_kg: 40, reps: null },
      { sessao_id: 's2', exercicio_id: 'e2', carga_kg: 99, reps: 1 },
    ],
  };
  assert.deepEqual(pontosExercicio(h, 'e1').map((p) => p.valor), [35, 40]);
  assert.deepEqual(pontosExercicio(h, 'e1', '1rm').map((p) => p.valor), [42]);
  assert.deepEqual(pontosExercicio(h, 'e1', 'carga', '2026-01-15').map((p) => p.valor), [40]);
});

test('links do YouTube', () => {
  assert.equal(idYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1'), 'dQw4w9WgXcQ');
  assert.equal(idYoutube('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(idYoutube('https://youtube.com.mal.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(idYoutube('javascript:alert(1)'), null);
});

import { sugestaoCarga, celulaCsv, gerarCsv, treinosPorSemana } from '../src/servicos/calculos.js';

const hist = (vezes) => ({
  sessoes: vezes.map((_, i) => ({ id: 's' + i, inicio: `2026-11-${String(10 + i).padStart(2, '0')}T10:00:00Z` })),
  series: vezes.flatMap((ser, i) => ser.map(([carga_kg, reps, rpe], j) => ({ sessao_id: 's' + i, exercicio_id: 'e1', ordem: j + 1, carga_kg, reps, rpe: rpe ?? null }))),
});
const it = { exercicio_id: 'e1', series: 3, reps_prescritas: '12' };

test('sugestão básica: bateu a meta sobe; abaixo duas vezes desce; senão mantém', () => {
  assert.equal(sugestaoCarga(it, hist([[[40, 12], [40, 12], [40, 12]]])).carga, 42.5);
  assert.match(sugestaoCarga(it, hist([[[40, 12], [40, 12], [40, 12]]])).motivo, /12\/12\/12/);
  assert.equal(sugestaoCarga(it, hist([[[40, 12], [40, 11], [40, 12]]])), null);
  assert.equal(sugestaoCarga(it, hist([[[40, 10], [40, 9], [40, 8]], [[40, 11], [40, 10], [40, 9]]])).carga, 37.5);
  assert.equal(sugestaoCarga({ ...it, sugestao: 'desligada' }, hist([[[40, 12], [40, 12], [40, 12]]])), null);
  assert.equal(sugestaoCarga({ ...it, incremento_kg: 5 }, hist([[[40, 12], [40, 12], [40, 12]]])).carga, 45);
  assert.equal(sugestaoCarga({ ...it, carga_prescrita_kg: 40, aumento_max_kg: 1 }, hist([[[40, 12], [40, 12], [40, 12]]])).carga, 41);
  assert.equal(sugestaoCarga(it, hist([[[null, 12]]])), null);
});

test('sugestão com esforço (RPE) só no premium', () => {
  const h = hist([[[40, 12, 7], [40, 12, 7], [40, 12, 7]]]);
  assert.equal(sugestaoCarga(it, h, { premium: true }).carga, 45);
  assert.equal(sugestaoCarga(it, h, { premium: false }).carga, 42.5);
  assert.equal(sugestaoCarga(it, hist([[[40, 12, 9], [40, 12, 9]]]), { premium: true }), null);
  assert.equal(sugestaoCarga(it, hist([[[40, 8, 10], [40, 8, 10]]]), { premium: true }).carga, 37.5);
});

test('CSV seguro e no formato brasileiro', () => {
  assert.equal(celulaCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(celulaCsv('+1'), "'+1");
  assert.equal(celulaCsv(42.5), '42,5');
  assert.equal(celulaCsv(-3), '-3');
  assert.equal(celulaCsv('a;b'), '"a;b"');
  assert.equal(gerarCsv(['a', 'b'], [[1, 'x']]), '﻿a;b\r\n1;x');
});

test('treinos por semana', () => {
  const l = treinosPorSemana([{ inicio: new Date().toISOString() }, { inicio: new Date().toISOString() }], 4);
  assert.equal(l.length, 4);
  assert.equal(l[3].treinos, 2);
});
