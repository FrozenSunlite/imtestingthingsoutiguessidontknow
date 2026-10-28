$root = Join-Path $PSScriptRoot "desktop\app-dist\client"
$shell = "_shell.html"
$port = 4173
# Imported artwork lives outside the build folder so rebuilding the app never
# wipes it. It is served back from /images/.
$uploadRoot = Join-Path $PSScriptRoot "desktop\userdata\images"
New-Item -ItemType Directory -Force -Path $uploadRoot | Out-Null
$projectRoot = Join-Path $PSScriptRoot "desktop\userdata\projects"
New-Item -ItemType Directory -Force -Path $projectRoot | Out-Null
$pathsFile = Join-Path $PSScriptRoot "desktop\userdata\paths.json"
$pathConfig = $null
if (Test-Path $pathsFile -PathType Leaf) {
  try { $pathConfig = Get-Content $pathsFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
}
$mimes = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".bmp"="image/bmp"; ".avif"="image/avif"; ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".map"="application/json"
}
$url = "http://localhost:$port"

# --- Sticker library -------------------------------------------------------
# Point this at any folder of images. The index is built once and cached in
# userdata so the browser can search large libraries quickly. The folder can be
# moved or changed from the Stickers page; set TALENT_TREE_ASSET_ROOT to override
# the default at launch.
$assetRoot = $env:TALENT_TREE_ASSET_ROOT
if (-not $assetRoot -and $pathConfig -and $pathConfig.assetRoot) { $assetRoot = [string]$pathConfig.assetRoot }
if ($assetRoot -and -not (Test-Path $assetRoot -PathType Container)) { $assetRoot = $null }
if (-not $assetRoot) {
  $assetCandidates = @(
    "E:\FANTASY",
    (Join-Path $PSScriptRoot "assets"),
    (Join-Path $PSScriptRoot "FANTASY"),
    (Join-Path $PSScriptRoot "..\..\FANTASY"),
    (Join-Path $env:USERPROFILE "FANTASY"),
    "D:\FANTASY"
  )
  foreach ($candidate in $assetCandidates) {
    if ($candidate -and (Test-Path $candidate -PathType Container)) { $assetRoot = $candidate; break }
  }
}
if (-not $assetRoot) { $assetRoot = "E:\FANTASY" }
$assetIndexPath = Join-Path $PSScriptRoot "desktop\userdata\asset-index.json"
$script:assetIndexCache = $null
$imageExts = @(".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif")

function Get-AssetCategory([string]$rel, [string]$name) {
  $p = ("$rel $name").ToLower()
  if ($p -match 'token|portrait|monster|creature') { return "Token" }
  if ($p -match 'texture|terrain|climate|grass|moss|wood|stone|floor|water|sand|snow|dirt|parchment|starfield') { return "Texture" }
  if ($p -match '\\maps\\|/maps/|map|region|world|city|town|village|dungeon|floorplan') { return "Map" }
  if ($p -match 'furniture|furnishing|table|chair|bed|barrel|crate|shelf|chest|rug|stool|bunk|cabinet') { return "Furnishing" }
  if ($p -match 'building|house|hovel|tower|castle|temple|shop|tavern|inn|mill|wall|gate|bridge|fort') { return "Building" }
  if ($p -match 'symbol|icon|compass|scalebar|cartouche|marker|crest|shield') { return "Symbol" }
  if ($p -match 'door|window|stair|roof|chimney|floor|wall') { return "Structural" }
  return "Object"
}

function Get-AssetIndex {
  if ($script:assetIndexCache) { return $script:assetIndexCache }
  if ((Test-Path $assetIndexPath -PathType Leaf)) {
    try {
      $raw = Get-Content $assetIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($raw -and $raw.root -eq $assetRoot -and $raw.files) {
        $script:assetIndexCache = $raw
        return $script:assetIndexCache
      }
    } catch { }
  }
  $files = @()
  if (Test-Path $assetRoot -PathType Container) {
    $rootFull = [IO.Path]::GetFullPath($assetRoot)
    $files = @(Get-ChildItem $assetRoot -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $imageExts -contains $_.Extension.ToLower() } |
      ForEach-Object {
        $rel = $_.FullName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
        @{
          path = $rel
          name = $_.Name
          dir = ($rel -replace '/[^/]+$', '')
          ext = $_.Extension.ToLower()
          size = $_.Length
          category = (Get-AssetCategory $rel $_.Name)
        }
      })
  }
  $index = @{ root = $assetRoot; built = (Get-Date).ToUniversalTime().ToString("o"); files = $files }
  $script:assetIndexCache = $index
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path $assetIndexPath) | Out-Null
    ($index | ConvertTo-Json -Depth 4 -Compress) | Set-Content $assetIndexPath -Encoding UTF8
  } catch { }
  return $index
}


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

function Find-DesktopBrowser {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($name in @("msedge.exe", "msedge", "chrome.exe", "chrome")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { $candidates.Add([string]$cmd.Source) }
  }
  $registryKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
  )
  foreach ($key in $registryKeys) {
    try {
      $regKey = Get-Item -Path $key -ErrorAction Stop
      $value = $regKey.GetValue("")
      if (-not $value) { $value = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).Path }
      if ($value -and (Test-Path $value -PathType Leaf)) { $candidates.Add([string]$value) }
    } catch { }
  }
  $programFiles = [Environment]::GetFolderPath("ProgramFiles")
  $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  $localAppData = [Environment]::GetFolderPath("LocalApplicationData")
  $common = @(
    "$programFilesX86\Microsoft\Edge\Application\msedge.exe",
    "$programFiles\Microsoft\Edge\Application\msedge.exe",
    "$localAppData\Microsoft\Edge\Application\msedge.exe",
    "$programFilesX86\Google\Chrome\Application\chrome.exe",
    "$programFiles\Google\Chrome\Application\chrome.exe",
    "$localAppData\Google\Chrome\Application\chrome.exe"
  )
  foreach ($path in $common) {
    if ($path -and (Test-Path $path -PathType Leaf)) { $candidates.Add([string]$path) }
  }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate -PathType Leaf)) { return $candidate }
  }
  return $null
}

$browserPath = Find-DesktopBrowser
$edgePath = $browserPath

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
if ($edgePath) {
  try {
    Start-Process $edgePath -ArgumentList "--app=$url", "--start-fullscreen" | Out-Null
    $launched = $true
  } catch { }
}
if (-not $launched) {
  # No Edge/Chrome found, or app mode failed: open the default browser instead.
  try { Start-Process $url | Out-Null } catch { }
}
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

    # --- Image asset manager ------------------------------------------------
    # List/delete project images so the Reference Library's Media tab can show
    # what is referenced and remove orphaned artwork.
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/images") {
      $list = @(Get-ChildItem -Path $uploadRoot -File -ErrorAction SilentlyContinue | ForEach-Object {
        @{
          name = $_.Name
          url = "/images/$($_.Name)"
          bytes = $_.Length
          modified = $_.LastWriteTimeUtc.ToString("o")
        }
      })
      $body = [Text.Encoding]::UTF8.GetBytes((@{ images = $list } | ConvertTo-Json -Depth 4 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/images/delete") {
      $name = [string]$req.QueryString["name"]
      if (-not $name -or $name -match "[\\/]" -or $name -match "\.\.") { throw "bad image name" }
      $target = Join-Path $uploadRoot $name
      $full = [IO.Path]::GetFullPath($target)
      $rootFull = [IO.Path]::GetFullPath($uploadRoot)
      if (-not $full.StartsWith($rootFull) -or -not (Test-Path $full -PathType Leaf)) { throw "missing image" }
      [IO.File]::Delete($full)
      $body = [Text.Encoding]::UTF8.GetBytes("{`"ok`":true}")
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    # --- Sticker library API ------------------------------------------------
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/assets/status") {
      $index = Get-AssetIndex
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        root = $index.root
        built = $index.built
        files = @($index.files).Count
        available = (Test-Path $index.root -PathType Container)
      } | ConvertTo-Json -Compress -Depth 4))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/assets/root") {
      $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $bodyText = $reader.ReadToEnd()
      $reader.Dispose()
      $payload = $null
      try { $payload = $bodyText | ConvertFrom-Json } catch { }
      $newRoot = if ($payload -and $payload.root) { [string]$payload.root } else { [string]$req.QueryString["path"] }
      $newRoot = $newRoot.Trim().Trim('"')
      if (-not $newRoot -or -not (Test-Path $newRoot -PathType Container)) {
        $body = [Text.Encoding]::UTF8.GetBytes((@{
          error = "That folder does not exist or is not a folder."
          root = $newRoot
          available = $false
        } | ConvertTo-Json -Compress -Depth 4))
        $res.ContentType = "application/json; charset=utf-8"
        $res.OutputStream.Write($body,0,$body.Length)
        $res.Close()
        continue
      }
      $script:assetRoot = [IO.Path]::GetFullPath($newRoot)
      $script:assetIndexCache = $null
      Remove-Item $assetIndexPath -ErrorAction SilentlyContinue
      if (-not $pathConfig) { $pathConfig = [pscustomobject]@{} }
      $pathConfig | Add-Member -NotePropertyName assetRoot -NotePropertyValue $script:assetRoot -Force
      $utf8 = New-Object System.Text.UTF8Encoding($false)
      try {
        [IO.File]::WriteAllText($pathsFile, ($pathConfig | ConvertTo-Json -Depth 6), $utf8)
      } catch { }
      $index = Get-AssetIndex
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        root = $index.root
        built = $index.built
        files = @($index.files).Count
        available = (Test-Path $index.root -PathType Container)
      } | ConvertTo-Json -Compress -Depth 4))
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers["Cache-Control"] = "no-store"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    if ($req.HttpMethod -eq "POST" -and $path -eq "api/assets/pick-folder") {
      $stamp = [Guid]::NewGuid().ToString("N")
      $tempOut = [IO.Path]::Combine([IO.Path]::GetTempPath(), "talentpicker_$stamp.txt")
      $tempScript = [IO.Path]::Combine([IO.Path]::GetTempPath(), "talentpicker_$stamp.ps1")
      $safeOut = $tempOut.Replace("'", "''")
      $safeStart = ([string]$script:assetRoot).Replace("'", "''")
      $picker = @"
Add-Type -AssemblyName System.Windows.Forms
`$d = New-Object System.Windows.Forms.FolderBrowserDialog
`$d.Description = 'Choose the folder that contains your sticker images'
`$d.SelectedPath = '$safeStart'
if (`$d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Set-Content -Path '$safeOut' -Value `$d.SelectedPath -Encoding UTF8
}
"@
      Set-Content -Path $tempScript -Value $picker -Encoding UTF8
      $selected = ""
      try {
        $pickerProc = Start-Process powershell -ArgumentList '-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',"`"$tempScript`"" -PassThru
        $pickerProc | Wait-Process -Timeout 180 -ErrorAction SilentlyContinue
        if (-not $pickerProc.HasExited) {
          $pickerProc | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $tempOut -PathType Leaf) {
          $selected = (Get-Content $tempOut -Raw -ErrorAction SilentlyContinue).Trim()
        }
      } finally {
        Remove-Item $tempOut -ErrorAction SilentlyContinue
        Remove-Item $tempScript -ErrorAction SilentlyContinue
      }
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        root = $selected
        canceled = [string]::IsNullOrWhiteSpace($selected)
      } | ConvertTo-Json -Compress -Depth 3))
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers["Cache-Control"] = "no-store"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    if ($req.HttpMethod -eq "GET" -and $path -eq "api/assets/categories") {
      $index = Get-AssetIndex
      $counts = @{}
      foreach ($f in @($index.files)) {
        $c = [string]$f.category
        if (-not $counts.ContainsKey($c)) { $counts[$c] = 0 }
        $counts[$c] = $counts[$c] + 1
      }
      $body = [Text.Encoding]::UTF8.GetBytes((@{ categories = $counts } | ConvertTo-Json -Compress -Depth 3))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/assets/list") {
      $index = Get-AssetIndex
      $q = ([string]$req.QueryString["q"]).Trim().ToLower()
      $cat = ([string]$req.QueryString["category"]).Trim()
      $limit = 80
      $offset = 0
      [void][int]::TryParse([string]$req.QueryString["limit"], [ref]$limit)
      [void][int]::TryParse([string]$req.QueryString["offset"], [ref]$offset)
      $limit = [Math]::Max(1, [Math]::Min(200, $limit))
      $offset = [Math]::Max(0, $offset)
      $files = @($index.files)
      if ($cat) { $files = @($files | Where-Object { [string]$_.category -eq $cat }) }
      if ($q) { $files = @($files | Where-Object { (([string]$_.name) + " " + ([string]$_.dir)).ToLower().Contains($q) }) }
      $total = $files.Count
      $page = @($files | Sort-Object category, name | Select-Object -Skip $offset -First $limit | ForEach-Object {
        @{
          path = $_.path
          name = $_.name
          dir = $_.dir
          ext = $_.ext
          size = $_.size
          category = $_.category
          url = "/api/assets/file?path=" + [Uri]::EscapeDataString([string]$_.path)
        }
      })
      $body = [Text.Encoding]::UTF8.GetBytes((@{ total = $total; offset = $offset; limit = $limit; items = $page } | ConvertTo-Json -Depth 5 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/assets/file") {
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing asset path" }
      $rel = $rel.Replace('\','/')
      if ($rel -match '(^|/)\.\.' -or $rel.StartsWith("/")) { throw "bad asset path" }
      $full = [IO.Path]::GetFullPath((Join-Path $assetRoot $rel))
      $rootFull = [IO.Path]::GetFullPath($assetRoot)
      if (-not $full.StartsWith($rootFull) -or -not (Test-Path $full -PathType Leaf)) { throw "missing asset" }
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ct = if ($mimes[$ext]) { $mimes[$ext] } else { "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/assets/import") {
      $rel = [string]$req.QueryString["path"]
      if (-not $rel) { throw "missing asset path" }
      $rel = $rel.Replace('\','/')
      if ($rel -match '(^|/)\.\.' -or $rel.StartsWith("/")) { throw "bad asset path" }
      $full = [IO.Path]::GetFullPath((Join-Path $assetRoot $rel))
      $rootFull = [IO.Path]::GetFullPath($assetRoot)
      if (-not $full.StartsWith($rootFull) -or -not (Test-Path $full -PathType Leaf)) { throw "missing asset" }
      $bytes = [IO.File]::ReadAllBytes($full)
      if ($bytes.Length -gt 26214400) { throw "asset too large" }
      $ext = [IO.Path]::GetExtension($full).ToLower()
      if ($imageExts -notcontains $ext) { $ext = ".png" }
      $safe = "asset_" + [DateTime]::UtcNow.Ticks + "_" + (Get-Random -Minimum 1000 -Maximum 9999) + $ext
      [IO.File]::WriteAllBytes((Join-Path $uploadRoot $safe), $bytes)
      $body = [Text.Encoding]::UTF8.GetBytes("{`"url`":`"/images/$safe`",`"name`":`"$([IO.Path]::GetFileName($full))`"}")
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    # --- Project files on disk ----------------------------------------------
    # The working project is still autosaved in the browser, but every save is
    # also written here so the project exists as a normal file on the PC.
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/project/save") {
      if ($req.ContentLength64 -gt 209715200) { throw "project too large" }
      $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $bodyText = $reader.ReadToEnd()
      $reader.Dispose()
      if (-not $bodyText) { throw "empty project" }
      $payload = $null
      try { $payload = $bodyText | ConvertFrom-Json } catch { throw "bad project json" }
      $rawName = [string]$req.QueryString["name"]
      if (-not $rawName -and $payload.name) { $rawName = [string]$payload.name }
      $safe = ($rawName -replace '[^a-zA-Z0-9._ -]', '').Trim()
      if (-not $safe) { $safe = "Terrific Talent Tree Project" }
      if ($safe.Length -gt 80) { $safe = $safe.Substring(0, 80) }
      $file = Join-Path $projectRoot ($safe + ".json")
      $latest = Join-Path $projectRoot "latest.json"
      $json = $payload | ConvertTo-Json -Depth 100 -Compress
      if (-not $json) { $json = $bodyText }
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      $mode = [string]$req.QueryString["mode"]
      $backupDir = Join-Path $projectRoot "backups"
      New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
      $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
      $oldLatest = if (Test-Path $latest -PathType Leaf) { Get-Item $latest } else { $null }
      # Keep the previous file before a manual save, and also before an
      # autosave that is dramatically smaller than the file it would replace.
      # This is the safety net against an empty tab overwriting a real project.
      if ($oldLatest) {
        if ($mode -eq "manual") {
          $backupFile = Join-Path $backupDir ("$safe-$stamp.json")
          Copy-Item $latest $backupFile -Force -ErrorAction SilentlyContinue
        } elseif ($oldLatest.Length -gt 50000 -and $json.Length -lt ($oldLatest.Length * 0.5)) {
          $backupFile = Join-Path $backupDir ("pre-autosave-$stamp.json")
          Copy-Item $latest $backupFile -Force -ErrorAction SilentlyContinue
        }
      }
      [IO.File]::WriteAllText($file, $json, $utf8NoBom)
      [IO.File]::WriteAllText($latest, $json, $utf8NoBom)
      if ($mode -eq "manual" -or $oldLatest) {
        Get-ChildItem $backupDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
          Sort-Object LastWriteTime -Descending |
          Select-Object -Skip 30 |
          Remove-Item -Force -ErrorAction SilentlyContinue
      }
      $body = [Text.Encoding]::UTF8.GetBytes((@{
        ok = $true
        name = $safe
        path = $file
        savedAt = (Get-Date).ToUniversalTime().ToString("o")
      } | ConvertTo-Json -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/project/list") {
      $files = @(Get-ChildItem $projectRoot -Filter "*.json" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
          @{
            name = $_.BaseName
            file = $_.Name
            bytes = $_.Length
            modified = $_.LastWriteTimeUtc.ToString("o")
          }
        })
      $body = [Text.Encoding]::UTF8.GetBytes((@{ projects = $files } | ConvertTo-Json -Depth 4 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/project/backups") {
      $backupDir = Join-Path $projectRoot "backups"
      $files = @(Get-ChildItem $backupDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
          @{
            name = $_.BaseName
            file = $_.Name
            bytes = $_.Length
            modified = $_.LastWriteTimeUtc.ToString("o")
          }
        })
      $body = [Text.Encoding]::UTF8.GetBytes((@{ projects = $files } | ConvertTo-Json -Depth 4 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers["Cache-Control"] = "no-store"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/project/load") {
      $name = [string]$req.QueryString["name"]
      if (-not $name) { throw "missing project name" }
      if ($name -match "[\\/]" -or $name -match "\.\.") { throw "bad project name" }
      if (-not $name.EndsWith(".json")) { $name = "$name.json" }
      $backup = [string]$req.QueryString["backup"] -eq "1"
      $baseDir = if ($backup) { Join-Path $projectRoot "backups" } else { $projectRoot }
      $file = Join-Path $baseDir $name
      $full = [IO.Path]::GetFullPath($file)
      $rootFull = [IO.Path]::GetFullPath($baseDir)
      if (-not $full.StartsWith($rootFull) -or -not (Test-Path $full -PathType Leaf)) { throw "missing project" }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes,0,$bytes.Length)
      $res.Close()
      continue
    }
    if ($req.HttpMethod -eq "POST" -and $path -eq "api/project/delete") {
      $name = [string]$req.QueryString["name"]
      if (-not $name) { throw "missing project name" }
      if ($name -match "[\\/]" -or $name -match "\.\.") { throw "bad project name" }
      if (-not $name.EndsWith(".json")) { $name = "$name.json" }
      $backup = [string]$req.QueryString["backup"] -eq "1"
      $baseDir = if ($backup) { Join-Path $projectRoot "backups" } else { $projectRoot }
      $file = Join-Path $baseDir $name
      $full = [IO.Path]::GetFullPath($file)
      $rootFull = [IO.Path]::GetFullPath($baseDir)
      if ($full.StartsWith($rootFull) -and (Test-Path $full -PathType Leaf)) { [IO.File]::Delete($full) }
      $body = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $res.ContentType = "application/json"
      $res.OutputStream.Write($body,0,$body.Length)
      $res.Close()
      continue
    }

    # --- Imported sticker files ------------------------------------------------
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/images/list") {
      $images = @(Get-ChildItem $uploadRoot -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
          @{
            name = $_.Name
            url = "/images/$($_.Name)"
            bytes = $_.Length
            modified = $_.LastWriteTimeUtc.ToString("o")
          }
        })
      $body = [Text.Encoding]::UTF8.GetBytes((@{ images = $images } | ConvertTo-Json -Depth 4 -Compress))
      $res.ContentType = "application/json; charset=utf-8"
      $res.Headers["Cache-Control"] = "no-store"
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
    $fiveLegacy = $env:TALENT_TREE_5ETOOLS
    if (-not $fiveLegacy -and $pathConfig -and $pathConfig.fiveTools) { $fiveLegacy = [string]$pathConfig.fiveTools }
    if ($fiveLegacy -and -not (Test-Path $fiveLegacy -PathType Container)) { $fiveLegacy = $null }
    if (-not $fiveLegacy) {
      foreach ($candidate in @(
        "E:\5etools",
        (Join-Path $PSScriptRoot "5etools"),
        (Join-Path $PSScriptRoot "..\..\5etools"),
        (Join-Path $env:USERPROFILE "5etools")
      )) {
        if ($candidate -and (Test-Path $candidate -PathType Container)) { $fiveLegacy = $candidate; break }
      }
    }
    if (-not $fiveLegacy) { $fiveLegacy = "E:\5etools" }
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

    # --- Remote image proxy -------------------------------------------------
    # Some imported artwork lives on hosts without CORS headers. The app asks
    # this endpoint for the bytes, then saves them into userdata\images through
    # /api/upload so every picture travels with the project file.
    if ($req.HttpMethod -eq "GET" -and $path -eq "api/image-proxy") {
      $sourceUrl = [string]$req.QueryString["url"]
      if (-not $sourceUrl -or $sourceUrl -notmatch '^https?://') { throw "bad image url" }
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $r = Invoke-WebRequest -Uri $sourceUrl -Headers @{ "User-Agent" = "TerrificTalentTree" } -UseBasicParsing
      $ms = New-Object IO.MemoryStream
      $r.RawContentStream.CopyTo($ms)
      $bytes = $ms.ToArray()
      $ms.Dispose()
      $ct = [string]$r.Headers["Content-Type"]
      if (-not $ct) { $ct = "application/octet-stream" }
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
