# Set WiX path to use cached version
$env:WIX = "$env:USERPROFILE\.tauri\WixTools"

Write-Host "Using WiX from: $env:WIX" -ForegroundColor Green

# Run the build
npm run tauri build -- --target x86_64-pc-windows-msvc
