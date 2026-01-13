# Git Repository Statistics
# Analyzes commits and lines of code per contributor

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Git Repository Statistics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Commits per contributor
Write-Host "📊 COMMITS PER CONTRIBUTOR" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────`n" -ForegroundColor DarkGray

$commits = git shortlog -sn --all --no-merges | ForEach-Object {
    if ($_ -match '^\s*(\d+)\s+(.+)$') {
        [PSCustomObject]@{
            Commits = [int]$matches[1]
            Author = $matches[2]
        }
    }
}

$totalCommits = ($commits | Measure-Object -Property Commits -Sum).Sum

$commits | ForEach-Object {
    $percentage = [math]::Round(($_.Commits / $totalCommits) * 100, 1)
    $bar = "█" * [math]::Min([int]($percentage / 2), 50)
    Write-Host ("  {0,-30} {1,4} commits ({2,5}%)  {3}" -f $_.Author, $_.Commits, $percentage, $bar) -ForegroundColor White
}

Write-Host ("`n  Total: {0} commits`n" -f $totalCommits) -ForegroundColor Green

# 2. Lines of code per contributor
Write-Host "`n📝 LINES OF CODE PER CONTRIBUTOR" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────`n" -ForegroundColor DarkGray

$authors = git log --format='%aN' --all | Sort-Object -Unique

$stats = $authors | ForEach-Object {
    $author = $_
    
    # Get numstat for this author
    $authorStats = git log --author="$author" --pretty=tformat: --numstat --all |
                   Where-Object { $_ -match '^\d+\s+\d+' } |
                   ForEach-Object {
                       $parts = $_ -split '\s+'
                       [PSCustomObject]@{
                           Added = if ($parts[0] -match '^\d+$') { [int]$parts[0] } else { 0 }
                           Removed = if ($parts[1] -match '^\d+$') { [int]$parts[1] } else { 0 }
                       }
                   }
    
    $added = ($authorStats | Measure-Object -Property Added -Sum).Sum
    $removed = ($authorStats | Measure-Object -Property Removed -Sum).Sum
    $net = $added - $removed
    
    [PSCustomObject]@{
        Author = $author
        Added = $added
        Removed = $removed
        Net = $net
    }
}

$stats = $stats | Sort-Object -Property Net -Descending

$totalAdded = ($stats | Measure-Object -Property Added -Sum).Sum
$totalRemoved = ($stats | Measure-Object -Property Removed -Sum).Sum
$totalNet = $totalAdded - $totalRemoved

$stats | ForEach-Object {
    $percentage = if ($totalNet -gt 0) { [math]::Round(($_.Net / $totalNet) * 100, 1) } else { 0 }
    
    Write-Host ("  {0,-30}" -f $_.Author) -ForegroundColor White -NoNewline
    Write-Host (" +{0,6} " -f $_.Added) -ForegroundColor Green -NoNewline
    Write-Host ("-{0,6} " -f $_.Removed) -ForegroundColor Red -NoNewline
    Write-Host ("= {0,7} ({1,5}%)" -f $_.Net, $percentage) -ForegroundColor Cyan
}

Write-Host ("`n  Total: +{0} -{1} = {2} lines`n" -f $totalAdded, $totalRemoved, $totalNet) -ForegroundColor Green
