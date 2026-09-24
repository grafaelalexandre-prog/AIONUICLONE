# Testes

Os testes unitários usam **Bun** e o gerenciador de dependências é `bun`:

```bash
bun run test -- <paths> --reporter=dot
```

## Testes nativos de SQLite no runtime do Electron

`better-sqlite3` é um módulo nativo. O Node usado pelo host pode ter um ABI
diferente do Node embutido no Electron; nesse caso, use o mesmo runtime do
Electron que executa o aplicativo para evitar o erro de módulo ABI inválido.

No PowerShell, a forma recomendada para os testes SQLite é:

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
$electron = Join-Path (Get-Location) 'node_modules\electron\dist\electron.exe'
$arguments = @(
  'node_modules/vitest/vitest.mjs', 'run',
  'tests/unit/process/task/kanbanRepository.test.ts',
  'tests/unit/process/task/taskRunner.test.ts',
  'tests/unit/conversation/projectAgent/missionPrompt.test.ts',
  'tests/unit/conversation/projectAgent/projectContext.test.ts',
  '--reporter=dot', '--pool=threads', '--maxWorkers=1', '--no-file-parallelism'
)
$process = Start-Process -FilePath $electron -ArgumentList $arguments -Wait -PassThru -NoNewWindow
Remove-Item Env:ELECTRON_RUN_AS_NODE
exit $process.ExitCode
```

O pool `threads` com um worker mantém a execução no runtime do Electron e evita
que o Vitest tente iniciar processos filhos com o executável do Electron. O
comando deve ser executado a partir da raiz do repositório, após
`bun install --frozen-lockfile`.
