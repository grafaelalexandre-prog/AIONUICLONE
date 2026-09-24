import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.argv[2] ?? '');
const file = path.join(workspace, 'resumo.md');
if (!fs.existsSync(file)) throw new Error('resumo.md does not exist');
const content = fs.readFileSync(file, 'utf8');
if (!content.includes('ARQUIVOS:10')) throw new Error('missing ARQUIVOS:10');
for (let index = 1; index <= 10; index += 1) {
  const name = `arquivo-${String(index).padStart(2, '0')}.txt`;
  if (!content.includes(name)) throw new Error(`summary does not cite ${name}`);
}
console.log(JSON.stringify({ passed: true, citedFiles: 10, bytes: Buffer.byteLength(content) }));
