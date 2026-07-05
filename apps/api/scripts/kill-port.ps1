# Frees the API port (default 3001, or $env:PORT) before `nest start`,
# so a leftover watcher from a previous run doesn't cause EADDRINUSE.
$port = if ($env:PORT) { [int]$env:PORT } else { 3001 }
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host "kill-port: stopping PID $($_.OwningProcess) on port $port"
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
exit 0
