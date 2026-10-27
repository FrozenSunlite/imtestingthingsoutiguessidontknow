$root = Join-Path $PSScriptRoot "desktop\app-dist\client"
$shell = "_shell.html"
$port = 4173
# Imported artwork lives outside the build folder so rebuilding the app never
# wipes it. It is served back from /images/.
$uploadRoot = Join-Path $PSScriptRoot "desktop\userdata\images"
New-Item -ItemType Directory -Force -Path $uploadRoot | Out-Null
$mimes = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".bmp"="image/bmp"; ".avif"="image/avif"; ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".map"="application/json"
}
$url = "http://localhost:$port"
# Terminate any existing server instance. HttpListener sockets are owned by the
# HTTP.sys kernel driver, so the port owner is PID 4 (System) and killing the
# port owner never works. Track the server's own PID instead (and fall back to
# the one powershell whose command line is just this script).
$pidFile = Join-Path $PSScriptRoot "server.pid"
if (Test-Path $pidFile) {
  $oldPid = 0
  [void][int]::TryParse((Get-Content $pidFile -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$oldPid)
  if ($oldPid -gt 0 -and $oldPid -ne $PID) {
    $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($oldProc -and $oldProc.ProcessName -like "*powershell*") { Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}
Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'Serve\.ps1"?\s*$' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
Set-Content -Path $pidFile -Value $PID
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = (Get-Command "msedge" -ErrorAction SilentlyContinue).Source }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("$url/")
$listener.Start()
$launched = $false
if ($edgePath) { try { Start-Process $edgePath -ArgumentList "--app=$url","--start-fullscreen" | Out-Null; $launched=$true } catch {} }
while ($listener.IsListening) {
  $ctx = $null
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
    $res.Headers.Add("Cache-Control", "no-store")

    # --- Image import -------------------------------------------------------
    # POST /api/upload?name=<original file name> with the raw image bytes as
    # the body. The file is written into userdata\images and the short URL is
    # returned, so projects reference a file instead of carrying a huge data
    # URL around.
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/upload") {
      if ($req.ContentLength64 -gt 26214400) {
        $res.StatusCode = 413
        throw "upload too large"
      }
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      $bytes = $ms.ToArray()
      $ms.Dispose()
      if ($bytes.Length -eq 0) { throw "empty upload" }
      $rawName = [string]$req.QueryString["name"]
      $ext = [IO.Path]::GetExtension($rawName).ToLower()
      # Only ever store images; anything else is saved as a PNG-named blob the
      # browser sniffs by content type when served back.
      if ($ext -notin @(".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif", ".svg")) { $ext = ".png" }
      $safe = "img_" + [DateTime]::UtcNow.Ticks + "_" + (Get-Random -Minimum 1000 -Maximum 9999) + $ext
      [IO.File]::WriteAllBytes((Join-Path $uploadRoot $safe), $bytes)
      $body = [Text.Encoding]::UTF8.GetBytes("{`"url`":`"/images/$safe`"}")
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    # --- Static files -------------------------------------------------------
    if ($path.StartsWith("images/")) {
      $file = Join-Path $uploadRoot ($path.Substring(7))
      $full = [IO.Path]::GetFullPath($file)
      if (-not $full.StartsWith([IO.Path]::GetFullPath($uploadRoot))) { throw "bad path" }
    } else {
      $file = Join-Path $root $path
      if (-not (Test-Path $file -PathType Leaf)) { $file = Join-Path $root $shell }
    }
    if (-not (Test-Path $file -PathType Leaf)) { throw "missing" }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ct = if ($mimes[$ext]) { $mimes[$ext] } else { "application/octet-stream" }
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentType = $ct
    $res.OutputStream.Write($bytes,0,$bytes.Length)
    $res.Close()
  } catch {
    try { $res.StatusCode = 500; $res.Close() } catch {}
  }
}
