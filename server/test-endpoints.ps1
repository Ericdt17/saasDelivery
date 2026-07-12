# Script PowerShell pour tester les endpoints disponibles
# Usage: .\test-endpoints.ps1

$API_URL = "https://saasdelivery.onrender.com"

Write-Host "Test des endpoints disponibles" -ForegroundColor Cyan
Write-Host "URL de base: $API_URL" -ForegroundColor Gray
Write-Host ""

# Test 1: Health check (devrait toujours fonctionner)
Write-Host "1. Test Health Check (/api/v1/health)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/health" -Method Get
    Write-Host "   Health Check OK" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host "   Service: $($response.service)" -ForegroundColor Gray
    Write-Host "   Version: $($response.version)" -ForegroundColor Gray
} catch {
    Write-Host "   Health Check FAILED" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Le serveur ne repond pas ou n'est pas accessible!" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test 2: Root endpoint
Write-Host "2. Test Root Endpoint (/)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/" -Method Get
    Write-Host "   Root Endpoint OK" -ForegroundColor Green
    Write-Host "   Message: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "   Root Endpoint: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Diagnostic endpoint (peut ne pas exister encore)
Write-Host "3. Test Diagnostic Endpoint (/api/v1/auth/diagnostic)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/auth/diagnostic" -Method Get
    Write-Host "   Diagnostic Endpoint OK" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 404) {
        Write-Host "   Endpoint non trouve (404)" -ForegroundColor Yellow
        Write-Host "   L'endpoint de diagnostic n'a pas encore ete deploye" -ForegroundColor Yellow
        Write-Host "   Deployez les dernieres modifications sur Render" -ForegroundColor Yellow
    } else {
        Write-Host "   Erreur: $statusCode" -ForegroundColor Red
        Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 4: Login endpoint (test avec identifiants invalides)
Write-Host "4. Test Login Endpoint (/api/v1/auth/login)..." -ForegroundColor Yellow
try {
    $body = @{
        email = "test@example.com"
        password = "testpassword"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/auth/login" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "   Login Endpoint repond" -ForegroundColor Green
    Write-Host "   Success: $($response.success)" -ForegroundColor Gray
    Write-Host "   Error: $($response.error)" -ForegroundColor Gray
    Write-Host "   Message: $($response.message)" -ForegroundColor Gray
    
    if ($response.details) {
        Write-Host "   Details: $($response.details)" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Status Code: $statusCode" -ForegroundColor $(if ($statusCode -eq 401 -or $statusCode -eq 400) { "Green" } else { "Red" })
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd() | ConvertFrom-Json
        
        Write-Host "   Error: $($responseBody.error)" -ForegroundColor $(if ($statusCode -eq 401) { "Yellow" } else { "Red" })
        Write-Host "   Message: $($responseBody.message)" -ForegroundColor Gray
        
        if ($responseBody.details) {
            Write-Host "   Details: $($responseBody.details)" -ForegroundColor Yellow
        }
        
        if ($statusCode -eq 500) {
            Write-Host ""
            Write-Host "   ERREUR 500 DETECTEE!" -ForegroundColor Red
            Write-Host "   Problemes possibles:" -ForegroundColor Yellow
            Write-Host "      1. Table 'agencies' n'existe pas" -ForegroundColor Yellow
            Write-Host "      2. Probleme de connexion a la base de donnees" -ForegroundColor Yellow
            Write-Host "      3. DATABASE_URL incorrect ou manquant" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Actions a faire:" -ForegroundColor Cyan
            Write-Host "      1. Verifiez les logs Render pour l'erreur exacte" -ForegroundColor Cyan
            Write-Host "      2. Verifiez DATABASE_URL dans les variables d'environnement Render" -ForegroundColor Cyan
            Write-Host "      3. Creez la table agencies si elle n'existe pas" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host ("=" * 70)
Write-Host "Tests termines!" -ForegroundColor Green
Write-Host ("=" * 70)
Write-Host ""
