/**
 * Modelo de dados: cada aba da planilha é uma tabela.
 * Linha 1 = nomes das colunas. Tipos: t = texto, n = número, b = verdadeiro/falso, d = data (ISO, UTC).
 * Os nomes de tabelas e colunas são os mesmos que serão usados no Supabase.
 */
var COMUNS_ = { criado_em: 'd', atualizado_em: 'd', excluido_em: 'd' };

var ESQUEMA = {
  usuarios: {
    id: 't', email: 't', usuario: 't', hash_senha: 't', cpf_hash: 't', cpf_mascarado: 't', nome: 't',
    admin: 'b', personal_ativo: 'b', ativo: 'b', tema: 't', paleta: 't', aceite_termos_em: 'd'
  },
  sessoes_login: { id: 't', usuario_id: 't', token_hash: 't', expira_em: 'd', revogada_em: 'd' },
  recuperacoes_senha: { id: 't', usuario_id: 't', token_hash: 't', expira_em: 'd', usado_em: 'd' },
  grupos: { id: 't', nome: 't', descricao: 't' },
  membros_grupo: { id: 't', grupo_id: 't', usuario_id: 't', papel: 't' },
  vinculos_personal: { id: 't', personal_id: 't', aluno_id: 't', status: 't', inicio: 'd', fim: 'd' },
  convites: {
    id: 't', codigo_hash: 't', final_codigo: 't', tipo: 't', criado_por: 't', grupo_id: 't', papel: 't',
    expira_em: 'd', usos_max: 'n', usos: 'n', revogado_em: 'd'
  },
  exercicios: { id: 't', nome: 't', grupo_muscular: 't', equipamento: 't', video_url: 't', criado_por: 't', global: 'b', status: 't' },
  fichas: { id: 't', aluno_id: 't', autor_id: 't', nome: 't', ordem: 'n', ativa: 'b' },
  ficha_itens: {
    id: 't', ficha_id: 't', exercicio_id: 't', ordem: 'n', series: 'n', reps_prescritas: 't',
    reps_min: 'n', reps_max: 'n', carga_prescrita_kg: 'n', aumento_max_kg: 'n', carga_atual_kg: 'n',
    reps_atuais: 't', descanso_seg: 'n', metodo: 't', observacoes: 't', sugestao: 't', incremento_kg: 'n'
  },
  sessoes: { id: 't', aluno_id: 't', ficha_id: 't', inicio: 'd', fim: 'd', observacao: 't' },
  series: { id: 't', sessao_id: 't', exercicio_id: 't', ordem: 'n', tipo: 't', reps: 'n', carga_kg: 'n', rpe: 'n' },
  ajustes: {
    id: 't', ficha_item_id: 't', aluno_id: 't', campo: 't', valor_anterior: 't', valor_novo: 't', visto_pelo_personal: 'b'
  },
  comentarios: { id: 't', sessao_id: 't', aluno_id: 't', autor_id: 't', texto: 't', visto: 'b' },
  medidas: {
    id: 't', aluno_id: 't', autor_id: 't', data: 'd', peso_kg: 'n', gordura_pct: 'n', peito_cm: 'n', cintura_cm: 'n',
    abdomen_cm: 'n', quadril_cm: 'n', braco_d_cm: 'n', braco_e_cm: 'n', coxa_d_cm: 'n', coxa_e_cm: 'n',
    panturrilha_cm: 'n', observacao: 't'
  },
  configuracoes: { id: 't', valor: 't' },
  precos: { id: 't', periodo: 't', publico: 't', valor: 'n', ativo: 'b' },
  pedidos: {
    id: 't', comprador_id: 't', tipo: 't', periodo: 't', quantidade: 'n', valor: 'n', codigo_referencia: 't',
    status: 't', pago_informado_em: 'd', liberado_em: 'd', liberado_por: 't', observacao: 't'
  },
  licencas: { id: 't', usuario_id: 't', origem: 't', inicio: 'd', fim: 'd', concedida_por: 't', pedido_id: 't' },
  saldo_licencas_personal: {
    id: 't', personal_id: 't', periodo_ou_fim: 't', origem: 't', atribuida_a: 't', atribuida_em: 'd',
    pedido_id: 't', licenca_id: 't'
  },
  programas: {
    id: 't', nome: 't', descricao: 't', objetivo: 't', nivel: 't', dias_semana: 'n', semanas: 'n',
    autor_id: 't', grupo_id: 't', publico: 't', gratis: 'b', publicado: 'b'
  },
  programa_fichas: { id: 't', programa_id: 't', nome: 't', ordem: 'n' },
  programa_itens: {
    id: 't', programa_ficha_id: 't', exercicio_id: 't', ordem: 'n', series: 'n', reps_prescritas: 't',
    descanso_seg: 'n', metodo: 't', observacoes: 't'
  },
  auditoria: { id: 't', usuario_id: 't', acao: 't', alvo: 't', detalhes: 't' }
};

/** Colunas na ordem da planilha (campos da tabela + campos comuns). */
function colunas_(tabela) {
  var def = ESQUEMA[tabela];
  if (!def) throw erro_('CONFIG', 'Tabela desconhecida: ' + tabela);
  var cols = Object.keys(def);
  Object.keys(COMUNS_).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
  return cols;
}

function tipo_(tabela, coluna) {
  return ESQUEMA[tabela][coluna] || COMUNS_[coluna] || 't';
}
