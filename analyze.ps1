$c = Get-Content vidssave_lib.js -Raw
Write-Host "Length: $($c.Length)"
if ($c.Length -gt 30000) {
    Write-Host "--- API match (29911) ---"
    Write-Host $c.Substring(29850, 300)
    Write-Host "--- Fetch match (27597) ---"
    Write-Host $c.Substring(27500, 300)
}
