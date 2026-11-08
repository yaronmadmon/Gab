$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$target = Join-Path $repoRoot '.env.local'
$secure = Read-Host 'Paste your existing OpenAI API key here (input is hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($key)) { throw 'No key was entered.' }
    $lines = if (Test-Path -LiteralPath $target) { @(Get-Content -LiteralPath $target) } else { @() }
    $lines = @($lines | Where-Object { $_ -notmatch '^\s*OPENAI_API_KEY\s*=' })
    $lines += "OPENAI_API_KEY=$key"
    if (-not ($lines | Where-Object { $_ -match '^\s*OPENAI_MODEL\s*=' })) { $lines += 'OPENAI_MODEL=gpt-6-luna' }
    if (-not ($lines | Where-Object { $_ -match '^\s*EXPO_PUBLIC_API_BASE_URL\s*=' })) { $lines += 'EXPO_PUBLIC_API_BASE_URL=http://localhost:8787' }
    [IO.File]::WriteAllLines($target, [string[]]$lines, [Text.UTF8Encoding]::new($false))
    Write-Host 'Saved to the ignored .env.local file. The key was not displayed.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $key = $null
}
