$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifacts = Join-Path $root "artifacts"

if (-not (Test-Path $artifacts)) {
  New-Item -ItemType Directory -Path $artifacts | Out-Null
}

Push-Location $root

Write-Host "Compiling circuit..."
$includePath = Join-Path -Path $root -ChildPath "..\\node_modules"
circom auth.circom --r1cs --wasm --sym -o $artifacts -l $includePath
if ($LASTEXITCODE -ne 0) { throw "circom compilation failed" }

$ptau = Join-Path $artifacts "pot12_0000.ptau"
$ptauFinal = Join-Path $artifacts "pot12_final.ptau"
$ptauPhase2 = Join-Path $artifacts "pot12_final_phase2.ptau"

if (-not (Test-Path $ptau)) {
  Write-Host "Generating Powers of Tau..."
  snarkjs powersoftau new bn128 12 $ptau -v
  snarkjs powersoftau contribute $ptau $ptauFinal --name="authchain" -v
} else {
  if (-not (Test-Path $ptauFinal)) {
    snarkjs powersoftau contribute $ptau $ptauFinal --name="authchain" -v
  }
}

if (-not (Test-Path $ptauPhase2)) {
  Write-Host "Preparing phase 2..."
  snarkjs powersoftau prepare phase2 $ptauFinal $ptauPhase2
  if ($LASTEXITCODE -ne 0) { throw "powersoftau prepare phase2 failed" }
}

$r1cs = Join-Path $artifacts "auth.r1cs"
$zkey0 = Join-Path $artifacts "auth_0000.zkey"
$zkeyFinal = Join-Path $artifacts "auth_final.zkey"
$vkey = Join-Path $artifacts "verification_key.json"

Write-Host "Setting up Groth16..."
snarkjs groth16 setup $r1cs $ptauPhase2 $zkey0
if ($LASTEXITCODE -ne 0) { throw "groth16 setup failed" }
snarkjs zkey contribute $zkey0 $zkeyFinal --name="authchain" -v
if ($LASTEXITCODE -ne 0) { throw "zkey contribute failed" }
snarkjs zkey export verificationkey $zkeyFinal $vkey
if ($LASTEXITCODE -ne 0) { throw "export verification key failed" }

Pop-Location

Write-Host "ZKP artifacts ready in zkp/artifacts."
