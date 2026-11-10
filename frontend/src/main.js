import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { iniciarTema } from './servicos/tema.js';
import './estilos/base.css';

iniciarTema();
createApp(App).use(router).mount('#app');
