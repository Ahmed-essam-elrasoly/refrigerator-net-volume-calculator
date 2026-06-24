<#
.SYNOPSIS
    Exports a folder tree (subfolders, optionally files) to a text file.
.DESCRIPTION
    Creates a visual, indented tree of all directories starting from a given path.
    On Windows it leverages tree.com for speed; on Linux/macOS a PowerShell
    function produces the same output.
.PARAMETER Path
    Root directory to begin scanning. Default is the current directory.
.PARAMETER OutputFile
    Path for the output text file. Default is "FolderTree.txt" in the current directory.
.PARAMETER IncludeFiles
    Add this switch to also list files inside the folders.
.EXAMPLE
    .\Export-FolderTree.ps1 -Path C:\Projects -OutputFile project_tree.txt
    # Output contains only subfolders
.EXAMPLE
    .\Export-FolderTree.ps1 -IncludeFiles
    # Saves folders + files from current directory to FolderTree.txt
#>

param(
    [string]$Path = ".",
    [string]$OutputFile = "FolderTree.txt",
    [switch]$IncludeFiles
)

# Validate the root path
if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    Write-Error "Path '$Path' does not exist or is not a directory."
    exit 1
}

# --- Try the native tree command (Windows) ---
$treeCmd = Get-Command tree.exe -ErrorAction SilentlyContinue
if ($treeCmd -and $IsWindows) {
    $treeArgs = @($Path, '/A')   # /A → ASCII lines (safe for text files)
    if ($IncludeFiles) { $treeArgs += '/F' }

    & tree.exe $treeArgs | Out-File -FilePath $OutputFile -Encoding utf8
    Write-Host "Folder tree saved to '$OutputFile'"
}
else {
    # --- Pure PowerShell fallback ---
    function Get-Tree {
        param([string]$CurrentPath, [string]$Indent = "")

        # Subfolders
        Get-ChildItem -LiteralPath $CurrentPath -Directory | ForEach-Object {
            "$Indent+--$($_.Name)" | Out-File -FilePath $OutputFile -Append -Encoding utf8
            Get-Tree -CurrentPath $_.FullName -Indent "$Indent|   "
        }

        # Files (if requested)
        if ($IncludeFiles) {
            Get-ChildItem -LiteralPath $CurrentPath -File | ForEach-Object {
                "$Indent+--$($_.Name)" | Out-File -FilePath $OutputFile -Append -Encoding utf8
            }
        }
    }

    # Clear/initialize the output file
    $null = New-Item -Path $OutputFile -ItemType File -Force

    # Write the root folder path as the first line
    $rootDisplay = (Resolve-Path $Path).Path
    $rootDisplay | Out-File -FilePath $OutputFile -Encoding utf8

    Get-Tree -CurrentPath $Path
    Write-Host "Folder tree saved to '$OutputFile' (PowerShell fallback)"
}