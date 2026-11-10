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
      { path: 'perfil', component: () => import('./telas/TelaPerfil.vue') },
      { path: 'painel', component: () => import('./telas/TelaPainel.vue'), meta: { painel: true } },
    ],
  },
  { path: '/:qualquer(.*)*', redirect: '/' },
];

export const router = createRouter({ history: createWebHashHistory(), routes: rotas });

router.beforeEach((to) => {
  if (to.meta.livre) return true;
  if (!to.meta.publica && !logado.value) return { path: '/entrar', query: to.fullPath !== '/' ? { voltar: to.fullPath } : {} };
  if (to.meta.publica && logado.value) return '/';
  if (to.meta.painel && !papeisEfetivos.value.some((p) => ['admin', 'personal', 'gerente'].includes(p))) return '/';
  return true;
});
