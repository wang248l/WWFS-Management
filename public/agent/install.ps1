# WWFS办公室 设备小助手 —— Windows 一键安装（2026-11-21）
# 用法（PowerShell 里粘贴一行）：  irm https://management.wallacewang.ca/agent/install.ps1 | iex
# 做的事：装 Python（没有的话）、adb（没有的话）、Claude Code（没有的话）→ 下载小助手 → 配对（显示 6 位短码，去「设备」页批准）
#        → 加一个开机自动运行的计划任务 → 马上启动。重复运行没关系。
$ErrorActionPreference = "Stop"
$Base = "https://management.wallacewang.ca"
$Dir = Join-Path $env:USERPROFILE "wwfs-agent"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
function Say($m) { Write-Host "==> $m" -ForegroundColor Cyan }

# 1) Python
function Find-Py {
  foreach ($c in @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe")) { if (Test-Path $c) { return $c } }
  $p = Get-Command python.exe -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike "*WindowsApps*" } | Select-Object -First 1
  if ($p) { return $p.Source }
  $py = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($py) { $x = & py -3 -c "import sys;print(sys.executable)" 2>$null; if ($x -and (Test-Path $x)) { return $x } }
  return $null
}
$Py = Find-Py
if (-not $Py) {
  Say "安装 Python 3.12 …"
  winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements | Out-Null
  $Py = Find-Py
}
if (-not $Py) { throw "Python 没装上，请把这个窗口截图发给 Claude" }
$Pyw = Join-Path (Split-Path $Py) "pythonw.exe"
Say "Python: $Py"

# 2) adb（手机要用）
$adb = Get-Command adb.exe -ErrorAction SilentlyContinue
if (-not $adb -and -not (Test-Path "$env:USERPROFILE\platform-tools\adb.exe")) {
  Say "安装 adb（Google platform-tools）…"
  $zip = Join-Path $env:TEMP "platform-tools.zip"
  Invoke-WebRequest "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $env:USERPROFILE -Force
}

# 3) Claude Code
$claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
if (-not (Test-Path $claude) -and -not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Say "安装 Claude Code …"
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
}

# 4) 小助手本体
Say "下载设备小助手 …"
Invoke-WebRequest "$Base/agent/device_agent.py" -OutFile (Join-Path $Dir "device_agent.py")
$Agent = Join-Path $Dir "device_agent.py"

# 5) 配对
Say "配对（会显示 6 位短码）…"
& $Py $Agent pair
if ($LASTEXITCODE -ne 0) { throw "配对没完成，重新运行这一行就行" }

# 6) 开机自动运行 + 掉了自动重启
Say "设成开机自动运行 …"
$act = New-ScheduledTaskAction -Execute $Pyw -Argument "`"$Agent`" run" -WorkingDirectory $Dir
$trg = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName "WWFS 设备小助手" -Action $act -Trigger $trg -Settings $set -Force | Out-Null
Get-Process pythonw -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*device_agent.py*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "WWFS 设备小助手"

# 7) Claude 登录检查
$exe = if (Test-Path $claude) { $claude } else { (Get-Command claude).Source }
$st = & $exe auth status --json 2>$null | Out-String
if ($st -notmatch '"loggedIn":\s*true') {
  Say "最后一步：Claude 还没登录。下面会打开 Claude，按提示用浏览器登录，登录完关掉窗口就好。"
  Start-Process $exe
}
Say "✅ 装好了。打开 $Base/devices 应该能看到这台电脑在线。"
