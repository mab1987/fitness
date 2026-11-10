import { test } from 'node:test';
import assert from 'node:assert';
import { cpfValido, formatarCpf, soDigitos } from '../src/servicos/cpf.js';

test('CPFs válidos e inválidos', () => {
  assert.ok(cpfValido('529.982.247-25'));
  assert.ok(cpfValido('11144477735'));
  assert.ok(!cpfValido('529.982.247-24'));
  assert.ok(!cpfValido('111.111.111-11'));
  assert.ok(!cpfValido('123'));
});

test('máscara do CPF', () => {
  assert.strictEqual(formatarCpf('52998224725'), '529.982.247-25');
  assert.strictEqual(formatarCpf('5299'), '529.9');
  assert.strictEqual(soDigitos('abc529.982.247-2599'), '52998224725');
});
