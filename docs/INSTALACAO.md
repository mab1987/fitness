# Meu treino — como colocar no ar

> **Já está na Fase 2?** Vá direto para a [Parte 9 — Atualizar para a Fase 3](#parte-9--atualizar-para-a-fase-3).
>
> **Já está na Fase 1?** Vá para a [Parte 7 — Atualizar para a Fase 2](#parte-7--atualizar-para-a-fase-2).
>
> **Já instalou a Fase 0?** Vá para a [Parte 4 — Atualizar para a Fase 1](#parte-4--atualizar-para-a-fase-1) e depois para a [Parte 5 — Importar a planilha antiga](#parte-5--importar-a-planilha-antiga).

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
   - No registro de execução deve aparecer **"Pronto: 24 abas conferidas"** (21 na Fase 2, 19 antes dela). A planilha agora tem as abas do modelo de dados.
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

## Parte 4 — Atualizar para a Fase 1

A URL do servidor não muda, e nada do que já está na planilha é apagado.

1. **Servidor.** Abra a planilha > **Extensões > Apps Script**. Apague o conteúdo de `Código.gs` e cole **todo** o novo `backend/dist/Codigo.gs`. Salve.
2. Escolha a função **setup** e clique em **Executar**. Ela acrescenta a coluna `global` na aba `exercicios` e confere as outras. Deve aparecer **"Pronto: 19 abas conferidas"**.
3. **Implantar > Gerenciar implantações** > lápis (editar) > **Versão: Nova versão** > Descrição `Fase 1` > **Implantar**.
4. Teste: abra a URL `/exec` no navegador. Deve aparecer `"versao":"0.2.0"`.
5. **Site.** Envie os arquivos do pacote novo para o repositório (**Add file > Upload files**, substituindo os antigos). Inclua as pastas `frontend`, `backend`, `testes`, `docs` e `.github`. O Actions testa e publica sozinho em 2 a 3 minutos.
6. No celular, feche e abra o app instalado. Se a tela antiga continuar, puxe para atualizar ou feche o app duas vezes: a versão nova é baixada em segundo plano.

## Parte 5 — Importar a planilha antiga

1. Envie o arquivo .xlsx do app antigo para o seu Google Drive (pode ser em qualquer pasta). Precisa ser **a mesma conta Google** que é dona do servidor.
2. Abra o arquivo no Drive e use **Arquivo > Salvar como Planilhas Google**. Abre uma planilha nova: copie o endereço dela da barra do navegador.
3. No app, no computador: **Painel > Importar planilha antiga**.
   - Cole o endereço.
   - O e-mail já vem com o seu (a conta que recebe os dados).
   - Se quiser juntar ou corrigir nomes, use **Renomear**, um por linha. Exemplo: `Panturrilha Sentadilha = Panturrilha Sentada`.
4. Clique em **Ver prévia** e confira:
   - período (19/jan a 20/out), 128 treinos e 2.310 séries, fichas A a E;
   - **carga e repetições juntas**: a planilha antiga guardava valores como `42.510kg`, que são 42,5 kg × 10 repetições. A prévia lista todos os casos que serão separados assim;
   - **para conferir**: 4 valores que não seguem o padrão (`47.51kg`, `9.1kg`, `62.2kg`, `9.7kg`). Eles entram como estão; depois dá para corrigir;
   - **nomes parecidos**: ficam separados, a não ser que você use Renomear.
5. Clique em **Importar agora**. A sua conta vira **Premium · sem prazo** (cortesia) e as fichas e o histórico aparecem em **Treino**, **Fichas** e **Evolução**.

Pode importar de novo, até com outros nomes em Renomear: nada é duplicado. Fichas que você já editou no app não são sobrescritas.

## Parte 6 — Teste de passagem da Fase 1

1. **Celular, com internet:** em **Treino**, comece o próximo treino. Mude a carga de uma série, marque as séries e veja o descanso contar. Aceite "Usar essa carga no próximo treino?". Termine com **Tá pago!**.
2. **Celular, sem internet** (modo avião): comece outro treino, marque séries, feche e abra o app no meio (nada se perde) e termine. Aparece **"1 a enviar"** no topo. Desligue o modo avião: o aviso some em alguns segundos. Na planilha, as abas `sessoes` e `series` recebem as linhas novas.
3. **Fichas:** crie uma ficha, busque um exercício, crie um exercício novo com link do YouTube e salve. No treino, o botão **Vídeo** abre o vídeo.
4. **Evolução:** escolha um exercício e veja o gráfico, os recordes e o histórico.
5. **Ver como aluno grátis:** em Fichas aparece o limite de 3 fichas; em Evolução, o gráfico mostra só o último mês.

## Parte 7 — Atualizar para a Fase 2

1. **Servidor.** No Apps Script, troque todo o conteúdo de `Código.gs` pelo novo `backend/dist/Codigo.gs` e salve.
2. Rode **setup**. Ela cria as abas `convites` e `comentarios` e acrescenta as colunas novas (`fim` em `vinculos_personal`, `status` em `exercicios`). Deve aparecer **"Pronto: 21 abas conferidas"**.
3. **Implantar > Gerenciar implantações** > lápis > **Versão: Nova versão** > Descrição `Fase 2` > **Implantar**. Abra a URL `/exec`: deve aparecer `"versao":"0.3.0"`.
4. **Site.** Junte o pull request da Fase 2 no GitHub. O site é publicado sozinho.
5. **Última vez com Ctrl+Shift+R.** A partir desta versão o app se atualiza sozinho: confere se há versão nova ao ser aberto, ao voltar para ele e a cada 30 minutos, e recarrega a página. Só esta primeira troca ainda pode pedir um Ctrl+Shift+R no computador (ou fechar e abrir o app no celular duas vezes).

## Parte 8 — Teste de passagem da Fase 2

Use duas contas além da sua (por exemplo, um amigo personal e um aluno, ou contas de teste com outros e-mails e CPFs).

1. **Personal:** em **Painel › Usuários**, clique em **Tornar personal** na conta do personal. Ele entra, vai em **Painel › Meus alunos › Gerar convite** e envia a mensagem com o link.
2. **Aluno:** abre o link (se ainda não tiver conta, cadastra e o convite reabre sozinho) e **aceita**. Em **Perfil › Personal e grupos** aparece o nome do personal.
3. **Ficha prescrita:** o personal abre o aluno › **Fichas › Nova ficha**, monta e salva. No celular do aluno a ficha aparece com "por Fulano" e não pode ser alterada por ele.
4. **Ajuste e comentário:** o aluno faz o treino, sobe uma carga e aceita "Usar essa carga no próximo treino?". O personal vê **1 ajuste** na lista de alunos e, na aba **Treinos**, comenta. O aluno vê o aviso de comentário no Início e responde em **Evolução**.
5. **Grupo:** em **Painel › Grupos**, crie um grupo (com ou sem gerente), gere um convite e use o código em **Perfil** de outra conta. A tabela do grupo mostra a pessoa e quantos treinos ela fez.
6. **Catálogo:** o personal propõe um exercício seu em **Painel › Meus exercícios**. Você aceita em **Painel › Catálogo de exercícios** e ele passa a aparecer para todos.

## Parte 9 — Atualizar para a Fase 3

1. **Servidor.** Troque todo o `Código.gs` pelo novo `backend/dist/Codigo.gs`, salve e rode **setup**. Ela cria as abas `programas`, `programa_fichas` e `programa_itens`, acrescenta colunas novas e preenche a tabela de preços com a opção simbólica (só se estiver vazia). Deve aparecer **"Pronto: 24 abas conferidas"**.
2. **Implantar › Gerenciar implantações** › lápis › **Nova versão** › Descrição `Fase 3` › **Implantar**. A URL `/exec` deve mostrar `"versao":"0.4.0"`.
3. **Site.** Junte o pull request da Fase 3. O app se atualiza sozinho nos aparelhos.
4. **Chave Pix.** No app: **Painel › Premium e vendas › Dados do Pix**. Preencha a chave, o nome do recebedor e a cidade e salve. Sem a chave, a tela de compra avisa que ainda não está disponível.
5. **Preços.** Na mesma tela ficam os preços (opção simbólica: mensal R$ 4,90, trimestral R$ 12,90, semestral R$ 22,90, anual R$ 39,90; licença do personal cerca de 30% menos). Mude à vontade: pedidos já feitos mantêm o valor da compra.

**Antes de vender:** faça um pedido de teste com a sua conta, pague R$ 4,90 a você mesmo pelo app do banco e confira se o valor e o nome aparecem certos. Depois libere o pedido e veja se o premium começa.

## Parte 10 — Teste de passagem da Fase 3

1. **Compra:** com uma conta de aluno, toque no selo do plano (no topo) › **Comprar** › pague com o Pix copia e cola ou o QR Code › **Já paguei**.
2. **Liberação:** em **Painel › Premium e vendas**, o pedido aparece "para conferir". Confira no extrato do banco o valor e o código do pedido (vai na descrição do Pix) e clique **Liberar**. O aluno vê "Premium até …".
3. **Cortesia e lote:** na mesma tela, escolha uma pessoa e dê premium por dias, até uma data ou sem prazo. Para um personal, dê um lote de licenças; ele vê o saldo em **Painel › Meus alunos** e dá premium a um aluno com um toque.
4. **Programa pronto:** em **Painel › Programas prontos**, publique um programa (para todos, marcado como grátis). O aluno usa em **Fichas › Programas prontos**.
5. **Sugestão de carga:** faça um exercício duas vezes, batendo as repetições na segunda. Na terceira vez aparece "Sugestão: … kg" com o motivo. No premium, anote o esforço (6 a 10) ao terminar o exercício.
6. **Medidas e exportação:** em **Evolução**, registre medidas (grátis: só peso) e, no premium, baixe as planilhas de séries, treinos e medidas.
7. **Vencimento:** dê uma cortesia de 1 dia a uma conta de teste com 5 fichas ativas. No dia seguinte ela volta ao grátis e 2 fichas aparecem **bloqueadas** (dá para ver e arquivar, não para treinar).

## Problemas comuns

| O que aparece | O que fazer |
| --- | --- |
| "O endereço do servidor ainda não foi configurado" | Falta a variável `VITE_API_URL` no GitHub (Parte 2, passo 3). Depois rode o workflow de novo. |
| "Sem conexão com o servidor" | Confira se a URL termina em `/exec` e se a implantação está como "Qualquer pessoa". |
| "Configuração ausente: CPF_SEGREDO" | Rode a função `setup` de novo no Apps Script. |
| O link de recuperação de senha abre o endereço errado | Confira a propriedade `APP_URL`. |
| Mudei o código do servidor e nada mudou | Crie uma **nova versão** da implantação (fim da Parte 1). |
| O app não atualizou no celular | Feche e abra o app de novo: o PWA baixa a nova versão em segundo plano. |
