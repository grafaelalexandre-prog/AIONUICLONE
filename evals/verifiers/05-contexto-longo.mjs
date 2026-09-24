import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.argv[2] ?? '');
const file = path.join(workspace, 'resposta-contexto.txt');
if (!fs.existsSync(file)) throw new Error('resposta-contexto.txt does not exist');
const content = fs.readFileSync(file, 'utf8');
if (!content.includes('ARQUIVO=entrada-11.txt')) throw new Error('target file is not entrada-11.txt');
if (!content.includes('VALOR=ALVO-UNICO-7F3A')) throw new Error('target token is missing');
console.log(JSON.stringify({ passed: true, targetFile: 'entrada-11.txt', token: 'ALVO-UNICO-7F3A' }));
