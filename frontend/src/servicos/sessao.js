// Sessão do usuário logado, guardada no aparelho para o app abrir já logado.
import { reactive, computed } from 'vue';
import { aparencia } from './tema.js';

const CHAVE = 'meutreino.sessao';

function lerLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (v && v.token && v.expira_em > new Date().toISOString()) return v;
  } catch { /* ignora */ }
  return null;
}

const salvo = lerLocal();

export const sessao = reactive({
  token: salvo ? salvo.token : null,
  expira_em: salvo ? salvo.expira_em : null,
  perfil: salvo ? salvo.perfil : null,
  verComo: null, // só administrador; nunca é salvo no aparelho
});

function persistir() {
  try {
    if (sessao.token) {
      localStorage.setItem(CHAVE, JSON.stringify({ token: sessao.token, expira_em: sessao.expira_em, perfil: sessao.perfil }));
    } else {
      localStorage.removeItem(CHAVE);
    }
  } catch { /* sem armazenamento */ }
}

export function iniciarSessao({ token, expira_em, perfil }) {
  sessao.token = token;
  sessao.expira_em = expira_em;
  definirPerfil(perfil);
}

export function definirPerfil(perfil) {
  sessao.perfil = perfil;
  if (perfil && perfil.tema) aparencia.tema = perfil.tema;
  if (perfil && perfil.paleta) aparencia.paleta = perfil.paleta;
  persistir();
}

export function encerrarLocal() {
  sessao.token = null;
  sessao.expira_em = null;
  sessao.perfil = null;
  sessao.verComo = null;
  persistir();
}

export const logado = computed(() => !!sessao.token && !!sessao.perfil);
export const ehAdmin = computed(() => !!(sessao.perfil && sessao.perfil.admin));

export const PAPEIS_VER_COMO = [
  { id: 'aluno_gratis', nome: 'Aluno grátis' },
  { id: 'aluno_premium', nome: 'Aluno premium' },
  { id: 'personal', nome: 'Personal' },
  { id: 'gerente', nome: 'Gerente de grupo' },
];

/** Papéis em vigor na tela: os reais ou, no modo "ver como", os simulados. */
export const papeisEfetivos = computed(() => {
  if (!sessao.perfil) return [];
  switch (sessao.verComo) {
    case 'aluno_gratis':
    case 'aluno_premium':
      return ['aluno'];
    case 'personal':
      return ['aluno', 'personal'];
    case 'gerente':
      return ['aluno', 'gerente'];
    default:
      return sessao.perfil.papeis || ['aluno'];
  }
});

/** Plano mostrado na tela (simulado no modo "ver como"). */
export const planoEfetivo = computed(() => {
  if (!sessao.perfil) return null;
  if (sessao.verComo === 'aluno_gratis') return { tipo: 'gratis' };
  if (sessao.verComo === 'aluno_premium') return { tipo: 'premium', fim: null, dias_restantes: 30, origem: 'simulado' };
  if (sessao.verComo === 'personal') return { tipo: 'premium', origem: 'personal' };
  return sessao.perfil.plano;
});

export function textoPlano(plano) {
  if (!plano || plano.tipo !== 'premium') return 'Plano grátis';
  if (plano.origem === 'personal') return 'Premium · personal';
  if (plano.dias_restantes == null) return 'Premium · sem prazo';
  return plano.dias_restantes === 1 ? 'Premium · falta 1 dia' : `Premium · faltam ${plano.dias_restantes} dias`;
}
