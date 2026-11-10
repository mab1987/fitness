# Meu treino — como colocar a Fase 0 no ar

São três partes: a planilha com o servidor (Apps Script), o site (GitHub Pages) e o teste final. Leva cerca de 30 minutos na primeira vez.

## Parte 1 — Planilha e servidor (Google Apps Script)

1. No Google Planilhas, crie uma planilha nova com a sua conta. Sugestão de nome: **Meu treino – banco de dados**. Não compartilhe essa planilha com ninguém: todo acesso passa pelo servidor.
2. Na planilha, abra **Extensões > Apps Script**. Renomeie o projeto para **Meu treino – servidor**.
3. Apague o conteúdo do arquivo `Código.gs` e cole **todo** o conteúdo de `backend/dist/Codigo.gs`. Clique em salvar (ícone de disquete).
4. Clique na engrenagem (**Configurações do projeto**):
   - marque **Mostrar o arquivo de manifesto "appsscript.json" no editor**;
   - em **Fuso horário**, escolha **(GMT-03:00) Fortaleza**.
5. Volte ao editor, abra o arquivo `appsscript.json` e substitua o conteúdo pelo de `backend/appsscript.json`. Salve.
6. No topo do editor, escolha a função **setup** e clique em **Executar**.
   - O Google vai pedir autorização. Escolha sua conta. Se aparecer "O Google não verificou este app", clique em **Avançado > Acessar Meu treino – servidor (não seguro)**: o aviso aparece porque o script é seu e não passou pela verificação do Google.
   - No registro de execução deve aparecer **"Pronto: 19 abas conferidas"**. A planilha agora tem as 19 abas do modelo de dados.
7. Rode também a função **testarSenha**. O registro mostra quanto tempo o servidor leva para proteger uma senha. Até uns 3 segundos está ok.
8. Em **Configurações do projeto > Propriedades do script**, clique em **Adicionar propriedade** e crie:
   - `ADMIN_EMAIL` = o e-mail com que você vai se cadastrar no app (essa conta vira administradora);
   - `APP_URL` = `https://mab1987.github.io/fitness/`
   - Não altere `PLANILHA_ID` nem `CPF_SEGREDO`, criadas pelo setup. **Guarde uma cópia do `CPF_SEGREDO` em lugar seguro** (um gerenciador de senhas, por exemplo): ele é necessário na migração para o Supabase. Se for perdido, o app deixa de reconhecer CPFs já cadastrados.
9. Clique em **Implantar > Nova implantação**. Em "Selecionar tipo", escolha **App da Web** e preencha:
   - Descrição: `Fase 0`
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
10. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
11. Teste: abra essa URL no navegador. Deve aparecer algo como `{"ok":true,"dados":{"app":"Meu treino","versao":"0.1.0"}}`.

**Para atualizar o servidor no futuro** (sem mudar a URL): cole o novo `Codigo.gs`, salve e vá em **Implantar > Gerenciar implantações > lápis (editar) > Versão: Nova versão > Implantar**.

## Parte 2 — Site no GitHub Pages

1. Envie os arquivos deste pacote para o repositório `mab1987/fitness`. Pelo site do GitHub: **Add file > Upload files**, arraste as pastas `backend`, `frontend`, `testes`, `ferramentas`, `docs` e `.github` e os arquivos da raiz, e clique em **Commit changes**.
   - A pasta `.github` começa com ponto e fica oculta em alguns computadores. Ela precisa ir junto: é ela que publica o site.
   - Se preferir, use o [GitHub Desktop](https://desktop.github.com/).
2. No repositório, abra **Settings > Pages** e, em **Source**, escolha **GitHub Actions**.
   - No plano gratuito do GitHub, o Pages exige repositório **público**. Não há problema: nada secreto fica no código (regra de segurança 7).
3. Em **Settings > Secrets and variables > Actions**, abra a aba **Variables** e clique em **New repository variable**:
   - Name: `VITE_API_URL`
   - Value: a URL do app da Web que termina em `/exec`
4. Abra a aba **Actions**, escolha **Publicar no GitHub Pages** e clique em **Run workflow**. Em 2 a 3 minutos aparece um ✓ verde.
5. O app fica em **https://mab1987.github.io/fitness/**.

Cada novo envio para a branch `main` testa o código e publica de novo automaticamente.

## Parte 3 — Teste de passagem da Fase 0

A Fase 0 está concluída quando os quatro itens abaixo funcionarem:

1. **Computador:** abra o app e crie sua conta com o mesmo e-mail de `ADMIN_EMAIL`. O menu lateral mostra **Painel**, e a lista de usuários aparece nele.
2. **Celular:** abra o mesmo endereço e instale o app.
   - Android (Chrome): **Perfil > Instalar app**, ou menu do navegador > **Instalar app**.
   - iPhone (Safari): botão **Compartilhar > Adicionar à Tela de Início**.
   - Entre com a mesma conta.
3. **Ida e volta da planilha:** no celular, em **Perfil > Aparência**, mude o tema e a cor. Abra a planilha, aba `usuarios`: as colunas `tema` e `paleta` mudaram. Abra o app no computador: a nova aparência aparece lá também.
4. **Ver como:** no computador, em **Painel**, escolha **Aluno grátis > Ver como**. Aparece a faixa "Vendo como Aluno grátis", o Painel some do menu e nada pode ser alterado. **Sair do modo** volta ao normal.

## Problemas comuns

| O que aparece | O que fazer |
| --- | --- |
| "O endereço do servidor ainda não foi configurado" | Falta a variável `VITE_API_URL` no GitHub (Parte 2, passo 3). Depois rode o workflow de novo. |
| "Sem conexão com o servidor" | Confira se a URL termina em `/exec` e se a implantação está como "Qualquer pessoa". |
| "Configuração ausente: CPF_SEGREDO" | Rode a função `setup` de novo no Apps Script. |
| O link de recuperação de senha abre o endereço errado | Confira a propriedade `APP_URL`. |
| Mudei o código do servidor e nada mudou | Crie uma **nova versão** da implantação (fim da Parte 1). |
| O app não atualizou no celular | Feche e abra o app de novo: o PWA baixa a nova versão em segundo plano. |
