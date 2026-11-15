# Teste de ponta a ponta da Fase 3: compra por Pix, liberação, programa pronto, sugestão de carga, medidas e exportação.
# Antes: build em frontend/dist-teste com VITE_API_URL=/api e  node testes/servidor-teste.js
# Rode: python3 testes/e2e/fase3.py
import os, re, sys
from playwright.sync_api import sync_playwright, expect

URL = 'http://localhost:8787/'
SAIDA = os.environ.get('SAIDA', '/tmp/e2e3')
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

def treinar(p, reps):
    p.get_by_role('link', name='Treino', exact=True).first.click()
    p.get_by_role('button', name=re.compile('^Começar')).click()
    expect(p.locator('section.atual')).to_be_visible()
    for r in p.locator('section.atual input[id^="r-"]').all():
        r.fill(str(reps)); r.press('Tab')
    for c in p.locator('section.atual button.check').all():
        c.click()

with sync_playwright() as pw:
    nav = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    A = nav.new_context(viewport={'width': 1280, 'height': 860}, service_workers='block').new_page(); vigiar(A)
    ctxN = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block', accept_downloads=True)
    N = ctxN.new_page(); vigiar(N)

    cadastrar(A, 'Matheus Admin', 'admin@exemplo.com', '529982247')
    cadastrar(N, 'Ana Aluna', 'ana@exemplo.com', '123456789')

    # sem chave Pix: compra indisponível
    N.get_by_role('link', name='Plano grátis').click()
    expect(N.get_by_text(re.compile('falta o administrador|precisa cadastrar a chave Pix'))).to_be_visible()

    # admin cadastra o Pix e um exercício no catálogo
    A.get_by_role('link', name='Painel', exact=True).click()
    A.get_by_role('link', name=re.compile('Premium e vendas')).click()
    A.fill('#chave', 'pix@exemplo.com'); A.fill('#nomer', 'Matheus Barbosa'); A.fill('#cid', 'João Pessoa')
    A.get_by_role('button', name='Salvar', exact=True).click()
    expect(A.get_by_text('Dados do Pix salvos.')).to_be_visible()
    foto(A, '01-admin-vendas')
    A.get_by_role('link', name='← Painel').click()
    A.get_by_role('link', name=re.compile('Catálogo')).click()
    A.get_by_role('button', name='Novo exercício').click()
    A.fill('#nv-n', 'Leg Press'); A.select_option('#nv-g', 'Quadríceps')
    A.get_by_role('button', name='Criar', exact=True).click()
    expect(A.get_by_text('"Leg Press" criado.')).to_be_visible()

    # aluna compra
    N.reload()
    expect(N.get_by_role('heading', name='Assinar')).to_be_visible()
    N.locator('.preco', has_text='Mensal').get_by_role('button', name='Comprar').click()
    expect(N.locator('.pedido')).to_be_visible()
    pix = N.locator('textarea.codigo-pix').input_value()
    assert pix.startswith('000201') and 'br.gov.bcb.pix' in pix and '54044.90' in pix, pix
    expect(N.get_by_alt_text('QR Code do Pix deste pedido')).to_be_visible()
    foto(N, '02-aluna-pix')
    N.get_by_role('button', name='Já paguei').click()
    expect(N.get_by_text(re.compile('Pagamento informado'))).to_be_visible()

    # admin libera
    A.get_by_role('link', name='← Painel').click()
    expect(A.get_by_text(re.compile('pedido\\(s\\) para conferir'))).to_be_visible()
    A.get_by_role('link', name=re.compile('Premium e vendas')).click()
    expect(A.get_by_text('1 para conferir')).to_be_visible()
    foto(A, '03-admin-pedidos')
    A.get_by_role('button', name='Liberar').click()
    expect(A.get_by_text(re.compile('liberado para Ana Aluna'))).to_be_visible()

    # aluna vira premium
    N.reload()
    expect(N.get_by_text(re.compile('Premium até'))).to_be_visible()
    foto(N, '04-aluna-premium')

    # admin publica programa grátis
    A.get_by_role('link', name='← Painel').click()
    A.get_by_role('link', name=re.compile('Programas prontos')).click()
    A.get_by_role('button', name='Novo programa').click()
    A.fill('#p-nome', 'Iniciante corpo inteiro'); A.fill('#p-desc', 'Três vezes por semana, com descanso entre os dias.')
    A.select_option('#p-niv', 'iniciante')
    A.locator('label', has_text='Grátis').locator('input').check()
    A.locator('input[id^="b-"]').first.fill('leg')
    A.get_by_role('button', name='Leg Press').click()
    A.locator('input[id^="r-"]').first.fill('12')
    A.get_by_role('button', name='Salvar programa').click()
    expect(A.get_by_text(re.compile('Programa "Iniciante corpo inteiro" salvo'))).to_be_visible()
    foto(A, '05-admin-programas')

    # aluna usa o programa e treina duas vezes: na segunda aparece a sugestão
    N.get_by_role('link', name='Fichas').first.click()
    N.get_by_role('link', name='Programas prontos').click()
    N.get_by_role('button', name='Usar este programa').click()
    N.get_by_role('button', name='Copiar').click()
    expect(N.get_by_text(re.compile('ficha\\(s\\) de "Iniciante corpo inteiro" copiadas'))).to_be_visible()
    foto(N, '06-aluna-programa')
    treinar(N, 12)
    N.locator('section.atual input[id^="c-"]').first  # sem carga ainda
    N.get_by_role('button', name=re.compile('Tá pago! Terminar')).click()
    expect(N.get_by_role('heading', name='Tá pago!')).to_be_visible()

    # segunda vez: com carga 100 e 12 reps → próxima sugere 102,5
    N.get_by_role('link', name='Início').count()
    N.get_by_role('link', name='Treino', exact=True).first.click()
    N.get_by_role('button', name=re.compile('^Começar')).click()
    expect(N.locator('section.atual')).to_be_visible()
    for c in N.locator('section.atual input[id^="c-"]').all():
        c.fill('100'); c.press('Tab')
    for r in N.locator('section.atual input[id^="r-"]').all():
        r.fill('12'); r.press('Tab')
    for c in N.locator('section.atual button.check').all():
        c.click()
    try:
        expect(N.get_by_role('button', name='8')).to_be_visible()  # esforço (premium)
    except Exception:
        foto(N, 'falha'); raise
    N.get_by_role('button', name='8').click()
    if N.get_by_role('button', name='Agora não').count(): N.get_by_role('button', name='Agora não').click()
    N.get_by_role('button', name=re.compile('Tá pago! Terminar')).click()
    expect(N.get_by_role('heading', name='Tá pago!')).to_be_visible()
    N.get_by_role('link', name='Treino', exact=True).first.click()
    N.get_by_role('button', name=re.compile('^Começar')).click()
    expect(N.get_by_text(re.compile('Sugestão: 102,5 kg'))).to_be_visible()
    expect(N.get_by_text(re.compile('esforço 8 de 10'))).to_be_visible()
    foto(N, '07-aluna-sugestao')
    N.get_by_role('button', name='Usar', exact=True).click()
    expect(N.locator('section.atual input[id^="c-"]').first).to_have_value('102,5')
    N.get_by_role('button', name='Descartar este treino').click()
    N.get_by_role('button', name='Apagar').click()

    # medidas (premium: todas) e exportação
    N.get_by_role('link', name='Evolução').click()
    N.get_by_role('button', name='Registrar medidas').click()
    N.fill('#md-peso_kg', '61,5'); N.fill('#md-cintura_cm', '72')
    N.get_by_role('button', name='Salvar', exact=True).click()
    expect(N.locator('td', has_text='61,5')).to_be_visible()
    with N.expect_download() as d:
        N.get_by_role('button', name='Séries', exact=True).click()
    caminho = d.value.path()
    conteudo = open(caminho, encoding='utf-8-sig').read()
    assert conteudo.startswith('data_hora;ficha;exercicio') and 'Leg Press' in conteudo and '100' in conteudo, conteudo[:200]
    foto(N, '08-aluna-evolucao')
    nav.close()

print('erros no console:', erros or 'nenhum')
sys.exit(1 if erros else 0)
