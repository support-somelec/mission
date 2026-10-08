---
name: Règlement du solde des missions
description: Règles métier demandées pour l'extraction Excel des 30 % restants.
---

L'administrateur extrait les 30 % restants uniquement pour des missions totalement validées. La confirmation de l'extraction vaut enregistrement du paiement intégral, sans possibilité de nouveau paiement de la même mission. Le fichier contient une ligne par agent avec numéro de mission, matricule ou NNI, nom, prénom, montant du solde, mois et année.

**Why:** L'utilisateur a demandé que l'extraction elle-même solde définitivement la mission et empêche de la payer à nouveau.

**How to apply:** Distinguer une nouvelle extraction de paiement d'un simple retéléchargement du fichier déjà extrait. Ce dernier ne doit jamais créer un nouveau règlement.

Le mois et l'année de mission correspondent à sa date de début, même si la mission se termine pendant un autre mois.

**Why:** L'utilisateur a explicitement choisi la date de début de mission.

**How to apply:** Utiliser cette même période dans les filtres, les aperçus et le fichier Excel.
