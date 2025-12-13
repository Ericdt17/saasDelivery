# Script PowerShell pour nettoyer l'historique Git des secrets PostgreSQL
# Usage: .\CLEAN_GIT_HISTORY.ps1

# ⚠️ ATTENTION: Ce script va réécrire l'historique Git
# Assurez-vous d'avoir une sauvegarde avant de continuer

Write-Host "🔒 NETTOYAGE DE L'HISTORIQUE GIT - SUPPRESSION DES SECRETS" -ForegroundColor Red
Write-Host ""

# L'URI PostgreSQL complète à supprimer
$exposedUri = "postgresql://saas_delivery_db_dev_user:b0DYXiuMQil3dKD4cLTocuKMplBJGsSd@dpg-d4u66kdactks73abkav0-a.oregon-postgres.render.com/saas_delivery_db_dev"
$replacement = "postgresql://user:****@host/database"

Write-Host "URI à supprimer: $exposedUri" -ForegroundColor Yellow
Write-Host "Remplacé par: $replacement" -ForegroundColor Green
Write-Host ""

# Option 1: Utiliser git filter-branch (méthode native)
Write-Host "Méthode 1: Utilisation de git filter-branch..." -ForegroundColor Cyan

# Créer un script de remplacement
$filterScript = @"
#!/bin/sh
git grep -l '$exposedUri' | xargs sed -i 's|$exposedUri|$replacement|g'
"@

$filterScript | Out-File -FilePath "filter-script.sh" -Encoding ASCII

# Exécuter git filter-branch
Write-Host "Exécution de git filter-branch..." -ForegroundColor Yellow
git filter-branch --force --index-filter "git ls-files -s | sed 's/\t\"*/\t/' | GIT_INDEX_FILE=\$GIT_INDEX_FILE.new git update-index --index-info && mv \$GIT_INDEX_FILE.new \$GIT_INDEX_FILE" --prune-empty --tag-name-filter cat -- --all

# Alternative: Utiliser BFG Repo-Cleaner (plus rapide et recommandé)
Write-Host ""
Write-Host "Méthode 2 (Recommandée): Utilisation de BFG Repo-Cleaner" -ForegroundColor Cyan
Write-Host "1. Téléchargez BFG: https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor Yellow
Write-Host "2. Créez un fichier passwords.txt avec l'URI" -ForegroundColor Yellow
Write-Host "3. Exécutez: java -jar bfg.jar --replace-text passwords.txt" -ForegroundColor Yellow

# Créer le fichier passwords.txt pour BFG
$exposedUri | Out-File -FilePath "passwords.txt" -Encoding ASCII -NoNewline
Write-Host ""
Write-Host "✅ Fichier passwords.txt créé pour BFG" -ForegroundColor Green

Write-Host ""
Write-Host "⚠️  IMPORTANT: Après nettoyage, vous devrez:" -ForegroundColor Red
Write-Host "   1. Nettoyer les références: git reflog expire --expire=now --all" -ForegroundColor Yellow
Write-Host "   2. Nettoyer: git gc --prune=now --aggressive" -ForegroundColor Yellow
Write-Host "   3. Force push: git push origin --force --all" -ForegroundColor Yellow
Write-Host "   4. Force push tags: git push origin --force --tags" -ForegroundColor Yellow


