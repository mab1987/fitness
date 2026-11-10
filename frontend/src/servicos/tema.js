// Tema (claro, noturno ou automático) e as 8 paletas aprovadas.
// As cores viram variáveis CSS; nenhuma tela usa cor fixa.
import { reactive, watch } from 'vue';

export const PALETAS = [
  { id: 'verde-agua', nome: 'Verde-água', claro: ['#0F766E', '#FFFFFF', '#E0F2F0', '#0F766E'], escuro: ['#2DD4BF', '#042F2B', '#12332F', '#5EEAD4'] },
  { id: 'azul', nome: 'Azul', claro: ['#1D4ED8', '#FFFFFF', '#E3EBFD', '#1D4ED8'], escuro: ['#60A5FA', '#0B1B33', '#15243D', '#93C5FD'] },
  { id: 'violeta', nome: 'Violeta', claro: ['#6D28D9', '#FFFFFF', '#EEE7FC', '#6D28D9'], escuro: ['#A78BFA', '#1C1033', '#241A3A', '#C4B5FD'] },
  { id: 'coral', nome: 'Coral', claro: ['#C2410C', '#FFFFFF', '#FCEBE2', '#B23A0A'], escuro: ['#FB923C', '#2A1205', '#33200F', '#FDBA74'] },
  { id: 'rosa', nome: 'Rosa', claro: ['#BE185D', '#FFFFFF', '#FCE7F0', '#BE185D'], escuro: ['#F472B6', '#2D0A1C', '#36172A', '#F9A8D4'] },
  { id: 'verde', nome: 'Verde', claro: ['#15803D', '#FFFFFF', '#E3F4E8', '#15803D'], escuro: ['#4ADE80', '#052E16', '#13301D', '#86EFAC'] },
  { id: 'vermelho', nome: 'Vermelho', claro: ['#B91C1C', '#FFFFFF', '#FDE8E8', '#B91C1C'], escuro: ['#F87171', '#2B0707', '#3A1717', '#FCA5A5'] },
  { id: 'grafite', nome: 'Grafite', claro: ['#27272A', '#FFFFFF', '#ECECEE', '#27272A'], escuro: ['#E4E4E7', '#18181B', '#2A2A2E', '#E4E4E7'] },
];

export const TEMAS = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Noturno' },
  { id: 'sistema', nome: 'Automático' },
];

const BASE = {
  claro: { bg: '#F4F5F7', surface: '#FFFFFF', text: '#15191E', muted: '#586170', line: '#DFE3E8', track: '#E6E9ED', perigo: '#B42318', perigoFundo: '#FEECEB', ok: '#1F7A3A' },
  escuro: { bg: '#0E1116', surface: '#171B22', text: '#ECEFF3', muted: '#9AA3AF', line: '#262C35', track: '#1E232B', perigo: '#FDA29B', perigoFundo: '#3A1A18', ok: '#7BD88F' },
};

const CHAVE = 'meutreino.aparencia';

function lerLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { tema: v.tema || 'sistema', paleta: v.paleta || 'verde-agua' };
  } catch {
    return { tema: 'sistema', paleta: 'verde-agua' };
  }
}

export const aparencia = reactive(lerLocal());

const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function modoEfetivo() {
  if (aparencia.tema === 'sistema') return mql && mql.matches ? 'escuro' : 'claro';
  return aparencia.tema === 'escuro' ? 'escuro' : 'claro';
}

export function aplicarTema() {
  const modo = modoEfetivo();
  const p = (PALETAS.find((x) => x.id === aparencia.paleta) || PALETAS[0])[modo];
  const b = BASE[modo];
  const raiz = document.documentElement.style;
  const vars = {
    '--bg': b.bg, '--surface': b.surface, '--text': b.text, '--muted': b.muted, '--line': b.line, '--track': b.track,
    '--perigo': b.perigo, '--perigo-fundo': b.perigoFundo, '--ok': b.ok,
    '--accent': p[0], '--on-accent': p[1], '--accent-soft': p[2], '--accent-ink': p[3],
  };
  Object.entries(vars).forEach(([k, v]) => raiz.setProperty(k, v));
  document.documentElement.dataset.modo = modo;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', b.bg);
  try { localStorage.setItem(CHAVE, JSON.stringify({ tema: aparencia.tema, paleta: aparencia.paleta })); } catch { /* sem armazenamento */ }
}

export function iniciarTema() {
  aplicarTema();
  watch(aparencia, aplicarTema);
  if (mql) mql.addEventListener('change', aplicarTema);
}

export function coresDaPaleta(id) {
  return PALETAS.find((x) => x.id === id) || PALETAS[0];
}
