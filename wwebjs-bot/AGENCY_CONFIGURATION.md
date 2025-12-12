# Configuration des Agences

## Assignation automatique des groupes WhatsApp

Quand un nouveau groupe WhatsApp envoie un message, le système l'assigne automatiquement à une agence selon cette logique :

1. **Si `DEFAULT_AGENCY_ID` est configuré dans `.env`** → Utilise cette agence
2. **Si une seule agence active (non super_admin) existe** → Utilise automatiquement cette agence
3. **Sinon** → Utilise la première agence active trouvée

## Configuration recommandée

Pour assigner tous les nouveaux groupes à une agence spécifique, ajoutez dans votre fichier `.env` :

```env
DEFAULT_AGENCY_ID=24
```

Remplacez `24` par l'ID de votre agence.

## Vérifier les agences actives

Pour voir toutes les agences actives et leur ID :

```bash
npm run check:agencies
# ou
node src/scripts/check-active-agencies.js
```

## Réassigner un groupe existant

Si un groupe a été assigné à la mauvaise agence, vous pouvez le réassigner :

```bash
node src/scripts/reassign-group-to-agency.js <group_id> <target_agency_id>
```

Exemple :
```bash
node src/scripts/reassign-group-to-agency.js 7 24
```

## Notes importantes

- Les groupes sont créés automatiquement lors du premier message reçu
- Une fois créé, un groupe reste assigné à la même agence (sauf réassignation manuelle)
- Les livraisons sont automatiquement liées au groupe qui a envoyé le message


