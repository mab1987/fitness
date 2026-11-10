<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { sessao, papeisEfetivos, planoEfetivo, textoPlano, PAPEIS_VER_COMO } from '../servicos/sessao.js';

const router = useRouter();
const podePainel = computed(() => papeisEfetivos.value.some((p) => ['admin', 'personal', 'gerente'].includes(p)));
const nomeVerComo = computed(() => (PAPEIS_VER_COMO.find((p) => p.id === sessao.verComo) || {}).nome);

const itens = computed(() => {
  const lista = [
    { para: '/', nome: 'Início', icone: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
    { para: '/perfil', nome: 'Perfil', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' },
  ];
  if (podePainel.value) lista.splice(1, 0, { para: '/painel', nome: 'Painel', icone: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z' });
  return lista;
});

function sairDoVerComo() {
  sessao.verComo = null;
  router.push('/painel');
}
</script>

<template>
  <div class="casca">
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <aside class="lateral" aria-label="Menu">
      <div class="marca">Meu treino</div>
      <nav class="pilha">
        <RouterLink v-for="i in itens" :key="i.para" :to="i.para" class="item-lateral" exact-active-class="ativo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="i.icone" /></svg>
          {{ i.nome }}
        </RouterLink>
      </nav>
    </aside>

    <div class="coluna">
      <div v-if="sessao.verComo" class="faixa-ver-como" role="status">
        <span>Vendo como <strong>{{ nomeVerComo }}</strong> · nada é alterado</span>
        <button class="botao secundario" type="button" @click="sairDoVerComo">Sair do modo</button>
      </div>
      <header class="topo">
        <span class="marca-movel">Meu treino</span>
        <span class="selo">{{ textoPlano(planoEfetivo) }}</span>
      </header>
      <main id="conteudo" class="conteudo">
        <RouterView />
      </main>
    </div>

    <nav class="inferior" aria-label="Navegação principal">
      <RouterLink v-for="i in itens" :key="i.para" :to="i.para" class="item-inferior" exact-active-class="ativo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="i.icone" /></svg>
        {{ i.nome }}
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.casca { min-height: 100vh; display: flex; }
.pular { position: absolute; left: -999px; }
.pular:focus { left: 12px; top: 12px; z-index: 10; background: var(--surface); padding: 8px 12px; border-radius: 8px; }
.lateral { display: none; }
.coluna { flex: 1; min-width: 0; display: flex; flex-direction: column; padding-bottom: 84px; }
.topo { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 8px; }
.marca-movel { font-weight: 700; }
.conteudo { padding: 8px 16px 24px; width: 100%; max-width: 960px; margin: 0 auto; }
.faixa-ver-como {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between;
  padding: 8px 16px; background: var(--accent); color: var(--on-accent); font-size: 14px;
}
.faixa-ver-como .botao { height: 36px; color: var(--on-accent); border-color: currentColor; }
.inferior {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-around;
  background: var(--surface); border-top: 1px solid var(--line); padding: 6px 8px calc(10px + env(safe-area-inset-bottom));
}
.item-inferior {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0;
  font-size: 12px; color: var(--muted); text-decoration: none; min-height: 48px;
}
.item-inferior.ativo { color: var(--accent-ink); font-weight: 600; }

@media (min-width: 900px) {
  .lateral {
    display: flex; flex-direction: column; gap: 24px; width: 240px; flex-shrink: 0;
    padding: 24px 16px; border-right: 1px solid var(--line); background: var(--surface);
  }
  .marca { font-size: 20px; font-weight: 700; padding: 0 12px; }
  .item-lateral {
    display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px;
    color: var(--text); text-decoration: none; font-weight: 500;
  }
  .item-lateral.ativo { background: var(--accent-soft); color: var(--accent-ink); font-weight: 700; }
  .inferior, .marca-movel { display: none; }
  .coluna { padding-bottom: 0; }
  .topo { justify-content: flex-end; padding: 20px 32px 8px; }
  .conteudo { padding: 8px 32px 32px; }
}
</style>
