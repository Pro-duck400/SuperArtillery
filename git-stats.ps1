# Git Repository Statistics
# Analyzes commits and lines of code per contributor
# PowerShell v1.0 Compatible

Write-Host ""
Write-Host "========================================"
Write-Host "  Git Repository Statistics"
Write-Host "========================================"
Write-Host ""

# 1. Commits per contributor
Write-Host "COMMITS PER CONTRIBUTOR"
Write-Host "-----------------------------------------"
Write-Host ""

$commits = git shortlog -sn --all --no-merges | ForEach-Object {
    if ($_ -match '^\s*(\d+)\s+(.+)$') {
        $obj = New-Object PSObject
        Add-Member -InputObject $obj -MemberType NoteProperty -Name Commits -Value ([int]$matches[1])
        Add-Member -InputObject $obj -MemberType NoteProperty -Name Author -Value $matches[2]
        $obj
    }
}

$totalCommits = 0
$commits | ForEach-Object { $totalCommits += $_.Commits }

$commits | ForEach-Object {
    $percentage = [math]::Round(($_.Commits / $totalCommits) * 100, 1)
    $barLength = [math]::Min([int]($percentage / 2), 50)
    $bar = ""
    for ($i = 0; $i -lt $barLength; $i++) { $bar += "#" }
    Write-Host ("  {0,-30} {1,4} commits ({2,5}%)  {3}" -f $_.Author, $_.Commits, $percentage, $bar)
}

Write-Host ""
Write-Host ("  Total: {0} commits" -f $totalCommits)
Write-Host ""

# 2. Lines of code per contributor
Write-Host ""
Write-Host "LINES OF CODE PER CONTRIBUTOR"
Write-Host "-----------------------------------------"
Write-Host ""

$authors = git log --format='%aN' --all | Sort-Object -Unique

$stats = $authors | ForEach-Object {
    $author = $_
    
    # Get numstat for this author
    $added = 0
    $removed = 0
    
    git log --author="$author" --pretty=tformat: --numstat --all | Where-Object { $_ -match '^\d+\s+\d+' } | ForEach-Object {
        $parts = $_ -split '\s+'
        if ($parts[0] -match '^\d+$') { $added += [int]$parts[0] }
        if ($parts[1] -match '^\d+$') { $removed += [int]$parts[1] }
    }
    
    $net = $added - $removed
    
    $obj = New-Object PSObject
    Add-Member -InputObject $obj -MemberType NoteProperty -Name Author -Value $author
    Add-Member -InputObject $obj -MemberType NoteProperty -Name Added -Value $added
    Add-Member -InputObject $obj -MemberType NoteProperty -Name Removed -Value $removed
    Add-Member -InputObject $obj -MemberType NoteProperty -Name Net -Value $net
    $obj
}

$stats = $stats | Sort-Object -Property Net -Descending

$totalAdded = 0
$totalRemoved = 0
$stats | ForEach-Object {
    $totalAdded += $_.Added
    $totalRemoved += $_.Removed
}
$totalNet = $totalAdded - $totalRemoved

$stats | ForEach-Object {
    $percentage = if ($totalNet -gt 0) { [math]::Round(($_.Net / $totalNet) * 100, 1) } else { 0 }
    Write-Host ("  {0,-30} +{1,6} -{2,6} = {3,7} ({4,5}%)" -f $_.Author, $_.Added, $_.Removed, $_.Net, $percentage)
}

Write-Host ""
Write-Host ("  Total: +{0} -{1} = {2} lines" -f $totalAdded, $totalRemoved, $totalNet)
Write-Host ""
