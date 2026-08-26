$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cats = Get-Content (Join-Path $root 'data\categories.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$total = 0
$allEn = New-Object System.Collections.Generic.List[string]
$problems = 0

foreach ($c in $cats) {
    $path = Join-Path $root "data\words\$($c.id).json"
    if (-not (Test-Path $path)) {
        Write-Host ("{0,-18} BRAK PLIKU" -f $c.id) -ForegroundColor Red
        $problems++
        continue
    }
    try {
        $d = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Write-Host ("{0,-18} BLEDNY JSON: {1}" -f $c.id, $_.Exception.Message) -ForegroundColor Red
        $problems++
        continue
    }

    $count = @($d).Count
    $dups = @($d.en | Group-Object | Where-Object Count -gt 1)
    $empty = @($d | Where-Object { -not $_.en -or -not $_.pl -or -not $_.ex -or -not $_.exPl }).Count

    $total += $count
    $allEn.AddRange([string[]]@($d.en))

    $status = 'OK'
    $colour = 'Green'
    if ($count -ne 150 -or $dups.Count -gt 0 -or $empty -gt 0) {
        $status = "count=$count dups=$($dups.Count) empty=$empty"
        $colour = 'Yellow'
        $problems++
    }
    Write-Host ("{0,-18} {1,4} wpisow  {2}" -f $c.id, $count, $status) -ForegroundColor $colour
    if ($dups.Count -gt 0) { $dups | ForEach-Object { Write-Host "    dup: $($_.Name)" -ForegroundColor Yellow } }
}

Write-Host ''
Write-Host "RAZEM: $total wpisow" -ForegroundColor Cyan

$globalDups = @($allEn | Group-Object | Where-Object Count -gt 1)
if ($globalDups.Count -gt 0) {
    Write-Host "Duplikaty miedzy kategoriami: $($globalDups.Count)" -ForegroundColor Yellow
    $globalDups | Select-Object -First 40 | ForEach-Object {
        Write-Host "    $($_.Name)  x$($_.Count)" -ForegroundColor Yellow
    }
} else {
    Write-Host 'Brak duplikatow globalnych.' -ForegroundColor Green
}

if ($problems -eq 0 -and $globalDups.Count -eq 0) {
    Write-Host 'WALIDACJA ZAKONCZONA POMYSLNIE' -ForegroundColor Green
}
