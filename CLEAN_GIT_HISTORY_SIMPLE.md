# 🔒 Nettoyage de l'Historique Git - PowerShell

## ⚠️ ATTENTION
Ce processus va **réécrire l'historique Git**. Assurez-vous d'avoir une sauvegarde avant de continuer.

---

## Méthode 1 : Utiliser BFG Repo-Cleaner (Recommandé)

### Étape 1 : Télécharger BFG
1. Téléchargez depuis : https://rtyley.github.io/bfg-repo-cleaner/
2. Placez `bfg.jar` dans un dossier accessible (ex: `C:\tools\bfg.jar`)

### Étape 2 : Créer le fichier de remplacement

Dans PowerShell, créez un fichier `replacements.txt` :

```powershell
# Créer le fichier replacements.txt
@"
postgresql://saas_delivery_db_dev_user:b0DYXiuMQil3dKD4cLTocuKMplBJGsSd@dpg-d4u66kdactks73abkav0-a.oregon-postgres.render.com/saas_delivery_db_dev==>postgresql://user:****@host/database
"@ | Out-File -FilePath "replacements.txt" -Encoding ASCII
```

### Étape 3 : Exécuter BFG

```powershell
# Aller dans le répertoire du projet
cd C:\Users\hp\Desktop\saasDelivery

# Exécuter BFG (remplacez le chemin par votre chemin)
java -jar C:\tools\bfg.jar --replace-text replacements.txt
```

### Étape 4 : Nettoyer les références Git

```powershell
# Nettoyer les références
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Étape 5 : Force Push

```powershell
# ⚠️ ATTENTION: Cela va réécrire l'historique sur GitHub
git push origin --force --all
git push origin --force --tags
```

---

## Méthode 2 : Utiliser git filter-branch (Alternative)

### Étape 1 : Créer un script de remplacement

```powershell
# Créer filter-script.sh
$script = @'
#!/bin/sh
git filter-branch --force --index-filter '
    git ls-files -s | sed "s/\t\"*/\t/" | GIT_INDEX_FILE=$GIT_INDEX_FILE.new git update-index --index-info && mv $GIT_INDEX_FILE.new $GIT_INDEX_FILE
' --prune-empty --tag-name-filter cat -- --all
'@

$script | Out-File -FilePath "filter-script.sh" -Encoding ASCII
```

### Étape 2 : Exécuter avec Git Bash

Ouvrez Git Bash et exécutez :
```bash
bash filter-script.sh
```

---

## Méthode 3 : Solution Simple (Si le dépôt est petit)

Si votre dépôt est petit et que vous pouvez vous permettre de perdre l'historique :

### Option A : Créer un nouveau dépôt

```powershell
# 1. Créer un nouveau dépôt sur GitHub
# 2. Cloner le nouveau dépôt
git clone https://github.com/Ericdt17/saasDelivery-clean.git
cd saasDelivery-clean

# 3. Copier tous les fichiers (sauf .git)
Copy-Item -Path "..\saasDelivery\*" -Destination "." -Recurse -Exclude ".git"

# 4. Commit initial
git add .
git commit -m "Initial commit - cleaned repository"
git push origin main
```

### Option B : Supprimer et recréer le dépôt

1. Sur GitHub : Settings → Danger Zone → Delete this repository
2. Créer un nouveau dépôt avec le même nom
3. Push les fichiers nettoyés

---

## Vérification

Après nettoyage, vérifiez que l'URI n'est plus dans l'historique :

```powershell
# Chercher dans l'historique
git log --all --full-history -p | Select-String -Pattern "b0DYXiuMQil3dKD4cLTocuKMplBJGsSd"

# Si rien n'est trouvé, c'est bon ✅
```

---

## ⚠️ Actions Post-Nettoyage

**CRITIQUE** : Même après nettoyage de l'historique, les credentials sont compromis. Vous **DEVEZ** :

1. **Régénérer le mot de passe PostgreSQL sur Render**
   - Render Dashboard → Database → Settings → Reset Password
   - Copier le nouveau mot de passe

2. **Mettre à jour toutes les variables d'environnement** :
   - Render (Backend) : `DATABASE_URL`
   - Local `.env` : `DATABASE_URL`
   - Netlify (si utilisé) : Variables d'environnement

3. **Vérifier GitGuardian** :
   - Attendre quelques minutes après le push
   - Vérifier que l'alerte disparaît

---

## 📋 Checklist

- [ ] Sauvegarde du dépôt créée
- [ ] BFG téléchargé ou méthode choisie
- [ ] Fichier `replacements.txt` créé
- [ ] BFG exécuté
- [ ] Références Git nettoyées (`git reflog expire`, `git gc`)
- [ ] Force push effectué
- [ ] Vérification que l'URI n'est plus dans l'historique
- [ ] **MOT DE PASSE POSTGRESQL RÉGÉNÉRÉ** ⚠️
- [ ] Variables d'environnement mises à jour
- [ ] GitGuardian vérifié

---

**Date de création** : 2025-12-12


