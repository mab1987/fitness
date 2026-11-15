// Guarda dados no aparelho (IndexedDB) para o app abrir e registrar treino sem internet.
// É um "armário" simples de chave → valor. Se o navegador não deixar usar, cai para a memória.
const BANCO = 'meutreino';
const LOJA = 'kv';
let promessa = null;
const memoria = new Map();

function abrir() {
  if (promessa) return promessa;
  promessa = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return promessa;
}

function pedido(modo, fn) {
  return abrir().then((db) => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LOJA, modo);
      const r = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  });
}

export async function ler(chave) {
  try {
    const v = await pedido('readonly', (s) => (s ? s.get(chave) : null));
    return v === undefined ? (memoria.has(chave) ? memoria.get(chave) : null) : v;
  } catch {
    return memoria.has(chave) ? memoria.get(chave) : null;
  }
}

export async function gravar(chave, valor) {
  // Cópia "limpa" (sem objetos reativos do Vue), que o IndexedDB aceita.
  const limpo = valor === undefined ? null : JSON.parse(JSON.stringify(valor));
  memoria.set(chave, limpo);
  try {
    await pedido('readwrite', (s) => (s ? s.put(limpo, chave) : null));
  } catch { /* fica só na memória */ }
}

export async function apagarComPrefixo(prefixo) {
  for (const k of [...memoria.keys()]) if (k.startsWith(prefixo)) memoria.delete(k);
  try {
    await pedido('readwrite', (s) => {
      if (!s) return null;
      const intervalo = IDBKeyRange.bound(prefixo, prefixo + '￿');
      return s.delete(intervalo);
    });
  } catch { /* ignora */ }
}
