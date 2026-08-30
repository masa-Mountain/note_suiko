# suikou - local static file server (ASCII only, for PowerShell 5.1 compatibility)
#
#   Usage:  powershell -ExecutionPolicy Bypass -File .\serve.ps1
#   Stop:   Ctrl+C
#
# index.html also works by double-clicking it (file://).
# Use this server only if your browser blocks local files.
# Binds to 127.0.0.1 only; nothing is exposed to the network.

param(
  [int]$Port = 8787
)

$root = $PSScriptRoot
$prefix = "http://127.0.0.1:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind port $Port. Try: .\serve.ps1 -Port 9000" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  suikou is served locally" -ForegroundColor Yellow
Write-Host "  $prefix" -ForegroundColor Cyan
Write-Host "  self test: ${prefix}test.html" -ForegroundColor DarkCyan
Write-Host "  press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$rootFull = [System.IO.Path]::GetFullPath($root)

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }
  $req = $context.Request
  $res = $context.Response

  $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
  $path = Join-Path $root $rel
  try {
    $full = [System.IO.Path]::GetFullPath($path)
  } catch {
    $res.StatusCode = 400
    $res.Close()
    continue
  }

  if (-not $full.StartsWith($rootFull)) {
    $res.StatusCode = 403
    $res.Close()
    continue
  }

  if (Test-Path -LiteralPath $full -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
    else { $res.ContentType = 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 not found')
    $res.OutputStream.Write($msg, 0, $msg.Length)
  }
  $res.Close()
}

$listener.Stop()
