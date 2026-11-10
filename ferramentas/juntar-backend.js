// Junta todos os arquivos do backend em um só (backend/dist/Codigo.gs), para colar no editor do Apps Script.
// Uso: node ferramentas/juntar-backend.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'backend');
const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).sort();
const partes = arquivos.map((f) => `// ===== ${f} =====\n` + fs.readFileSync(path.join(dir, f), 'utf8'));
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'Codigo.gs'), '// Meu treino — backend completo (gerado por ferramentas/juntar-backend.js). Não edite aqui.\n\n' + partes.join('\n\n'));
console.log('backend/dist/Codigo.gs gerado com ' + arquivos.length + ' arquivos.');
