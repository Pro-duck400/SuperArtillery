# GitHub Pull Request Statistics
# Analyzes PRs per contributor (created, merged, rejected)
# Requires GitHub CLI (gh) to be installed and authenticated
# To install GitHub CLI, run "winget install --id GitHub.cli"


Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  GitHub Pull Request Statistics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Fetching PR data from GitHub..." -ForegroundColor Gray

# Fetch all PRs with state information
$prs = gh pr list --state all --limit 1000 --json author,number,state,mergedAt,closedAt | ConvertFrom-Json

if (-not $prs -or $prs.Count -eq 0) {
    Write-Host "`n⚠️  No pull requests found in this repository.`n" -ForegroundColor Yellow
    exit
}

# Group by author and calculate statistics
$stats = $prs | Group-Object -Property {$_.author.login} | ForEach-Object {
    $author = $_.Name
    $authorPRs = $_.Group
    
    $total = $authorPRs.Count
    $merged = ($authorPRs | Where-Object { $_.mergedAt -ne $null }).Count
    $closed = ($authorPRs | Where-Object { $_.state -eq "CLOSED" -and $_.mergedAt -eq $null }).Count
    $open = ($authorPRs | Where-Object { $_.state -eq "OPEN" }).Count
    
    [PSCustomObject]@{
        Author = $author
        Total = $total
        Merged = $merged
        Rejected = $closed
        Open = $open
    }
} | Sort-Object -Property Total -Descending

# 1. Pull Requests per Contributor
Write-Host "`n📊 PULL REQUESTS PER CONTRIBUTOR" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────`n" -ForegroundColor DarkGray

$totalPRs = ($stats | Measure-Object -Property Total -Sum).Sum

$stats | ForEach-Object {
    $percentage = [math]::Round(($_.Total / $totalPRs) * 100, 1)
    $bar = "█" * [math]::Min([int]($percentage / 2), 50)
    Write-Host ("  {0,-30} {1,4} PRs ({2,5}%)  {3}" -f $_.Author, $_.Total, $percentage, $bar) -ForegroundColor White
}

Write-Host ("`n  Total: {0} pull requests`n" -f $totalPRs) -ForegroundColor Green

# 2. Detailed Status Breakdown
Write-Host "`n📝 STATUS BREAKDOWN PER CONTRIBUTOR" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────`n" -ForegroundColor DarkGray

$stats | ForEach-Object {
    $mergeRate = if ($_.Total -gt 0) { [math]::Round(($_.Merged / $_.Total) * 100, 1) } else { 0 }
    
    Write-Host ("  {0,-30}" -f $_.Author) -ForegroundColor White
    Write-Host ("    ✓ Merged:   {0,3} ({1,5}%)" -f $_.Merged, $mergeRate) -ForegroundColor Green
    Write-Host ("    ✗ Rejected: {0,3}" -f $_.Rejected) -ForegroundColor Red
    Write-Host ("    ⧗ Open:     {0,3}" -f $_.Open) -ForegroundColor Yellow
    Write-Host ""
}

# Summary
$totalMerged = ($stats | Measure-Object -Property Merged -Sum).Sum
$totalRejected = ($stats | Measure-Object -Property Rejected -Sum).Sum
$totalOpen = ($stats | Measure-Object -Property Open -Sum).Sum
$overallMergeRate = if ($totalPRs -gt 0) { [math]::Round(($totalMerged / $totalPRs) * 100, 1) } else { 0 }

Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ("  Overall: {0} merged ({1}%), {2} rejected, {3} open`n" -f $totalMerged, $overallMergeRate, $totalRejected, $totalOpen) -ForegroundColor Green