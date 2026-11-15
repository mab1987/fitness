import { createRouter, createWebHashHistory } from 'vue-router';
import { logado, papeisEfetivos } from './servicos/sessao.js';

// Rotas com # funcionam no GitHub Pages sem configuração extra.
const rotas = [
  { path: '/entrar', component: () => import('./telas/TelaEntrar.vue'), meta: { publica: true } },
  { path: '/cadastro', component: () => import('./telas/TelaCadastro.vue'), meta: { publica: true } },
  { path: '/recuperar', component: () => import('./telas/TelaRecuperar.vue'), meta: { publica: true } },
  { path: '/redefinir', component: () => import('./telas/TelaRedefinir.vue'), meta: { publica: true, livre: true } },
  {
    path: '/',
    component: () => import('./componentes/LayoutApp.vue'),
    children: [
      { path: '', component: () => import('./telas/TelaInicio.vue') },
      { path: 'treino', component: () => import('./telas/TelaTreino.vue') },
      { path: 'fichas', component: () => import('./telas/TelaFichas.vue') },
      { path: 'fichas/:id', component: () => import('./telas/TelaFicha.vue'), props: true },
      { path: 'evolucao', component: () => import('./telas/TelaEvolucao.vue') },
      { path: 'perfil', component: () => import('./telas/TelaPerfil.vue') },
      { path: 'convite/:codigo', component: () => import('./telas/TelaConvite.vue'), props: true },
      { path: 'painel', component: () => import('./telas/TelaPainel.vue'), meta: { painel: true } },
      { path: 'painel/alunos', component: () => import('./telas/TelaAlunos.vue'), meta: { painel: true } },
      { path: 'painel/alunos/:id', component: () => import('./telas/TelaAluno.vue'), props: true, meta: { painel: true } },
      { path: 'painel/grupos', component: () => import('./telas/TelaGrupos.vue'), meta: { painel: true } },
      { path: 'painel/grupos/:id', component: () => import('./telas/TelaGrupo.vue'), props: true, meta: { painel: true } },
      { path: 'painel/catalogo', component: () => import('./telas/TelaCatalogo.vue'), meta: { painel: true } },
      { path: 'painel/usuarios', component: () => import('./telas/TelaUsuarios.vue'), meta: { painel: true, admin: true } },
      { path: 'painel/importar', component: () => import('./telas/TelaImportar.vue'), meta: { painel: true, admin: true } },
    ],
  },
  { path: '/:qualquer(.*)*', redirect: '/' },
];

export const router = createRouter({ history: createWebHashHistory(), routes: rotas });

export const CHAVE_CONVITE = 'meutreino.convite';

router.beforeEach((to) => {
  if (to.meta.livre) return true;
  // Link de convite antes de entrar: guarda o código e abre de novo depois do login ou do cadastro.
  if (!logado.value && to.path.startsWith('/convite/')) {
    try { localStorage.setItem(CHAVE_CONVITE, String(to.params.codigo || '').slice(0, 20)); } catch { /* sem armazenamento */ }
  }
  if (!to.meta.publica && !logado.value) return { path: '/entrar', query: to.fullPath !== '/' ? { voltar: to.fullPath } : {} };
  if (to.meta.publica && logado.value) return '/';
  if (to.meta.painel && !papeisEfetivos.value.some((p) => ['admin', 'personal', 'gerente'].includes(p))) return '/';
  if (to.meta.admin && !papeisEfetivos.value.includes('admin')) return '/painel';
  return true;
});
