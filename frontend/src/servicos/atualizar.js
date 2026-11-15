// Mantém o app atualizado. O app guarda uma cópia no aparelho para abrir sem internet;
// quando sai versão nova, ela é baixada e a página recarrega sozinha.
// O treino em andamento fica guardado no aparelho, então a recarga não perde nada.
import { registerSW } from 'virtual:pwa-register';

export function iniciarAtualizacao() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const conferir = () => { if (navigator.onLine) registro.update().catch(() => {}); };
      // Confere ao voltar para o app e, com ele aberto, a cada 30 minutos.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
      setInterval(conferir, 30 * 60 * 1000);
    },
  });
}
