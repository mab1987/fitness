# Meu treino

App de acompanhamento de treinos de musculação (nome provisório). Aluno usa no celular como PWA instalável; personal, gerente e administrador usam no computador ou tablet.

**Estado atual: Fase 0 (fundação).** Cadastro com CPF único, login com e-mail ou usuário e senha, recuperação de senha por e-mail, perfil com tema claro/noturno/automático e 8 paletas de cor, painel do administrador (lista de usuários, ativar personal, "ver como" somente leitura) e a planilha com as 19 tabelas do modelo de dados.

Como colocar no ar: [docs/INSTALACAO.md](docs/INSTALACAO.md).

## Estrutura

```
backend/            Servidor no Google Apps Script (a planilha é o banco de dados)
  00_Bcrypt.gs      Biblioteca bcrypt.js (senhas), ajustada para o Apps Script
  01_Config.gs      Configurações e propriedades do script
  02_Esquema.gs     Modelo de dados: abas, colunas e tipos
  03_Banco.gs       Leitura e gravação na planilha (anti-fórmula, bloqueio)
  04_Seguranca.gs   Validação, CPF, senhas e tokens
  05_Contas.gs      Cadastro, login, sessão, perfil, plano e administração
  06_Rotas.gs       Rota única da API e checagem de permissões
  07_Instalacao.gs  setup() cria as abas; testarSenha() mede o bcrypt
  dist/Codigo.gs    Todos os arquivos acima em um só, para colar no editor
frontend/           App em Vue 3 + Vite + vite-plugin-pwa
  src/servicos/dados.js   Única porta entre as telas e o servidor
testes/             Simulador do Apps Script e testes do backend
ferramentas/        Script que gera backend/dist/Codigo.gs
.github/workflows/  Testa e publica no GitHub Pages a cada envio
```

## Desenvolvimento

```bash
# testes do backend (simulador do Apps Script, sem precisar do Google)
node testes/backend.test.js

# depois de mudar algo em backend/, gere de novo o arquivo único
node ferramentas/juntar-backend.js

# app
cd frontend
npm install
cp .env.example .env.local   # e coloque a URL /exec do Apps Script
npm run dev
npm test
```

## Regras de segurança (valem para todo o projeto)

1. Todo dado do usuário é mostrado como texto (Vue escapa por padrão; o projeto não usa `v-html`).
2. Nada vira fórmula na planilha: todo texto é gravado com apóstrofo inicial.
3. O servidor valida tipos, tamanhos, listas permitidas e faixas de valores.
4. Vídeos só do YouTube, pelo player oficial (a partir da Fase 1).
5. Senhas com bcrypt, limite de tentativas, sessão que expira, recuperação por link de uso único.
6. Permissão checada no servidor em toda ação; "ver como" é somente leitura.
7. Nada secreto no código do site: chaves e segredos ficam nas propriedades do Apps Script.
8. Política de segurança de conteúdo (CSP) no `index.html`.
9. Importações passam pelas regras 2 e 3.
10. Ações sensíveis ficam na aba `auditoria`.

## Migração futura para o Supabase

Cada aba é uma tabela com os mesmos nomes de colunas; ids são UUID; datas em ISO (UTC); senhas em bcrypt (o Supabase aceita importar). Na migração, só `frontend/src/servicos/dados.js` muda, e as regras de `exigirPermissao_` viram políticas de Row Level Security.
