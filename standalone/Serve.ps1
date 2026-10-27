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

# --- 5eTools remote brew catalogs -----------------------------------------
# Homebrew and prerelease content live in separate GitHub repositories. Their
# _generated indexes are small, so they are cached locally and refreshed
# periodically; individual brew files are downloaded only when previewed or
# imported.
$brewRoots = @{
  homebrew = "https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/"
  prerelease = "https://raw.githubusercontent.com/TheGiddyLimit/unearthed-arcana/master/"
}
$brewImageRoots = @{
  homebrew = "https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/"
  prerelease = "https://5e.tools/"
}
$brewCacheDir = Join-Path $PSScriptRoot "desktop\userdata\5etools-cache"
New-Item -ItemType Directory -Force -Path $brewCacheDir | Out-Null
$brewCatalogCache = @{}

function Get-BrewCatalogData([string]$kind) {
  if ($brewCatalogCache.ContainsKey($kind)) { return $brewCatalogCache[$kind] }
  $cacheFile = Join-Path $brewCacheDir "catalog-$kind.json"
  if (Test-Path $cacheFile -PathType Leaf) {
    $age = [DateTime]::UtcNow - (Get-Item $cacheFile).LastWriteTimeUtc
    if ($age.TotalHours -lt 6) {
      try {
        $cached = Get-Content $cacheFile -Raw | ConvertFrom-Json
        $brewCatalogCache[$kind] = $cached
        return $cached
      } catch { }
    }
  }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $headers = @{ "User-Agent" = "TerrificTalentTree" }
  $root = $brewRoots[$kind]
  $meta = Invoke-RestMethod -Uri ($root + "_generated/index-meta.json") -Headers $headers
  $props = Invoke-RestMethod -Uri ($root + "_generated/index-props.json") -Headers $headers
  $times = Invoke-RestMethod -Uri ($root + "_generated/index-timestamps.json") -Headers $headers
  $metaMap = @{}
  foreach ($p in $meta.PSObject.Properties) { $metaMap[$p.Name] = $p.Value }
  $timeMap = @{}
  foreach ($p in $times.PSObject.Properties) { $timeMap[$p.Name] = $p.Value }
  $entries = @()
  $seen = @{}
  foreach ($prop in $props.PSObject.Properties) {
    $propName = [string]$prop.Name
    foreach ($pathProp in $prop.Value.PSObject.Properties) {
      $path = [string]$pathProp.Name
      if ($seen.ContainsKey($path)) { continue }
      $seen[$path] = $true
      $base = Split-Path $path -Leaf
      $m = $metaMap[$base]
      if (-not $m) { continue }
      $parts = ($base -replace '\.json$', '') -split ';'
      # The filename convention is "Author; Title.json". The meta name/author
      # fields are internal source labels, not the display title.
      $name = if ($parts.Count -gt 1) { $parts[1].Trim() } elseif (@($m.n).Count -gt 0) { [string]@($m.n)[0] } else { $base }
      $author = if ($parts.Count -gt 1) { $parts[0].Trim() } elseif (@($m.a).Count -gt 0) { [string]@($m.a)[0] } else { "" }
      $t = if ($timeMap.ContainsKey($path)) { $timeMap[$path] } else { $timeMap[$base] }
      $encoded = (($path -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
      $entries += [pscustomobject]@{
        path = $path
        name = $name
        author = $author
        props = @($propName)
        partnered = ($m.p -eq 1)
        status = if ($m.s) { [string]$m.s } else { "ready" }
        edition = if ($m.e -ne $null) { [int]$m.e } else { 0 }
        added = if ($t -and $t.a) { [long]$t.a } else { 0 }
        modified = if ($t -and $t.m) { [long]$t.m } else { 0 }
        download = ($root + $encoded)
      }
    }
  }
  $catalog = [pscustomobject]@{
    kind = $kind
    root = $root
    count = $entries.Count
    updated = [DateTime]::UtcNow.ToString("o")
    entries = @($entries | Sort-Object name, author)
  }
  try {
    ($catalog | ConvertTo-Json -Depth 5 -Compress) | Set-Content -Path $cacheFile -Encoding UTF8
  } catch { }
  $brewCatalogCache[$kind] = $catalog
  return $catalog
}

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

    # --- 5eTools Reference Index -------------------------------------------
    # Read 5eTools folders (partnered data, homebrew and prerelease) so the
    # Reference Index can browse files and import selected entries. The app
    # prefers its own downloaded release copy (userdata\5etools); an existing
    # E:\5etools install is used as a fallback. Raw files stay on disk and are
    # only read on demand.
    $fiveManaged = Join-Path $PSScriptRoot "desktop\userdata\5etools"
    $fiveLegacy = "E:\5etools"
    $fiveRoots = @("data", "homebrew", "prerelease")
    $fiveBase = $fiveLegacy
    if (Test-Path (Join-Path $fiveManaged "data") -PathType Container) { $fiveBase = $fiveManaged }
    $fiveVersion = ""
    $fiveVersionFile = Join-Path $fiveManaged "VERSION"
    if (Test-Path $fiveVersionFile -PathType Leaf) {
      $fiveVersion = (Get-Content $fiveVersionFile -Raw -ErrorAction SilentlyContinue).Trim()
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/status") {
      $roots = @{}
      foreach ($r in $fiveRoots) { $roots[$r] = Test-Path (Join-Path $fiveBase $r) -PathType Container }
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        available = (@($roots.Values) -contains $true)
        base = $fiveBase
        roots = $roots
        managed = ($fiveBase -eq $fiveManaged)
        version = $fiveVersion
      } | ConvertTo-Json -Compress -Depth 4))
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/catalog") {
      $kind = [string]$req.QueryString["kind"]
      if ($kind -notin @("homebrew", "prerelease")) { throw "bad brew kind" }
      $catalog = Get-BrewCatalogData $kind
      $body = [Text.Encoding]::UTF8.GetBytes(($catalog | ConvertTo-Json -Depth 6 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/remote") {
      $kind = [string]$req.QueryString["kind"]
      if ($kind -notin @("homebrew", "prerelease")) { throw "bad brew kind" }
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing path" }
      $rel = $rel.Replace('\','/')
      if ($rel.StartsWith("/") -or $rel -match "(^|/)\.\." -or $rel -notmatch "\.json$") { throw "bad path" }
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $encoded = (($rel -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
      $r = Invoke-WebRequest -Uri ($brewRoots[$kind] + $encoded) -Headers @{ "User-Agent" = "TerrificTalentTree" } -UseBasicParsing
      $bytes = [Text.Encoding]::UTF8.GetBytes([string]$r.Content)
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/brew-image") {
      $kind = [string]$req.QueryString["kind"]
      if ($kind -notin @("homebrew", "prerelease")) { throw "bad brew kind" }
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing path" }
      $rel = $rel.Replace('\','/')
      if ($rel.StartsWith("/") -or $rel -match "(^|/)\.\.") { throw "bad path" }
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $encoded = (($rel -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
      $ext = [IO.Path]::GetExtension($rel).ToLower()
      $ct = if ($mimes[$ext]) { $mimes[$ext] } else { "application/octet-stream" }
      # Prefer a local image pack when one exists, then fall back to the
      # repository/website image root.
      $localImg = [IO.Path]::GetFullPath((Join-Path $fiveLegacy $rel))
      $legacyFull = [IO.Path]::GetFullPath($fiveLegacy)
      if ($localImg.StartsWith($legacyFull) -and (Test-Path $localImg -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($localImg)
      } else {
        $r = Invoke-WebRequest -Uri ($brewImageRoots[$kind] + $encoded) -Headers @{ "User-Agent" = "TerrificTalentTree" } -UseBasicParsing
        $ms = New-Object IO.MemoryStream
        $r.RawContentStream.CopyTo($ms)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        if ($r.Headers["Content-Type"]) { $ct = [string]$r.Headers["Content-Type"] }
      }
      $res.ContentType = $ct
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/latest") {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $headers = @{ "User-Agent" = "TerrificTalentTree" }
      $release = Invoke-RestMethod -Uri "https://api.github.com/repos/5etools-mirror-3/5etools-src/releases/latest" -Headers $headers
      $asset = @($release.assets | Where-Object { $_.name -like "5etools-*.zip" }) | Select-Object -First 1
      if (-not $asset) { throw "No release asset found" }
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        tag = [string]$release.tag_name
        name = [string]$asset.name
        size = [long]$asset.size
        published = [string]$release.published_at
        url = [string]$asset.browser_download_url
      } | ConvertTo-Json -Compress))
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/5etools/update") {
      # Download the latest 5etools-src release and replace data, images,
      # homebrew and prerelease with the release contents. The update is
      # staged first so a failed download never breaks the current copy, and
      # user-added homebrew/prerelease files are carried over.
      $updateError = ""
      $tag = ""
      try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $headers = @{ "User-Agent" = "TerrificTalentTree" }
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/5etools-mirror-3/5etools-src/releases/latest" -Headers $headers
        $asset = @($release.assets | Where-Object { $_.name -like "5etools-*.zip" }) | Select-Object -First 1
        if (-not $asset) { throw "No release asset found" }
        $tag = [string]$release.tag_name
        New-Item -ItemType Directory -Force -Path $fiveManaged | Out-Null
        $download = Join-Path $fiveManaged "download.zip"
        $stage = Join-Path $fiveManaged "staging"
        if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
        New-Item -ItemType Directory -Force -Path $stage | Out-Null

        # Keep the user's own homebrew and prerelease records.
        foreach ($r in @("homebrew", "prerelease")) {
          $src = Join-Path $fiveManaged $r
          if (Test-Path $src -PathType Container) {
            Copy-Item $src (Join-Path $stage $r) -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item (Join-Path $stage "$r\index.json") -Force -ErrorAction SilentlyContinue
          }
        }

        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $download -UseBasicParsing
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($download)
        try {
          foreach ($e in $zip.Entries) {
            $name = $e.FullName.Replace('\','/')
            if ($name -notmatch '^(data|homebrew|prerelease|img)/') { continue }
            $dest = Join-Path $stage $name.Replace('/','\')
            if ($name.EndsWith('/')) {
              New-Item -ItemType Directory -Force -Path $dest | Out-Null
            } else {
              New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
              [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
            }
          }
        } finally {
          $zip.Dispose()
        }

        foreach ($r in @("data", "img", "homebrew", "prerelease")) {
          $srcdir = Join-Path $stage $r
          if (Test-Path $srcdir -PathType Container) {
            $destdir = Join-Path $fiveManaged $r
            if (Test-Path $destdir) { Remove-Item $destdir -Recurse -Force -ErrorAction SilentlyContinue }
            Move-Item $srcdir $destdir
          }
        }
        Set-Content -Path (Join-Path $fiveManaged "VERSION") -Value $tag -Encoding UTF8
        Remove-Item $download -Force -ErrorAction SilentlyContinue
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
        $fiveBase = $fiveManaged
        $fiveVersion = $tag
      } catch {
        $updateError = $_.Exception.Message
        Remove-Item (Join-Path $fiveManaged "download.zip") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $fiveManaged "staging") -Recurse -Force -ErrorAction SilentlyContinue
      }
      $roots = @{}
      foreach ($r in $fiveRoots) { $roots[$r] = Test-Path (Join-Path $fiveBase $r) -PathType Container }
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        ok = (-not $updateError)
        error = $updateError
        version = $fiveVersion
        base = $fiveBase
        managed = ($fiveBase -eq $fiveManaged)
        roots = $roots
      } | ConvertTo-Json -Compress -Depth 4))
      $res.ContentType = "application/json"
      if ($updateError) { $res.StatusCode = 500 }
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/index") {
      $rootName = [string]$req.QueryString["root"]
      if (-not $rootName) { $rootName = "data" }
      if ($fiveRoots -notcontains $rootName) { throw "bad root" }
      $root5e = Join-Path $fiveBase $rootName
      if (-not (Test-Path $root5e -PathType Container)) {
        $body = [Text.Encoding]::UTF8.GetBytes('{"available":false,"files":[]}')
      } else {
        $files = Get-ChildItem -Path $root5e -Recurse -File -Filter *.json -ErrorAction SilentlyContinue |
          ForEach-Object {
            $rel = $_.FullName.Substring($root5e.Length).TrimStart('\').Replace('\','/')
            @{ root = $rootName; path = $rel; name = $_.Name; dir = (Split-Path $rel -Parent); size = $_.Length }
          }
        $body = [Text.Encoding]::UTF8.GetBytes((@{ available = $true; root = $rootName; base = $fiveBase; files = @($files) } | ConvertTo-Json -Compress -Depth 5))
      }
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/file") {
      $rootName = [string]$req.QueryString["root"]
      if (-not $rootName) { $rootName = "data" }
      if ($fiveRoots -notcontains $rootName) { throw "bad root" }
      $root5e = Join-Path $fiveBase $rootName
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing path" }
      $full = [IO.Path]::GetFullPath((Join-Path $root5e $rel))
      $rootFull = [IO.Path]::GetFullPath($root5e)
      if (-not $full.StartsWith($rootFull) -or -not (Test-Path $full -PathType Leaf)) { throw "bad path" }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/5etools/image") {
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing path" }
      # Prefer the active data folder (which may be a downloaded release with
      # no image pack), then fall back to the local 5etools install's images.
      $full = $null
      foreach ($baseDir in @($fiveBase, $fiveLegacy)) {
        if (-not $baseDir) { continue }
        $candidate = [IO.Path]::GetFullPath((Join-Path $baseDir $rel))
        $baseFull = [IO.Path]::GetFullPath($baseDir)
        if ($candidate.StartsWith($baseFull) -and (Test-Path $candidate -PathType Leaf)) {
          $full = $candidate
          break
        }
      }
      if (-not $full) { throw "bad path" }
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ct = if ($mimes[$ext]) { $mimes[$ext] } else { "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.OutputStream.Write($bytes,0,$bytes.Length)
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
