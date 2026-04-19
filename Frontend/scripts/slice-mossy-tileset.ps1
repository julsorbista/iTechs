param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\assets\2d_platform\Mossy Tileset'),
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\assets\2d_platform\Mossy Tileset\processed'),
  [string]$PublicRoot = (Join-Path $PSScriptRoot '..\public\mossy-tiles'),
  [string]$GeneratedManifestPath = (Join-Path $PSScriptRoot '..\src\features\level-editor\mossyTilePaths.generated.js'),
  [byte]$AlphaThreshold = 0,
  [switch]$CleanOutput
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-FullPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (Test-Path -LiteralPath $Path) {
    return (Resolve-Path -LiteralPath $Path).Path
  }

  return [System.IO.Path]::GetFullPath($Path)
}

function Convert-ToSlug {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $normalized = $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  return $normalized.Trim('-')
}

$resolvedSourceDir = Resolve-FullPath -Path $SourceDir
$resolvedOutputRoot = Resolve-FullPath -Path $OutputRoot
$resolvedPublicRoot = Resolve-FullPath -Path $PublicRoot
$resolvedGeneratedManifestPath = Resolve-FullPath -Path $GeneratedManifestPath

if (-not (Test-Path -LiteralPath $resolvedSourceDir)) {
  throw "Source directory not found: $resolvedSourceDir"
}

if ($CleanOutput -and (Test-Path -LiteralPath $resolvedOutputRoot)) {
  Remove-Item -LiteralPath $resolvedOutputRoot -Recurse -Force
}

if ($CleanOutput -and (Test-Path -LiteralPath $resolvedPublicRoot)) {
  Remove-Item -LiteralPath $resolvedPublicRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $resolvedOutputRoot -Force | Out-Null
New-Item -ItemType Directory -Path $resolvedPublicRoot -Force | Out-Null
New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($resolvedGeneratedManifestPath)) -Force | Out-Null

Add-Type -AssemblyName System.Drawing

$csharpSource = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public sealed class DetectedObjectInfo
{
    public int MinX;
    public int MinY;
    public int MaxX;
    public int MaxY;
    public int PixelCount;
    public string OutputFileName;

    public int Width
    {
        get { return (this.MaxX - this.MinX) + 1; }
    }

    public int Height
    {
        get { return (this.MaxY - this.MinY) + 1; }
    }
}

public sealed class ExtractedObjectSummary
{
    public string SourceFile;
    public string OutputDirectory;
    public int SourceWidth;
    public int SourceHeight;
    public int ObjectCount;
    public List<DetectedObjectInfo> Objects;
}

public static class MossyObjectExtractor
{
    private static bool IsMaskPixel(byte[] bytes, int stride, int x, int y, byte alphaThreshold, int maskMode, byte ignoreDarkThreshold)
    {
        int pixelIndex = (y * stride) + (x * 4);
        byte blue = bytes[pixelIndex];
        byte green = bytes[pixelIndex + 1];
        byte red = bytes[pixelIndex + 2];
        byte alpha = bytes[pixelIndex + 3];

        if (alpha <= alphaThreshold)
        {
            return false;
        }

        if (maskMode == 1 && red <= ignoreDarkThreshold && green <= ignoreDarkThreshold && blue <= ignoreDarkThreshold)
        {
            return false;
        }

        return true;
    }

    private static Bitmap NormalizeBitmap(Bitmap source)
    {
        Bitmap normalized = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);

        using (Graphics graphics = Graphics.FromImage(normalized))
        {
            graphics.Clear(Color.Transparent);
            graphics.CompositingMode = CompositingMode.SourceCopy;
            graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode = PixelOffsetMode.Half;
            graphics.SmoothingMode = SmoothingMode.None;
            graphics.DrawImage(source, 0, 0, source.Width, source.Height);
        }

        return normalized;
    }

    private static bool BoundsIntersect(DetectedObjectInfo left, DetectedObjectInfo right, int gap)
    {
        bool overlapX = (left.MinX - gap) <= right.MaxX && (right.MinX - gap) <= left.MaxX;
        bool overlapY = (left.MinY - gap) <= right.MaxY && (right.MinY - gap) <= left.MaxY;
        return overlapX && overlapY;
    }

    private static List<DetectedObjectInfo> MergeNearbyObjects(List<DetectedObjectInfo> components, int mergeGap)
    {
        List<DetectedObjectInfo> merged = new List<DetectedObjectInfo>(components);
        bool changed = true;

        while (changed)
        {
            changed = false;

            for (int leftIndex = 0; leftIndex < merged.Count && !changed; leftIndex++)
            {
                for (int rightIndex = leftIndex + 1; rightIndex < merged.Count; rightIndex++)
                {
                    DetectedObjectInfo left = merged[leftIndex];
                    DetectedObjectInfo right = merged[rightIndex];

                    if (!BoundsIntersect(left, right, mergeGap))
                    {
                        continue;
                    }

                    left.MinX = Math.Min(left.MinX, right.MinX);
                    left.MinY = Math.Min(left.MinY, right.MinY);
                    left.MaxX = Math.Max(left.MaxX, right.MaxX);
                    left.MaxY = Math.Max(left.MaxY, right.MaxY);
                    left.PixelCount += right.PixelCount;
                    merged[leftIndex] = left;
                    merged.RemoveAt(rightIndex);
                    changed = true;
                    break;
                }
            }
        }

        merged.Sort(delegate (DetectedObjectInfo left, DetectedObjectInfo right)
        {
            int verticalDelta = left.MinY.CompareTo(right.MinY);
            if (verticalDelta != 0)
            {
                return verticalDelta;
            }

            return left.MinX.CompareTo(right.MinX);
        });

        return merged;
    }

    private static List<DetectedObjectInfo> DetectObjects(Bitmap bitmap, byte alphaThreshold, int minPixels, int minWidth, int minHeight, int mergeGap, int maskMode, byte ignoreDarkThreshold)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

        try
        {
            int stride = data.Stride;
            byte[] bytes = new byte[Math.Abs(stride) * bitmap.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);

            int width = bitmap.Width;
            int height = bitmap.Height;
            int totalPixels = width * height;
            bool[] visited = new bool[totalPixels];
            int[] queue = new int[totalPixels];
            int[] neighborX = new int[] { -1, 0, 1, -1, 1, -1, 0, 1 };
            int[] neighborY = new int[] { -1, -1, -1, 0, 0, 1, 1, 1 };
            List<DetectedObjectInfo> components = new List<DetectedObjectInfo>();

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = (y * width) + x;
                    if (visited[index])
                    {
                        continue;
                    }

                    visited[index] = true;

                    if (!IsMaskPixel(bytes, stride, x, y, alphaThreshold, maskMode, ignoreDarkThreshold))
                    {
                        continue;
                    }

                    int head = 0;
                    int tail = 0;
                    queue[tail] = index;
                    tail++;

                    DetectedObjectInfo component = new DetectedObjectInfo();
                    component.MinX = x;
                    component.MinY = y;
                    component.MaxX = x;
                    component.MaxY = y;
                    component.PixelCount = 0;

                    while (head < tail)
                    {
                        int current = queue[head];
                        head++;

                        int currentX = current % width;
                        int currentY = current / width;
                        component.PixelCount++;

                        if (currentX < component.MinX)
                        {
                            component.MinX = currentX;
                        }

                        if (currentY < component.MinY)
                        {
                            component.MinY = currentY;
                        }

                        if (currentX > component.MaxX)
                        {
                            component.MaxX = currentX;
                        }

                        if (currentY > component.MaxY)
                        {
                            component.MaxY = currentY;
                        }

                        for (int neighborIndex = 0; neighborIndex < 8; neighborIndex++)
                        {
                            int nextX = currentX + neighborX[neighborIndex];
                            int nextY = currentY + neighborY[neighborIndex];

                            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height)
                            {
                                continue;
                            }

                            int nextPixelIndex = (nextY * width) + nextX;
                            if (visited[nextPixelIndex])
                            {
                                continue;
                            }

                            visited[nextPixelIndex] = true;

                            if (!IsMaskPixel(bytes, stride, nextX, nextY, alphaThreshold, maskMode, ignoreDarkThreshold))
                            {
                                continue;
                            }

                            queue[tail] = nextPixelIndex;
                            tail++;
                        }
                    }

                    if (component.PixelCount >= minPixels && component.Width >= minWidth && component.Height >= minHeight)
                    {
                        components.Add(component);
                    }
                }
            }

            return MergeNearbyObjects(components, mergeGap);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    public static ExtractedObjectSummary ExtractObjects(
        string sourcePath,
        string outputDirectory,
        string filePrefix,
        byte alphaThreshold,
        int minPixels,
        int minWidth,
        int minHeight,
        int mergeGap,
        int padding,
        int maskMode,
        byte ignoreDarkThreshold)
    {
        Directory.CreateDirectory(outputDirectory);

        using (Bitmap rawBitmap = new Bitmap(sourcePath))
        using (Bitmap bitmap = NormalizeBitmap(rawBitmap))
        {
            List<DetectedObjectInfo> objects = DetectObjects(bitmap, alphaThreshold, minPixels, minWidth, minHeight, mergeGap, maskMode, ignoreDarkThreshold);

            for (int index = 0; index < objects.Count; index++)
            {
                DetectedObjectInfo detectedObject = objects[index];

                int cropX = Math.Max(0, detectedObject.MinX - padding);
                int cropY = Math.Max(0, detectedObject.MinY - padding);
                int cropRight = Math.Min(bitmap.Width - 1, detectedObject.MaxX + padding);
                int cropBottom = Math.Min(bitmap.Height - 1, detectedObject.MaxY + padding);
                int cropWidth = (cropRight - cropX) + 1;
                int cropHeight = (cropBottom - cropY) + 1;
                Rectangle sourceRect = new Rectangle(cropX, cropY, cropWidth, cropHeight);
                string outputFileName = string.Format("{0}-object-{1:D3}.png", filePrefix, index + 1);

                using (Bitmap outputBitmap = new Bitmap(cropWidth, cropHeight, PixelFormat.Format32bppArgb))
                using (Graphics graphics = Graphics.FromImage(outputBitmap))
                {
                    graphics.Clear(Color.Transparent);
                    graphics.CompositingMode = CompositingMode.SourceCopy;
                    graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
                    graphics.PixelOffsetMode = PixelOffsetMode.Half;
                    graphics.SmoothingMode = SmoothingMode.None;
                    graphics.DrawImage(bitmap, new Rectangle(0, 0, cropWidth, cropHeight), sourceRect, GraphicsUnit.Pixel);
                    outputBitmap.Save(Path.Combine(outputDirectory, outputFileName), ImageFormat.Png);
                }

                detectedObject.MinX = cropX;
                detectedObject.MinY = cropY;
                detectedObject.MaxX = cropRight;
                detectedObject.MaxY = cropBottom;
                detectedObject.OutputFileName = outputFileName;
            }

            ExtractedObjectSummary summary = new ExtractedObjectSummary();
            summary.SourceFile = Path.GetFileName(sourcePath);
            summary.OutputDirectory = outputDirectory;
            summary.SourceWidth = bitmap.Width;
            summary.SourceHeight = bitmap.Height;
            summary.ObjectCount = objects.Count;
            summary.Objects = objects;
            return summary;
        }
    }
}
"@

Add-Type -TypeDefinition $csharpSource -ReferencedAssemblies 'System.Drawing'

$sheetProfiles = @{
  'Mossy - BackgroundDecoration' = @{
    MinPixels = 260
    MinWidth = 12
    MinHeight = 12
    MergeGap = 18
    Padding = 4
    MaskMode = 0
    IgnoreDarkThreshold = 0
  }
  'Mossy - Decorations&Hazards' = @{
    MinPixels = 180
    MinWidth = 10
    MinHeight = 10
    MergeGap = 16
    Padding = 4
    MaskMode = 0
    IgnoreDarkThreshold = 0
  }
  'Mossy - FloatingPlatforms' = @{
    MinPixels = 120
    MinWidth = 16
    MinHeight = 8
    MergeGap = 12
    Padding = 4
    MaskMode = 0
    IgnoreDarkThreshold = 0
  }
  'Mossy - Hanging Plants' = @{
    MinPixels = 90
    MinWidth = 6
    MinHeight = 18
    MergeGap = 12
    Padding = 4
    MaskMode = 0
    IgnoreDarkThreshold = 0
  }
  'Mossy - MossyHills' = @{
    MinPixels = 180
    MinWidth = 16
    MinHeight = 12
    MergeGap = 14
    Padding = 4
    MaskMode = 0
    IgnoreDarkThreshold = 0
  }
  'Mossy - TileSet' = @{
    MinPixels = 120
    MinWidth = 10
    MinHeight = 10
    MergeGap = 8
    Padding = 2
    MaskMode = 1
    IgnoreDarkThreshold = 36
  }
}

$defaultProfile = @{
  MinPixels = 180
  MinWidth = 12
  MinHeight = 12
  MergeGap = 12
  Padding = 4
  MaskMode = 0
  IgnoreDarkThreshold = 0
}

$sourceFiles = Get-ChildItem -LiteralPath $resolvedSourceDir -File -Filter '*.png' | Sort-Object Name
if (-not $sourceFiles) {
  throw "No PNG files found in $resolvedSourceDir"
}

$summaries = @()
$relativeTilePaths = @()

foreach ($sourceFile in $sourceFiles) {
  $profile = if ($sheetProfiles.ContainsKey($sourceFile.BaseName)) {
    $sheetProfiles[$sourceFile.BaseName]
  } else {
    $defaultProfile
  }

  $sheetSlug = Convert-ToSlug -Value $sourceFile.BaseName
  $sheetOutputDirectory = Join-Path $resolvedOutputRoot $sheetSlug
  if (Test-Path -LiteralPath $sheetOutputDirectory) {
    Remove-Item -LiteralPath $sheetOutputDirectory -Recurse -Force
  }

  $summary = [MossyObjectExtractor]::ExtractObjects(
    $sourceFile.FullName,
    $sheetOutputDirectory,
    $sheetSlug,
    $AlphaThreshold,
    [int]$profile.MinPixels,
    [int]$profile.MinWidth,
    [int]$profile.MinHeight,
    [int]$profile.MergeGap,
    [int]$profile.Padding,
    [int]$profile.MaskMode,
    [byte]$profile.IgnoreDarkThreshold
  )

  $relativeObjectPaths = @(
    $summary.Objects |
      ForEach-Object {
        '{0}/{1}' -f $sheetSlug, $_.OutputFileName
      }
  )
  $relativeTilePaths += $relativeObjectPaths

  $summaries += [PSCustomObject]@{
    sourceFile = $summary.SourceFile
    sourceWidth = $summary.SourceWidth
    sourceHeight = $summary.SourceHeight
    objectCount = $summary.ObjectCount
    minPixels = [int]$profile.MinPixels
    minWidth = [int]$profile.MinWidth
    minHeight = [int]$profile.MinHeight
    mergeGap = [int]$profile.MergeGap
    padding = [int]$profile.Padding
    maskMode = [int]$profile.MaskMode
    ignoreDarkThreshold = [int]$profile.IgnoreDarkThreshold
    outputDirectory = $summary.OutputDirectory
    objects = @(
      $summary.Objects | ForEach-Object {
        [PSCustomObject]@{
          fileName = $_.OutputFileName
          x = $_.MinX
          y = $_.MinY
          width = $_.Width
          height = $_.Height
          pixelCount = $_.PixelCount
        }
      }
    )
  }

  Write-Output ("Extracted {0}: {1} objects into {2}" -f $summary.SourceFile, $summary.ObjectCount, $summary.OutputDirectory)
}

$summaryPath = Join-Path $resolvedOutputRoot 'object-summary.json'
$summaries | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
Write-Output ("Wrote summary to {0}" -f $summaryPath)

Get-ChildItem -LiteralPath $resolvedOutputRoot | Copy-Item -Destination $resolvedPublicRoot -Recurse -Force
Write-Output ("Mirrored processed objects to {0}" -f $resolvedPublicRoot)

$relativeTilePaths = $relativeTilePaths | Sort-Object
$relativeTilePathsJson = $relativeTilePaths | ConvertTo-Json
$generatedManifest = @"
export const MOSSY_TILE_PATHS = Object.freeze($relativeTilePathsJson);

export default MOSSY_TILE_PATHS;
"@

$generatedManifest | Set-Content -LiteralPath $resolvedGeneratedManifestPath -Encoding UTF8
Write-Output ("Wrote generated tile manifest to {0}" -f $resolvedGeneratedManifestPath)
