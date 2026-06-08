<#
.SYNOPSIS
    Merges all .md files in a directory into one Markdown file.
.DESCRIPTION
    Adds a horizontal rule and file name heading before each file's content.
.PARAMETER InputDir
    Directory to scan (default: current directory).
.PARAMETER OutputFile
    Path for the merged file (default: .\merged.md).
.EXAMPLE
    .\merge_md.ps1
    .\merge_md.ps1 -InputDir "C:\notes" -OutputFile "all.md"
#>

param(
    [string]$InputDir = ".",
    [string]$OutputFile = "merged.md"
)

# Resolve full paths to avoid self-inclusion
$InputDir = Resolve-Path $InputDir
$OutputFile = Join-Path (Get-Location) $OutputFile

# Get all .md files in the directory (not recursively), sorted by name
$mdFiles = Get-ChildItem -Path $InputDir -Filter "*.md" -File |
           Where-Object { $_.FullName -ne (Resolve-Path $OutputFile).Path } |
           Sort-Object Name

if (-not $mdFiles) {
    Write-Host "No .md files found in '$InputDir'." -ForegroundColor Yellow
    exit 0
}

# Clear/create output file
"" | Out-File -FilePath $OutputFile -Encoding utf8

$first = $true
foreach ($file in $mdFiles) {
    if (-not $first) {
        "`r`n`r`n" | Out-File -FilePath $OutputFile -Append -Encoding utf8 -NoNewline
    }
    else {
        $first = $false
    }

    # Separator and heading
    "---`r`n## $($file.Name)`r`n`r`n" | Out-File -FilePath $OutputFile -Append -Encoding utf8 -NoNewline

    # File content
    Get-Content -Path $file.FullName -Raw | Out-File -FilePath $OutputFile -Append -Encoding utf8 -NoNewline
}

# Trailing newline
"`r`n" | Out-File -FilePath $OutputFile -Append -Encoding utf8

Write-Host "Merged $($mdFiles.Count) file(s) into '$OutputFile'."