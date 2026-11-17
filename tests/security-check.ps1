$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = 0

function Check($label, $condition) {
  if ($condition) {
    Write-Host "[PASS] $label" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $label" -ForegroundColor Red
    $script:failures++
  }
}

$jsFiles = Get-ChildItem "$root\js\*.js"
$jsText = ($jsFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
$indexHtml = Get-Content "$root\index.html" -Raw
$adminHtml = Get-Content "$root\admin.html" -Raw

Check "Sin eval(), new Function() ni document.write() en JS" ($jsText -notmatch '\b(eval|document\.write)\s*\(|new\s+Function\s*\(')
Check "index.html incluye Content-Security-Policy" ($indexHtml -match 'http-equiv="Content-Security-Policy"')
Check "admin.html incluye Content-Security-Policy" ($adminHtml -match 'http-equiv="Content-Security-Policy"')
Check "index.html no carga composer.js" ($indexHtml -notmatch 'composer\.js')
Check "Enlaces target=_blank incluyen rel=noopener noreferrer" ($indexHtml -notmatch 'target="_blank"(?![^>]*rel="noopener noreferrer")')
Check "escapeHtml y sanitizeUrl definidos en data.js" ((Get-Content "$root\js\data.js" -Raw) -match 'function escapeHtml' -and (Get-Content "$root\js\data.js" -Raw) -match 'function sanitizeUrl')
Check "app.js usa escapeHtml y sanitizeUrl" ((Get-Content "$root\js\app.js" -Raw) -match 'escapeHtml\(' -and (Get-Content "$root\js\app.js" -Raw) -match 'sanitizeUrl\(')
Check "composer.js usa escapeHtml y sanitizeUrl" ((Get-Content "$root\js\composer.js" -Raw) -match 'escapeHtml\(' -and (Get-Content "$root\js\composer.js" -Raw) -match 'sanitizeUrl\(')

if ($failures -gt 0) {
  Write-Error "$failures comprobacion(es) fallaron."
  exit 1
}
Write-Host "Todas las comprobaciones estaticas pasaron." -ForegroundColor Cyan
