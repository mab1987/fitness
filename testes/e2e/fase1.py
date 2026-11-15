# Teste de ponta a ponta da Fase 1 (celular e computador, com e sem internet).
# Antes: node testes/servidor-teste.js  (e o build em frontend/dist-teste com VITE_API_URL=/api)
# Rode: python3 testes/e2e/fase1.py
import os, re, sys
from playwright.sync_api import sync_playwright, expect

URL = 'http://localhost:8787/'
SAIDA = os.environ.get('SAIDA', '/tmp/e2e')
os.makedirs(SAIDA, exist_ok=True)
ID_ANTIGA = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
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
    p.on('console', lambda m: m.type == 'error' and 'ERR_INTERNET_DISCONNECTED' not in m.text and erros.append(m.text))
    p.on('pageerror', lambda e: erros.append(str(e)))

with sync_playwright() as pw:
    nav = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    cel = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
    p = cel.new_page(); vigiar(p)

    # cadastro do admin
    p.goto(URL + '#/cadastro')
    p.fill('#nome', 'Matheus Barbosa'); p.fill('#email', 'admin@exemplo.com'); p.fill('#usuario', 'matheus')
    p.fill('#cpf', cpf('529982247')); p.fill('#senha', 'senha-forte-1'); p.fill('#senha2', 'senha-forte-1')
    p.check('input[type=checkbox]'); p.click('button[type=submit]')
    expect(p.get_by_role('heading', name=re.compile('Monte sua primeira ficha'))).to_be_visible()
    foto(p, '01-inicio-vazio')

    # importação pela tela
    p.get_by_role('link', name='Painel').click()
    p.get_by_role('link', name=re.compile('Importar planilha antiga')).click()
    p.fill('#imp-end', f'https://docs.google.com/spreadsheets/d/{ID_ANTIGA}/edit#gid=0')
    p.fill('#imp-ren', 'Panturrilha Sentadilha = Panturrilha Sentada')
    p.get_by_role('button', name='Ver prévia').click()
    expect(p.get_by_text(re.compile(r'128 treinos'))).to_be_visible()
    foto(p, '02-previa-importacao')
    p.get_by_role('button', name='Importar agora').click()
    expect(p.get_by_text(re.compile('Importado: 128 treinos novos'))).to_be_visible(timeout=20000)

    # início com a próxima ficha
    p.get_by_role('link', name='Treino', exact=True).click()
    expect(p.get_by_text('Próximo treino')).to_be_visible()
    expect(p.get_by_text('Premium · sem prazo').first).to_be_visible()
    foto(p, '03-inicio-com-dados')
    proxima = p.locator('#t-prox').inner_text()
    p.get_by_role('button', name=f'Começar {proxima}').click()
    p.locator('section.atual').wait_for()

    # treino: sobe a carga da 1ª série, marca as séries do 1º exercício
    expect(p.get_by_text('Série 1', exact=True)).to_be_visible()
    c1 = p.locator('input[id^="c-"]').first
    atual = float(c1.input_value().replace(',', '.') or 0)
    nova = atual + 2.5
    c1.fill(str(nova).replace('.', ',')); c1.press('Tab')
    foto(p, '04-treino-inicio')
    checks = p.locator('section.atual button.check')
    for i in range(checks.count()):
        checks.nth(i).click()
    expect(p.get_by_text('Descanso')).to_be_visible()
    expect(p.get_by_text(re.compile('Usar essa carga no próximo treino'))).to_be_visible()
    foto(p, '05-treino-descanso-ajuste')
    p.get_by_role('button', name='Sim, atualizar').click()

    # recarregar a página no meio do treino não perde nada
    p.reload()
    expect(p.get_by_text('ficha atualizada')).to_be_visible()

    # sem internet: faz o 2º exercício e termina
    cel.set_offline(True)
    checks = p.locator('section.atual button.check')
    for i in range(checks.count()):
        checks.nth(i).click()
    resp = p.get_by_role('button', name='Agora não')
    if resp.count(): resp.click()
    p.get_by_role('button', name='Pular').click()
    p.fill('#obs', '<img src=x onerror=alert(1)> treino ok')
    p.get_by_role('button', name=re.compile('Tá pago! Terminar')).click()
    expect(p.get_by_role('heading', name='Tá pago!')).to_be_visible()
    expect(p.get_by_text(re.compile('Sem internet agora'))).to_be_visible()
    expect(p.get_by_text('1 a enviar')).to_be_visible()
    foto(p, '06-ta-pago-offline')

    # volta a internet: envia sozinho
    cel.set_offline(False)
    p.evaluate("window.dispatchEvent(new Event('online'))")
    expect(p.get_by_text('1 a enviar')).to_have_count(0, timeout=10000)

    # evolução
    p.get_by_role('link', name='Ver evolução').click()
    expect(p.get_by_text(re.compile(r'Histórico · 129 treinos'))).to_be_visible()
    graf = p.locator('svg[role=img]')
    if graf.count(): graf.tap(position={'x': 250, 'y': 80})
    foto(p, '07-evolucao')
    p.locator('.cab-sessao').first.click()
    expect(p.get_by_text('<img src=x onerror=alert(1)> treino ok')).to_be_visible()  # aparece como texto

    # fichas
    p.get_by_role('link', name='Fichas').click()
    expect(p.locator('a.ficha', has_text='Treino A')).to_be_visible()
    foto(p, '08-fichas')
    p.locator('a.ficha', has_text='Treino A').click()
    expect(p.locator('input[id^="nome-"]')).to_have_value('Treino A')
    p.locator('input[id^="busca-"]').fill( 'rosca')
    expect(p.locator('.resultado').first).to_be_visible()
    foto(p, '09-ficha-editor')

    # nova ficha com exercício criado na hora (com vídeo)
    p.goto(URL + '#/fichas/nova')
    p.locator('input[id^="nome-"]').fill('Treino F')
    p.locator('input[id^="busca-"]').fill( 'Afundo búlgaro')
    p.get_by_role('button', name=re.compile('Criar "Afundo búlgaro"')).click()
    p.locator('select[id^="ne-g-"]').select_option('Quadríceps'); p.locator('input[id^="ne-v-"]').fill('https://youtu.be/dQw4w9WgXcQ')
    p.get_by_role('button', name='Criar e adicionar').click()
    p.get_by_role('button', name='Salvar ficha').click()
    expect(p.get_by_text('Ficha salva.')).to_be_visible()

    # ver como aluno grátis: limite aparece e nada grava
    p.get_by_role('link', name='Painel', exact=True).click()
    p.select_option('#papel', 'aluno_gratis'); p.get_by_role('button', name='Ver como').click()
    expect(p.get_by_text(re.compile('Vendo como'))).to_be_visible()
    p.get_by_role('link', name='Fichas').click()
    expect(p.get_by_text(re.compile('limite de 3 fichas'))).to_be_visible()
    p.get_by_role('link', name='Evolução').click()
    try:
        expect(p.get_by_text(re.compile('mostra o último mês'))).to_be_visible()
    except Exception:
        foto(p, 'falha'); raise
    foto(p, '10-ver-como-gratis')
    p.get_by_role('button', name='Sair do modo').click()

    # computador, modo escuro
    pc = nav.new_context(viewport={'width': 1280, 'height': 860}, color_scheme='dark', service_workers='block')
    tok = cel.storage_state()
    q = pc.new_page(); vigiar(q)
    q.goto(URL)
    q.evaluate("s => { for (const o of s.origins) for (const i of o.localStorage) localStorage.setItem(i.name, i.value) }", tok)
    q.reload()
    q.get_by_role('link', name='Evolução').click()
    try:
        expect(q.get_by_text(re.compile(r'Histórico · 129 treinos'))).to_be_visible(timeout=15000)
    except Exception:
        foto(q, 'falha-pc'); raise
    q.select_option('#per', '0')
    q.get_by_role('button', name='1RM').click()
    foto(q, '11-evolucao-pc-escuro')
    q.get_by_role('link', name='Fichas').click()
    q.locator('a.ficha', has_text='Treino B').click()
    foto(q, '12-ficha-pc-escuro')
    q.get_by_role('link', name='Treino', exact=True).click()
    expect(q.get_by_text('Próximo treino')).to_be_visible()
    foto(q, '13-inicio-pc-escuro')
    nav.close()

print('erros no console:', erros or 'nenhum')
sys.exit(1 if erros else 0)
