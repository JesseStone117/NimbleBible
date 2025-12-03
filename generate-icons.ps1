# PowerShell script to generate PNG icons using .NET
# Run: powershell -ExecutionPolicy Bypass -File generate-icons.ps1

Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param(
        [int]$Size,
        [bool]$IsMaskable = $false
    )
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    
    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 30, 30))
    $graphics.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    
    if ($IsMaskable) {
        # Draw safe zone circle (80% of canvas)
        $centerX = $Size / 2
        $centerY = $Size / 2
        $radius = $Size * 0.4
        $graphics.FillEllipse($bgBrush, ($centerX - $radius), ($centerY - $radius), ($radius * 2), ($radius * 2))
    }
    
    # Text "NB"
    $font = New-Object System.Drawing.Font("Arial", ($Size * 0.52), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(59, 130, 246))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString("NB", $font, $textBrush, ($Size / 2), ($Size / 2), $format)
    
    return $bitmap
}

$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

$icons = @(
    @{ Size = 192; Maskable = $false; FileName = "icon-192.png" },
    @{ Size = 512; Maskable = $false; FileName = "icon-512.png" },
    @{ Size = 192; Maskable = $true; FileName = "icon-maskable-192.png" },
    @{ Size = 512; Maskable = $true; FileName = "icon-maskable-512.png" }
)

Write-Host "Generating PNG icons...`n" -ForegroundColor Cyan

foreach ($icon in $icons) {
    try {
        $bitmap = Create-Icon -Size $icon.Size -IsMaskable $icon.Maskable
        $filePath = Join-Path $iconsDir $icon.FileName
        $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bitmap.Dispose()
        Write-Host "✅ Generated: $($icon.FileName)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error generating $($icon.FileName): $_" -ForegroundColor Red
    }
}

Write-Host "`n✨ Icon generation complete!" -ForegroundColor Cyan

