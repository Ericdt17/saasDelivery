# ⚡ Solution Rapide : Dossier de Session Différent

## ✅ Solution Appliquée

J'ai modifié le code pour que le bot local utilise un **dossier de session différent** (`./auth-dev`) au lieu de `./auth`.

**Avantages :**
- ✅ Pas besoin de supprimer l'ancienne session
- ✅ Les deux sessions coexistent
- ✅ Bot production garde sa session dans `./auth`
- ✅ Bot local utilise `./auth-dev` (nouveau dossier)

---

## 🚀 Ce que Vous Devez Faire

### **1. Arrêter le Bot (Si Actif)**

Si le bot est en cours d'exécution :
- Appuyez sur `Ctrl+C` dans le terminal où le bot tourne

### **2. Redémarrer le Bot**

```bash
cd wwebjs-bot
npm start
```

### **3. Scanner le Nouveau QR Code**

Un nouveau QR code apparaîtra. Scannez-le avec le **numéro de TEST** (pas celui de production).

**C'est tout !** Le bot utilisera automatiquement le dossier `./auth-dev` pour la nouvelle session.

---

## 📁 Structure des Dossiers

```
wwebjs-bot/
  ├── auth/          ← Session du bot production (ancienne)
  └── auth-dev/      ← Session du bot local (nouvelle) ✅
```

---

## ✅ Vérification

Après avoir scanné le QR code, vous devriez voir :

```
✅ AUTHENTICATED SUCCESSFULLY!
✅ Session saved!
✅ Bot is ready!
📋 Listening for messages...
```

La nouvelle session sera dans `./auth-dev/`.

---

## 🔄 Si Vous Voulez Utiliser l'Ancienne Session Plus Tard

Si vous voulez revenir à l'ancienne session (bot production) :

1. Modifiez `src/index.js` :
   ```javascript
   dataPath: "./auth",  // Au lieu de "./auth-dev"
   ```

2. Ou utilisez une variable d'environnement :
   ```env
   WHATSAPP_SESSION_PATH=./auth
   ```

---

## 🎯 Résumé

- ✅ **Code modifié** pour utiliser `./auth-dev`
- ✅ **Pas besoin de supprimer** l'ancienne session
- ✅ **Redémarrez le bot** et scannez avec le nouveau numéro
- ✅ **Les deux sessions coexistent** sans problème

---

**Date de création** : 2025-12-12
**Dernière mise à jour** : 2025-12-12


