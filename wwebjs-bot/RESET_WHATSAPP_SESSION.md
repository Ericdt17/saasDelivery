# 🔄 Réinitialiser la Session WhatsApp

## 🎯 Objectif

Supprimer la session existante (connectée au bot de production) pour pouvoir scanner avec un nouveau numéro (bot de dev).

---

## 📍 Emplacement de la Session

La session WhatsApp est stockée dans :
```
wwebjs-bot/auth/
```

Ce dossier contient toutes les données de session, y compris :
- Cookies
- Cache
- Données de session
- Informations d'authentification

---

## 🗑️ Méthode 1 : Supprimer le Dossier (Recommandé)

### **Étape 1 : Arrêter le Bot**

Si le bot est en cours d'exécution, arrêtez-le d'abord :
- Appuyez sur `Ctrl+C` dans le terminal où le bot tourne

### **Étape 2 : Supprimer le Dossier auth**

**Sur Windows (PowerShell) :**
```powershell
cd wwebjs-bot
Remove-Item -Recurse -Force auth
```

**Sur Windows (CMD) :**
```cmd
cd wwebjs-bot
rmdir /s /q auth
```

**Sur Linux/Mac :**
```bash
cd wwebjs-bot
rm -rf auth
```

### **Étape 3 : Redémarrer le Bot**

```bash
npm start
# ou
npm run dev
```

### **Étape 4 : Scanner le Nouveau QR Code**

Un nouveau QR code apparaîtra. Scannez-le avec le **numéro de TEST** (pas celui de production).

---

## 🔄 Méthode 2 : Renommer le Dossier (Sauvegarde)

Si vous voulez garder une sauvegarde de l'ancienne session :

### **Étape 1 : Arrêter le Bot**

### **Étape 2 : Renommer le Dossier**

**Sur Windows (PowerShell) :**
```powershell
cd wwebjs-bot
Rename-Item auth auth_backup_prod
```

**Sur Windows (CMD) :**
```cmd
cd wwebjs-bot
ren auth auth_backup_prod
```

**Sur Linux/Mac :**
```bash
cd wwebjs-bot
mv auth auth_backup_prod
```

### **Étape 3 : Redémarrer le Bot**

Un nouveau dossier `auth` sera créé automatiquement avec la nouvelle session.

---

## ✅ Vérification

Après avoir supprimé/renommé le dossier `auth` :

1. **Redémarrez le bot**
2. **Un QR code devrait apparaître** (pas de connexion automatique)
3. **Scannez avec le numéro de TEST**
4. **Le bot devrait se connecter** avec le nouveau numéro

---

## 📝 Notes Importantes

### ⚠️ **Ce qui se passe**

- ✅ L'ancienne session (bot production) est supprimée
- ✅ Un nouveau QR code sera généré
- ✅ Vous devrez scanner avec le nouveau numéro
- ✅ La nouvelle session sera sauvegardée dans `./auth/`

### ⚠️ **Impact sur le Bot Production**

- ✅ **Aucun impact** - Le bot production sur Render a sa propre session
- ✅ La session locale et la session production sont **indépendantes**
- ✅ Supprimer la session locale n'affecte **PAS** le bot production

---

## 🎯 Résumé des Commandes

### **Supprimer la Session (Windows PowerShell)**

```powershell
cd wwebjs-bot
Remove-Item -Recurse -Force auth
npm start
```

### **Supprimer la Session (Windows CMD)**

```cmd
cd wwebjs-bot
rmdir /s /q auth
npm start
```

### **Supprimer la Session (Linux/Mac)**

```bash
cd wwebjs-bot
rm -rf auth
npm start
```

---

## 🔍 Vérifier que la Session est Supprimée

Après avoir supprimé le dossier, vérifiez :

```powershell
# Windows PowerShell
Test-Path wwebjs-bot\auth
# Devrait retourner : False

# Linux/Mac
ls wwebjs-bot/auth
# Devrait retourner : No such file or directory
```

---

## ✅ Après la Suppression

1. ✅ Le bot redémarrera
2. ✅ Un nouveau QR code apparaîtra
3. ✅ Scannez avec le **numéro de TEST**
4. ✅ La nouvelle session sera sauvegardée
5. ✅ Vous n'aurez plus besoin de scanner (sauf si vous supprimez à nouveau)

---

**Date de création** : 2025-12-12
**Dernière mise à jour** : 2025-12-12

