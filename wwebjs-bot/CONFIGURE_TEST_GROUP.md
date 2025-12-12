# 🎯 Configurer le Bot pour Écouter Uniquement un Groupe de Test

## 📋 Objectif

Faire en sorte que le bot local écoute **uniquement** le groupe de test, et ignore tous les autres groupes.

---

## 🔍 Étape 1 : Trouver l'ID du Groupe de Test

### **Méthode 1 : Depuis les Logs du Bot** ✅ (Recommandé)

1. **Démarrez le bot** (si pas déjà démarré) :
   ```bash
   cd wwebjs-bot
   npm start
   ```

2. **Envoyez un message** dans le groupe de test WhatsApp

3. **Regardez les logs** dans le terminal. Vous verrez :
   ```
   🔍 DEBUG - Raw message received:
      isGroup: true
      groupId: 120363123456789012@g.us  ← C'est l'ID du groupe !
      targetGroupId: null
   ```

4. **Copiez l'ID du groupe** (format : `120363123456789012@g.us`)

---

### **Méthode 2 : Utiliser le Script list-groups** ✅

1. **Exécutez le script** pour lister tous les groupes :
   ```bash
   cd wwebjs-bot
   node src/list-groups.js
   ```

2. **Trouvez votre groupe de test** dans la liste

3. **Copiez l'ID du groupe** affiché

**Note :** Ce script utilise `./auth` par défaut. Si vous utilisez `./auth-dev`, modifiez temporairement le script ou utilisez la Méthode 1.

---

### **Méthode 3 : Depuis les Logs Détaillés**

Quand le bot reçoit un message, il affiche :
```
🔍 DEBUG - Raw message received:
   isGroup: true
   groupId: 120363123456789012@g.us  ← ID du groupe
   targetGroupId: null
   message length: 45
```

**Copiez le `groupId` affiché.**

---

## ⚙️ Étape 2 : Configurer GROUP_ID dans .env

1. **Ouvrez le fichier `.env`** dans `wwebjs-bot/`

2. **Ajoutez ou modifiez** la ligne `GROUP_ID` :

```env
# Autres variables...
DATABASE_URL=postgresql://...@dpg-d4u66kdactks73abkav0-a.../saas_delivery_db_dev
DB_TYPE=postgres
NODE_ENV=development

# Groupe de test uniquement
GROUP_ID=120363123456789012@g.us
```

**Important :**
- ✅ L'ID doit être au format : `120363123456789012@g.us`
- ✅ Pas d'espaces avant ou après
- ✅ Pas de guillemets

---

## 🔄 Étape 3 : Redémarrer le Bot

1. **Arrêtez le bot** (si en cours d'exécution) :
   - Appuyez sur `Ctrl+C` dans le terminal

2. **Redémarrez le bot** :
   ```bash
   npm start
   ```

3. **Vérifiez les logs** :
   ```
   🔍 DEBUG - Raw message received:
      isGroup: true
      groupId: 120363123456789012@g.us
      targetGroupId: 120363123456789012@g.us  ← Maintenant configuré !
   ```

---

## ✅ Vérification

### **Test 1 : Message dans le Groupe de Test**

Envoyez un message dans le groupe de test. Vous devriez voir :

```
✅ Processing: Group message detected!
```

Le bot traitera le message.

---

### **Test 2 : Message dans un Autre Groupe**

Envoyez un message dans un autre groupe. Vous devriez voir :

```
⏭️  Skipped: Different group (GROUP_ID is configured)
💡 Tip: Remove GROUP_ID from .env to process all groups
```

Le bot **ignorera** ce message.

---

## 📝 Exemple de Configuration .env

```env
# Base de données
NODE_ENV=development
DB_TYPE=postgres
DATABASE_URL=postgresql://saas_delivery_db_dev_user:****@dpg-d4u66kdactks73abkav0-a.oregon-postgres.render.com/saas_delivery_db_dev

# Groupe WhatsApp (uniquement le groupe de test)
GROUP_ID=120363123456789012@g.us

# Rapports (optionnel)
REPORT_TIME=20:00
REPORT_ENABLED=false
```

---

## 🔄 Pour Revenir à "Tous les Groupes"

Si vous voulez que le bot écoute **tous les groupes** à nouveau :

1. **Ouvrez `.env`**
2. **Supprimez ou commentez** la ligne `GROUP_ID` :
   ```env
   # GROUP_ID=120363123456789012@g.us  # Commenté
   ```
   Ou supprimez complètement la ligne.

3. **Redémarrez le bot**

Le bot écoutera tous les groupes où le numéro est membre.

---

## 🎯 Résumé

| Configuration | Comportement |
|---------------|--------------|
| `GROUP_ID` non défini ou commenté | ✅ Écoute **tous les groupes** |
| `GROUP_ID=120363123456789012@g.us` | ✅ Écoute **uniquement ce groupe** |

---

## ⚠️ Points Importants

1. **Format de l'ID** : Doit se terminer par `@g.us`
2. **Redémarrage requis** : Modifier `.env` nécessite de redémarrer le bot
3. **Vérification** : Les logs montrent `targetGroupId` pour confirmer la configuration

---

## 🔍 Dépannage

### **Le bot ignore tous les messages**

**Vérifiez :**
- ✅ L'ID du groupe est correct dans `.env`
- ✅ Le format est correct (`@g.us` à la fin)
- ✅ Le bot a redémarré après modification

### **Le bot écoute toujours tous les groupes**

**Vérifiez :**
- ✅ Le fichier `.env` est bien dans `wwebjs-bot/`
- ✅ La variable `GROUP_ID` est bien définie (pas de commentaire)
- ✅ Le bot a redémarré

---

**Date de création** : 2025-12-12
**Dernière mise à jour** : 2025-12-12

