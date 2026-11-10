// Guarda o pedido de instalação do navegador (Android/Chrome) para oferecer o botão "Instalar app".
import { ref } from 'vue';

export const pedidoInstalacao = ref(null);
export const instalado = ref(
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches,
);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalacao.value = e;
  });
  window.addEventListener('appinstalled', () => {
    instalado.value = true;
    pedidoInstalacao.value = null;
  });
}

export async function instalar() {
  if (!pedidoInstalacao.value) return false;
  pedidoInstalacao.value.prompt();
  const escolha = await pedidoInstalacao.value.userChoice;
  pedidoInstalacao.value = null;
  return escolha && escolha.outcome === 'accepted';
}

export const ehIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
