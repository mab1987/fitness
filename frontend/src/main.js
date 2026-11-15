import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { iniciarTema } from './servicos/tema.js';
import './estilos/base.css';
import { iniciarAtualizacao } from './servicos/atualizar.js';

iniciarTema();
createApp(App).use(router).mount('#app');
iniciarAtualizacao();
