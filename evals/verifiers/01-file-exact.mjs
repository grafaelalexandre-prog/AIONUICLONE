import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.argv[2] ?? '');
const file = path.join(workspace, 'prova.txt');
const expected = 'fase0-opencode\n';
if (!fs.existsSync(file)) throw new Error('prova.txt does not exist');
const actual = fs.readFileSync(file, 'utf8');
if (actual !== expected) throw new Error(`content mismatch: ${JSON.stringify(actual)}`);
console.log(JSON.stringify({ passed: true, file, bytes: Buffer.byteLength(actual) }));
