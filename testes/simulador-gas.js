// Simula o ambiente do Google Apps Script em Node para testar o backend sem publicar.
// Uso: node testes/backend.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function bytesComSinal(buf) {
  return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
}

class Faixa {
  constructor(aba, r, c, nr, nc) { Object.assign(this, { aba, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const linha = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.aba.dados[this.r - 1 + i] || [])[this.c - 1 + j];
        linha.push(v === undefined ? '' : v);
      }
      out.push(linha);
    }
    return out;
  }
  setValues(vals) {
    vals.forEach((linha, i) => linha.forEach((v, j) => this.aba.gravar(this.r + i, this.c + j, v)));
    return this;
  }
}

class Aba {
  constructor(nome) { this.nome = nome; this.dados = []; this.formulas = []; this.brutos = []; }
  getName() { return this.nome; }
  gravar(r, c, v) {
    while (this.dados.length < r) this.dados.push([]);
    this.brutos.push(v);
    // Como o Sheets: apóstrofo inicial = texto puro (e não faz parte do valor); "=" inicial = fórmula.
    if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1);
    else if (typeof v === 'string' && /^[=+\-@]/.test(v)) this.formulas.push(v);
    this.dados[r - 1][c - 1] = v;
  }
  getLastRow() { return this.dados.length; }
  getLastColumn() { return this.dados.reduce((m, l) => Math.max(m, l.length), 0); }
  getDataRange() { return new Faixa(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(r, c, nr = 1, nc = 1) { return new Faixa(this, r, c, nr, nc); }
  appendRow(linha) { const r = this.dados.length + 1; linha.forEach((v, j) => this.gravar(r, j + 1, v)); }
  setFrozenRows() {}
}

class Planilha {
  constructor(id = 'planilha-teste', fuso = 'America/Fortaleza') { this.id = id; this.fuso = fuso; this.abas = [new Aba('Página1')]; }
  getId() { return this.id; }
  getSpreadsheetTimeZone() { return this.fuso; }
  getSheetByName(n) { return this.abas.find((a) => a.nome === n) || null; }
  insertSheet(n) { const a = new Aba(n); this.abas.push(a); return a; }
  getSheets() { return this.abas.slice(); }
  deleteSheet(a) { this.abas = this.abas.filter((x) => x !== a); }
}

function criarAmbiente() {
  const planilha = new Planilha();
  const outras = {}; // outras planilhas que o script consegue abrir (ex.: a planilha antiga da importação)
  const props = {};
  const cache = {};
  const emails = [];
  const ctx = {
    console: { log() {}, error: (...a) => ctx._erros.push(a.join(' ')) },
    _erros: [],
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha, openById: (id) => {
      if (id === planilha.getId()) return planilha;
      if (outras[id]) return outras[id];
      throw new Error('Planilha inexistente: ' + id);
    } },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: (k) => { delete cache[k]; },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, txt) => bytesComSinal(crypto.createHash('sha256').update(String(txt), 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => bytesComSinal(crypto.createHmac('sha256', k).update(String(v), 'utf8').digest()),
      // Só o formato usado pelo backend: yyyy-MM-dd'T'HH:mm:ss
      formatDate: (data, fuso, formato) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
          timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        }).formatToParts(data).map((x) => [x.type, x.value]));
        if (formato !== "yyyy-MM-dd'T'HH:mm:ss") throw new Error('formato não simulado: ' + formato);
        return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
      },
      newBlob: (s) => ({ getBytes: () => Array.from(Buffer.from(s, 'utf8')) }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }),
    },
    MailApp: { sendEmail: (m) => emails.push(m) },
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'backend');
  fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });
  /** Cria outra planilha (abas: { nome: [[cabeçalho...], [linha...]] }) que o script pode abrir pelo id. */
  function criarOutraPlanilha(id, abas, fuso) {
    const p = new Planilha(id, fuso);
    p.abas = [];
    Object.keys(abas).forEach((n) => { const a = p.insertSheet(n); a.dados = abas[n].map((l) => l.slice()); });
    outras[id] = p;
    return p;
  }
  return { ctx, planilha, props, cache, emails, criarOutraPlanilha };
}

module.exports = { criarAmbiente, Planilha };
