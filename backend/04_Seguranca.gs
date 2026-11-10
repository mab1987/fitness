/**
 * Segurança: validação de entradas, CPF, senhas (bcrypt) e tokens.
 */

// ---------- Validação (regra de segurança 3: o servidor valida tudo) ----------

function texto_(valor, campo, min, max, obrigatorio) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) throw erro_('VALIDACAO', 'Preencha o campo ' + campo + '.');
    return '';
  }
  if (typeof valor !== 'string') throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  var t = valor.trim();
  if (t.length < min) throw erro_('VALIDACAO', campo + ' precisa ter pelo menos ' + min + ' caracteres.');
  if (t.length > max) throw erro_('VALIDACAO', campo + ' pode ter no máximo ' + max + ' caracteres.');
  return t;
}

function email_(valor) {
  var e = texto_(valor, 'e-mail', 5, 120, true).toLowerCase();
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(e)) throw erro_('VALIDACAO', 'E-mail inválido.');
  return e;
}

function nomeUsuario_(valor) {
  if (!valor) return '';
  var u = texto_(valor, 'nome de usuário', 3, 30, false).toLowerCase();
  if (!/^[a-z0-9._]+$/.test(u)) throw erro_('VALIDACAO', 'O nome de usuário aceita só letras sem acento, números, ponto e sublinhado.');
  return u;
}

function senha_(valor) {
  if (typeof valor !== 'string' || valor.length < 8) throw erro_('VALIDACAO', 'A senha precisa ter pelo menos 8 caracteres.');
  if (Utilities.newBlob(valor).getBytes().length > 72) throw erro_('VALIDACAO', 'A senha pode ter no máximo 72 caracteres.');
  return valor;
}

function opcao_(valor, campo, opcoes) {
  if (opcoes.indexOf(valor) < 0) throw erro_('VALIDACAO', 'Valor inválido em ' + campo + '.');
  return valor;
}

// ---------- CPF ----------

function cpfDigitos_(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function cpfValido_(valor) {
  var c = cpfDigitos_(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (var t = 9; t < 11; t++) {
    var soma = 0;
    for (var i = 0; i < t; i++) soma += Number(c.charAt(i)) * (t + 1 - i);
    var dv = (soma * 10) % 11 % 10;
    if (dv !== Number(c.charAt(t))) return false;
  }
  return true;
}

/** Impressão digital do CPF (HMAC-SHA256 com segredo do servidor). O CPF completo nunca é gravado. */
function cpfHash_(valor) {
  var segredo = prop_('CPF_SEGREDO', true);
  return hex_(Utilities.computeHmacSha256Signature(cpfDigitos_(valor), segredo));
}

function cpfMascarado_(valor) {
  var c = cpfDigitos_(valor);
  return '***.' + c.substr(3, 3) + '.' + c.substr(6, 3) + '-**';
}

// ---------- Senhas (bcrypt) ----------

function bcrypt_() {
  var b = globalThis.dcodeIO.bcrypt;
  if (!b._fallbackPronto) {
    // Apps Script não tem Web Crypto: usa UUIDs aleatórios do Google como fonte de bytes.
    b.setRandomFallback(function (n) { return bytesAleatorios_(n); });
    b._fallbackPronto = true;
  }
  return b;
}

function hashSenha_(senha) {
  var custo = Number(prop_('BCRYPT_CUSTO', false)) || 10;
  return bcrypt_().hashSync(senha, custo);
}

function confereSenha_(senha, hash) {
  if (!hash) return false;
  return bcrypt_().compareSync(senha, hash);
}

// ---------- Tokens e utilitários ----------

function bytesAleatorios_(n) {
  var saida = [];
  while (saida.length < n) {
    var bloco = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
    for (var i = 0; i < bloco.length && saida.length < n; i++) saida.push(bloco[i] & 0xff);
  }
  return saida;
}

function tokenAleatorio_() {
  return hex_(bytesAleatorios_(32));
}

function sha256_(texto) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Limite de tentativas (login, recuperação de senha). */
function contarTentativa_(chave) {
  var cache = CacheService.getScriptCache();
  var k = 'tent:' + sha256_(chave);
  var n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), APP.JANELA_TENTATIVAS_SEG);
  return n;
}

function tentativasEsgotadas_(chave) {
  var n = Number(CacheService.getScriptCache().get('tent:' + sha256_(chave)) || 0);
  return n >= APP.MAX_TENTATIVAS_LOGIN;
}

function zerarTentativas_(chave) {
  CacheService.getScriptCache().remove('tent:' + sha256_(chave));
}
