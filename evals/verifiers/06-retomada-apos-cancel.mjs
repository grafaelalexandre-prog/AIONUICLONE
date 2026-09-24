import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.argv[2] ?? '');
const required = ['etapa-2.txt', 'retomada.txt'];
for (const name of required) {
  if (!fs.existsSync(path.join(workspace, name))) throw new Error(`${name} does not exist`);
}
const resume = fs.readFileSync(path.join(workspace, 'retomada.txt'), 'utf8');
if (!resume.includes('PASSO_1') || !resume.includes('PASSO_2')) {
  throw new Error('retomada.txt does not prove both steps were present');
}
console.log(JSON.stringify({ passed: true, artifacts: required }));
