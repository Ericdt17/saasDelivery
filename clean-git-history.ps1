# Script PowerShell pour nettoyer l'URI PostgreSQL de l'historique Git
# Usage: .\clean-git-history.ps1

Write-Host "🔒 NETTOYAGE DE L'HISTORIQUE GIT" -ForegroundColor Red
Write-Host ""

# L'URI PostgreSQL complète à supprimer
$exposedUri = "postgresql://saas_delivery_db_dev_user:b0DYXiuMQil3dKD4cLTocuKMplBJGsSd@dpg-d4u66kdactks73abkav0-a.oregon-postgres.render.com/saas_delivery_db_dev"
$replacement = "postgresql://user:****@host/database"

Write-Host "URI à supprimer: $($exposedUri.Substring(0, 50))..." -ForegroundColor Yellow
Write-Host "Remplacé par: $replacement" -ForegroundColor Green
Write-Host ""

# Créer le fichier replacements.txt pour BFG
Write-Host "📝 Création du fichier replacements.txt..." -ForegroundColor Cyan
$replacementLine = "$exposedUri==>$replacement"
$replacementLine | Out-File -FilePath "replacements.txt" -Encoding ASCII -NoNewline
Write-Host "✅ Fichier replacements.txt créé" -ForegroundColor Green
Write-Host ""

Write-Host "📋 INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Téléchargez BFG Repo-Cleaner:" -ForegroundColor Yellow
Write-Host "   https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor White
Write-Host ""
Write-Host "2. Placez bfg.jar dans un dossier accessible" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Exécutez BFG:" -ForegroundColor Yellow
Write-Host "   java -jar C:\chemin\vers\bfg.jar --replace-text replacements.txt" -ForegroundColor White
Write-Host ""
Write-Host "4. Nettoyez les références Git:" -ForegroundColor Yellow
Write-Host "   git reflog expire --expire=now --all" -ForegroundColor White
Write-Host "   git gc --prune=now --aggressive" -ForegroundColor White
Write-Host ""
Write-Host "5. Force push (⚠️ ATTENTION: réécrit l'historique):" -ForegroundColor Yellow
Write-Host "   git push origin --force --all" -ForegroundColor White
Write-Host "   git push origin --force --tags" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Régénérez le mot de passe PostgreSQL sur Render!" -ForegroundColor Red
Write-Host ""


