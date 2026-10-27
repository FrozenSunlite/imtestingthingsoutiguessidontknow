$root = Join-Path $PSScriptRoot "desktop\app-dist\client"
$shell = "_shell.html"
$port = 4173
$mimes = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".map"="application/json"
}
$url = "http://localhost:$port"
# Terminate any existing server on this port
try { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}
Start-Sleep -Milliseconds 300
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = (Get-Command "msedge" -ErrorAction SilentlyContinue).Source }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("$url/")
$listener.Start()
$launched = $false
if ($edgePath) { try { Start-Process $edgePath -ArgumentList "--app=$url","--start-fullscreen" | Out-Null; $launched=$true } catch {} }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  $file = Join-Path $root $path
  if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root $shell }
  $ext = [IO.Path]::GetExtension($file).ToLower()
  $ct = if ($mimes[$ext]) { $mimes[$ext] } else { "application/octet-stream" }
  $bytes = [IO.File]::ReadAllBytes($file)
  $ctx.Response.ContentType = $ct
  $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
  $ctx.Response.Close()
}

