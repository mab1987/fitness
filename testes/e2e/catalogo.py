# Ponta a ponta do catálogo base: importar a planilha antiga, conferir e aplicar o catálogo, montar ficha por grupo.
# Precisa de testes/planilha-antiga.local.json (só na máquina de quem tem o arquivo).
import os, re, sys
from playwright.sync_api import sync_playwright, expect

URL = 'http://localhost:8787/'
SAIDA = os.environ.get('SAIDA', '/tmp/e2e-cat')
os.makedirs(SAIDA, exist_ok=True)
ID_ANTIGA = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
erros = []

def cpf(base):
    d = [int(c) for c in base]
    for t in (9, 10):
        s = sum(d[i] * (t + 1 - i) for i in range(t))
        d.append((s * 10) % 11 % 10)
    return ''.join(map(str, d))

with sync_playwright() as pw:
    nav = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    p = nav.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block').new_page()
    p.on('console', lambda m: m.type == 'error' and erros.append(m.text))
    p.on('pageerror', lambda e: erros.append(str(e)))
    p.goto(URL + '#/cadastro')
    p.fill('#nome', 'Matheus'); p.fill('#email', 'admin@exemplo.com'); p.fill('#cpf', cpf('529982247'))
    p.fill('#senha', 'senha-forte-1'); p.fill('#senha2', 'senha-forte-1'); p.check('input[type=checkbox]'); p.click('button[type=submit]')
    expect(p).not_to_have_url(re.compile('cadastro'))

    p.get_by_role('link', name='Painel', exact=True).click()
    p.get_by_role('link', name=re.compile('Importar planilha antiga')).click()
    p.fill('#imp-end', ID_ANTIGA)
    p.get_by_role('button', name='Ver prévia').click()
    p.get_by_role('button', name='Importar agora').click()
    expect(p.get_by_text(re.compile('Importado:'))).to_be_visible(timeout=20000)

    p.get_by_role('link', name='← Painel').click()
    p.get_by_role('link', name=re.compile('Catálogo')).click()
    p.get_by_role('button', name='Ver o que vai mudar').click()
    expect(p.get_by_text(re.compile('Tríceps Corda → '))).to_be_visible()
    p.screenshot(path=f'{SAIDA}/01-previa.png', full_page=True)
    p.locator('label', has_text='Supino Inclinado').locator('input').check()
    p.get_by_role('button', name='Aplicar').click()
    expect(p.get_by_text(re.compile('Catálogo atualizado'))).to_be_visible(timeout=30000)
    p.select_option('#grupo-cat', 'Posterior de coxa')
    expect(p.locator('td', has_text='Stiff com barra')).to_be_visible()
    p.select_option('#grupo-cat', '')
    p.fill('#busca-cat', 'triceps corda')
    expect(p.locator('td', has_text='Tríceps na polia com corda')).to_be_visible()
    p.screenshot(path=f'{SAIDA}/02-catalogo.png', full_page=True)

    # ficha: escolher por grupo
    p.goto(URL + '#/fichas/nova')
    p.locator('select[id^="grupo-"]').select_option('Glúteos')
    try:
        expect(p.get_by_role('button', name=re.compile('Elevação pélvica com barra'))).to_be_visible()
    except Exception:
        p.screenshot(path=f'{SAIDA}/falha.png', full_page=True); raise
    p.screenshot(path=f'{SAIDA}/03-ficha-por-grupo.png', full_page=True)

    # histórico continua ligado ao nome novo
    p.get_by_role('link', name='Evolução').click()
    p.select_option('#ex', label='Tríceps na polia com corda')
    expect(p.locator('svg[role=img]').or_(p.get_by_text(re.compile('Sem registros')))).to_be_visible()
    nav.close()

print('erros no console:', erros or 'nenhum')
sys.exit(1 if erros else 0)
