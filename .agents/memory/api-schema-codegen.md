---
name: Régénération des schémas API
description: Particularité du codegen Orval et du barrel Zod dans ce projet.
---

Après chaque génération OpenAPI, vérifier le barrel du paquet Zod et conserver uniquement l’export du module généré principal si l’export des types provoque des collisions TS2308.

**Why:** Dans ce projet, Orval rétablit l’export des types et génère aussi des schémas portant les mêmes noms, ce qui provoque plusieurs exports ambigus et bloque le typecheck.

**How to apply:** Après toute commande de codegen, lancer le typecheck des bibliothèques. Si des erreurs TS2308 apparaissent dans le barrel Zod, retirer l’export redondant des types avant de vérifier l’API et le frontend.