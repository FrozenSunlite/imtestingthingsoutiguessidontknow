$root = Join-Path $PSScriptRoot "desktop\app-dist\client"
$shell = "_shell.html"
$port = 4173
$listener = New-Object System.Net.HttpListener
while ($true) {
  try { $listener.Prefixes.Clear(); $listener.Prefixes.Add("http://localhost:$port/"); $listener.Start(); break } catch { $port++; if ($port -gt 4200) { exit } }
}
$mimes = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".map"="application/json"
}
$url = "http://localhost:$port"
$launched = $false
foreach ($exe in @("msedge","chrome")) {
  $c = (Get-Command $exe -ErrorAction SilentlyContinue)
  if ($c) { try { Start-Process $exe -ArgumentList "--app=$url","--start-fullscreen" | Out-Null; $launched=$true; break } catch {} }
}
if (-not $launched) { try { Start-Process $url } catch {} }
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
