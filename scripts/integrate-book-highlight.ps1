[CmdletBinding()]
param(
    [string]$BookDirectory = "book",
    [string]$SourceExtension = ".qmd"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedBookDirectory = (Resolve-Path (Join-Path $repositoryRoot $BookDirectory)).Path

if (-not $resolvedBookDirectory.StartsWith($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "BookDirectory must resolve inside the repository."
}

$sharedScriptPath = Join-Path $repositoryRoot "assets\js\github-highlight.js"
$sharedStylePath = Join-Path $repositoryRoot "assets\css\github-highlight.css"
if (-not (Test-Path -LiteralPath $sharedScriptPath)) {
    throw "Missing shared collaboration script: $sharedScriptPath"
}
if (-not (Test-Path -LiteralPath $sharedStylePath)) {
    throw "Missing shared collaboration stylesheet: $sharedStylePath"
}

$sourceOverrides = @{
    # Add exceptions here when a rendered pathname does not mirror its source.
    # "chapters/rendered-name.html" = "chapters/source-name.qmd"
}

$mapping = [ordered]@{}
$htmlFiles = Get-ChildItem -LiteralPath $resolvedBookDirectory -Recurse -File -Filter "*.html"
$bookUri = [System.Uri]::new($resolvedBookDirectory.TrimEnd("\") + "\")

foreach ($file in $htmlFiles) {
    $fileUri = [System.Uri]::new($file.FullName)
    $relativePath = [System.Uri]::UnescapeDataString(
        $bookUri.MakeRelativeUri($fileUri).ToString()
    )

    $sourcePath = if ($sourceOverrides.ContainsKey($relativePath)) {
        $sourceOverrides[$relativePath]
    }
    else {
        ([System.IO.Path]::ChangeExtension($relativePath, $SourceExtension)).Replace(
            "\",
            "/"
        )
    }
    $mapping[$relativePath] = $sourcePath

    $html = [System.IO.File]::ReadAllText($file.FullName)
    $offsetMatch = [regex]::Match(
        $html,
        '<meta name="quarto:offset" content="([^"]*)">'
    )
    if (-not $offsetMatch.Success) {
        throw "Missing quarto:offset metadata in $relativePath"
    }

    $sourceMeta = '<meta name="github-highlight-source" content="' +
        [System.Net.WebUtility]::HtmlEncode($sourcePath) + '">'
    if ($html -match '<meta name="github-highlight-source" content="[^"]*">') {
        $html = [regex]::Replace(
            $html,
            '<meta name="github-highlight-source" content="[^"]*">',
            $sourceMeta,
            1
        )
    }
    else {
        $html = $html.Replace(
            $offsetMatch.Value,
            $offsetMatch.Value + [Environment]::NewLine + $sourceMeta
        )
    }

    $styleTag = '<link rel="stylesheet" href="/assets/css/github-highlight.css">'
    if ($html -match '<link rel="stylesheet" href="[^"]*github-highlight\.css">') {
        $html = [regex]::Replace(
            $html,
            '<link rel="stylesheet" href="[^"]*github-highlight\.css">',
            $styleTag,
            1
        )
    }
    else {
        $bookStylePattern = '<link rel="stylesheet" href="[^"]*styles\.css">'
        $bookStyleMatch = [regex]::Match($html, $bookStylePattern)
        if (-not $bookStyleMatch.Success) {
            throw "Could not find the Quarto stylesheet link in $relativePath"
        }
        $html = $html.Replace(
            $bookStyleMatch.Value,
            $bookStyleMatch.Value + [Environment]::NewLine + $styleTag
        )
    }

    $scriptTag = '<script src="/assets/js/github-highlight.js" defer></script>'
    if ($html -match '<script src="[^"]*github-highlight\.js" defer></script>') {
        $html = [regex]::Replace(
            $html,
            '<script src="[^"]*github-highlight\.js" defer></script>',
            $scriptTag,
            1
        )
    }
    else {
        $html = $html.Replace(
            $styleTag,
            $styleTag + [Environment]::NewLine + $scriptTag
        )
    }

    [System.IO.File]::WriteAllText(
        $file.FullName,
        $html,
        [System.Text.UTF8Encoding]::new($false)
    )
}

$mapPath = Join-Path $resolvedBookDirectory "page-source-map.json"
$mapJson = $mapping | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText(
    $mapPath,
    $mapJson + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Integrated GitHub highlighting into $($htmlFiles.Count) pages."
Write-Host "Wrote source mapping to $mapPath."
