# Teste de ponta a ponta da Fase 2: administrador, personal e aluna em navegadores separados.
# Antes: build em frontend/dist-teste com VITE_API_URL=/api e  node testes/servidor-teste.js
# Rode: python3 testes/e2e/fase2.py
import os, re, sys
from playwright.sync_api import sync_playwright, expect

URL = 'http://localhost:8787/'
SAIDA = os.environ.get('SAIDA', '/tmp/e2e2')
os.makedirs(SAIDA, exist_ok=True)
erros = []

def cpf(base):
    d = [int(c) for c in base]
    for t in (9, 10):
        s = sum(d[i] * (t + 1 - i) for i in range(t))
        d.append((s * 10) % 11 % 10)
    return ''.join(map(str, d))

def foto(p, nome):
    p.screenshot(path=f'{SAIDA}/{nome}.png', full_page=True)

def vigiar(p):
    p.on('console', lambda m: m.type == 'error' and erros.append(m.text))
    p.on('pageerror', lambda e: erros.append(str(e)))

def cadastrar(p, nome, email, base):
    p.goto(URL + '#/cadastro')
    p.fill('#nome', nome); p.fill('#email', email)
    p.fill('#cpf', cpf(base)); p.fill('#senha', 'senha-forte-1'); p.fill('#senha2', 'senha-forte-1')
    p.check('input[type=checkbox]'); p.click('button[type=submit]')
    expect(p).not_to_have_url(re.compile('cadastro'))
    p.wait_for_load_state('networkidle')

def ir(p, *nomes):
    for n in nomes:
        p.get_by_role('link', name=n, exact=True).first.click()

with sync_playwright() as pw:
    nav = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pc = dict(viewport={'width': 1280, 'height': 860}, service_workers='block')
    cel = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')

    A = nav.new_context(**pc).new_page(); vigiar(A)   # administrador
    P = nav.new_context(**pc).new_page(); vigiar(P)   # personal
    ctxAna = nav.new_context(**cel)
    N = ctxAna.new_page(); vigiar(N)                  # aluna, no celular

    cadastrar(A, 'Matheus Admin', 'admin@exemplo.com', '529982247')
    cadastrar(P, 'Pedro Personal', 'pedro@exemplo.com', '111444777')

    # admin torna Pedro personal
    ir(A, 'Painel'); A.get_by_role('link', name=re.compile('Usuários')).click()
    linha = A.locator('tr', has_text='Pedro Personal')
    linha.get_by_role('button', name='Tornar personal').click()
    expect(linha.get_by_role('button', name=re.compile('Sim'))).to_be_visible()
    foto(A, '01-admin-usuarios')

    # Pedro gera convite
    P.reload()
    ir(P, 'Painel')
    P.get_by_role('link', name=re.compile('Meus alunos')).click()
    P.get_by_role('button', name='Gerar convite').click()
    codigo = P.locator('.codigo').inner_text().replace('-', '')
    assert re.fullmatch(r'[A-Z0-9]{8}', codigo), codigo
    foto(P, '02-personal-convite')

    # Ana abre o link antes de ter conta, cadastra e cai no convite
    N.goto(URL + '#/convite/' + codigo)
    expect(N.get_by_role('button', name='Entrar')).to_be_visible()
    cadastrar(N, 'Ana Aluna', 'ana@exemplo.com', '123456789')
    expect(N.get_by_role('heading', name=re.compile('quer ser seu personal'))).to_be_visible()
    foto(N, '03-aluna-convite')
    N.get_by_role('button', name='Aceitar convite').click()
    expect(N.get_by_text(re.compile('agora é seu personal'))).to_be_visible()

    # Pedro monta uma ficha para Ana com exercício novo
    P.get_by_role('link', name='← Painel').click()
    P.get_by_role('link', name=re.compile('Meus alunos')).click()
    P.get_by_role('link', name='Ana Aluna').click()
    P.get_by_role('tab', name=re.compile('Fichas')).click()
    P.get_by_role('button', name='Nova ficha').click()
    P.locator('input[id^="nome-"]').fill('Treino A')
    P.locator('input[id^="busca-"]').fill('Agachamento livre')
    P.get_by_role('button', name=re.compile('Criar "Agachamento livre"')).click()
    P.locator('select[id^="ne-g-"]').select_option('Quadríceps')
    P.get_by_role('button', name='Criar e adicionar').click()
    P.locator('input[id^="cp"]').first.fill('40'); P.locator('input[id^="cp"]').first.press('Tab')
    P.locator('input[id^="r"]').first.fill('10')
    P.get_by_role('button', name='Salvar ficha').click()
    expect(P.get_by_text('Ficha salva.')).to_be_visible()
    foto(P, '04-personal-ficha')

    # Ana treina a ficha prescrita, sobe a carga
    N.goto(URL + '#/'); N.reload()
    expect(N.get_by_text('Treino A').first).to_be_visible()
    ir(N, 'Fichas')
    expect(N.get_by_text('por Pedro Personal')).to_be_visible()
    N.locator('a.ficha', has_text='Treino A').click()
    expect(N.get_by_text(re.compile('Quem altera esta ficha é o seu personal'))).to_be_visible()
    foto(N, '05-aluna-ficha-prescrita')
    ir(N, 'Treino')
    N.get_by_role('button', name='Começar Treino A').click()
    N.locator('section.atual').wait_for()
    N.locator('input[id^="c-"]').first.fill('42,5'); N.locator('input[id^="c-"]').first.press('Tab')
    expect(N.locator('input[id^="c-"]').first).to_have_value('42,5')
    checks = N.locator('section.atual button.check')
    for i in range(checks.count()):
        checks.nth(i).click()
    try:
        N.get_by_role('button', name='Sim, atualizar').click(timeout=8000)
    except Exception:
        foto(N, 'falha'); raise
    N.get_by_role('button', name=re.compile('Tá pago! Terminar')).click()
    expect(N.get_by_role('heading', name='Tá pago!')).to_be_visible()

    # Pedro vê o ajuste e comenta
    P.get_by_role('link', name='← Meus alunos').click()
    expect(P.locator('tr', has_text='Ana Aluna').get_by_text('1 ajuste(s)')).to_be_visible()
    foto(P, '06-personal-alunos')
    P.get_by_role('link', name='Ana Aluna').click()
    P.get_by_role('tab', name=re.compile('Ajustes')).click()
    expect(P.get_by_text('42,5 kg').first).to_be_visible()
    foto(P, '07-personal-ajustes')
    P.get_by_role('button', name=re.compile('como vistos')).click()
    P.get_by_role('tab', name=re.compile('Treinos')).click()
    P.locator('.cab-sessao').first.click()
    P.get_by_placeholder('Comentar este treino').fill('Boa, Ana! <script>alert(1)</script> Mantenha a postura.')
    P.get_by_role('button', name='Enviar').click()
    expect(P.get_by_text(re.compile('Mantenha a postura'))).to_be_visible()

    # Ana vê o comentário e responde
    N.goto(URL + '#/'); N.reload()
    expect(N.get_by_text(re.compile('1 comentário\\(s\\) novo'))).to_be_visible()
    foto(N, '08-aluna-aviso-comentario')
    N.get_by_role('link', name=re.compile('comentário')).click()
    N.locator('.cab-sessao').first.click()
    expect(N.get_by_text('Boa, Ana! <script>alert(1)</script> Mantenha a postura.')).to_be_visible()
    N.get_by_placeholder(re.compile('Escrever para')).fill('Obrigada!')
    N.get_by_role('button', name='Enviar').click()
    expect(N.get_by_text('Obrigada!')).to_be_visible()
    foto(N, '09-aluna-comentarios')

    # admin cria grupo; Ana entra pelo código em Perfil
    A.get_by_role('link', name='← Painel').click()
    A.get_by_role('link', name=re.compile('^Grupos')).click()
    A.fill('#g-nome', 'Turma da manhã'); A.fill('#g-desc', 'Academia do bairro')
    A.get_by_role('button', name='Criar grupo').click()
    A.locator('a.grupo', has_text='Turma da manhã').click()
    A.get_by_role('button', name='Gerar convite').click()
    cod_g = A.locator('.codigo').inner_text()
    ir(N, 'Perfil')
    N.fill('#cod-conv', cod_g)
    N.get_by_role('button', name='Usar código').click()
    expect(N.get_by_role('heading', name=re.compile('Entrar no grupo'))).to_be_visible()
    N.get_by_role('button', name='Aceitar convite').click()
    expect(N.get_by_text(re.compile('você entrou no grupo'))).to_be_visible()
    ir(N, 'Perfil')
    expect(N.get_by_text('Turma da manhã')).to_be_visible()
    expect(N.get_by_text('Pedro Personal')).to_be_visible()
    foto(N, '10-aluna-perfil-vinculos')
    A.reload()
    expect(A.locator('tr', has_text='Ana Aluna')).to_be_visible()
    foto(A, '11-admin-grupo')

    # catálogo: Pedro propõe, admin aceita
    P.get_by_role('link', name='← Meus alunos').click(); P.get_by_role('link', name='← Painel').click()
    P.get_by_role('link', name=re.compile('Meus exercícios')).click()
    P.locator('tr', has_text='Agachamento livre').get_by_role('button', name='Propor').click()
    expect(P.get_by_text(re.compile('aguardando o administrador'))).to_be_visible()
    ir(A, 'Painel')
    expect(A.get_by_text('1 proposta(s)')).to_be_visible()
    foto(A, '12-admin-painel')
    A.get_by_role('link', name=re.compile('Catálogo')).click()
    A.get_by_role('button', name='Aceitar').click()
    expect(A.locator('tr', has_text='Agachamento livre')).to_be_visible()
    foto(A, '13-admin-catalogo')
    nav.close()

print('erros no console:', erros or 'nenhum')
sys.exit(1 if erros else 0)
