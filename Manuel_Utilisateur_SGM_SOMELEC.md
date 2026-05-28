# Manuel d'Utilisation
## Système de Gestion des Missions — SOMELEC

---

## Table des matières

1. [Présentation du système](#1-présentation-du-système)
2. [Connexion à l'application](#2-connexion-à-lapplication)
3. [Tableau de bord](#3-tableau-de-bord)
4. [Les missions — vue d'ensemble](#4-les-missions--vue-densemble)
5. [Créer une mission](#5-créer-une-mission)
6. [Suivre le parcours d'une mission](#6-suivre-le-parcours-dune-mission)
7. [Rôles et actions par profil](#7-rôles-et-actions-par-profil)
   - [Utilisateur simple (Employé)](#71-utilisateur-simple--employé)
   - [Directeur](#72-directeur)
   - [Directeur Central](#73-directeur-central)
   - [Contrôle Technique](#74-contrôle-technique)
   - [DGA](#75-dga)
   - [DMG](#76-dmg)
   - [CAD Édition](#77-cad-édition)
   - [CAD Paiement](#78-cad-paiement)
   - [Contrôle Financier](#79-contrôle-financier)
   - [Administrateur](#710-administrateur)
8. [Règles importantes à connaître](#8-règles-importantes-à-connaître)
9. [Barème des indemnités journalières](#9-barème-des-indemnités-journalières)
10. [Questions fréquentes](#10-questions-fréquentes)

---

## 1. Présentation du système

Le **Système de Gestion des Missions (SGM)** est l'application interne de SOMELEC permettant de gérer l'ensemble du cycle de vie des missions professionnelles : de la demande initiale jusqu'au paiement final des indemnités.

Grâce à ce système, chaque acteur impliqué dans le circuit d'une mission dispose d'un accès sécurisé à son propre espace de travail. Les demandes circulent automatiquement d'un valideur à l'autre sans qu'il soit nécessaire de passer par des documents papier.

---

## 2. Connexion à l'application

### Accéder à l'application

Ouvrez votre navigateur (Chrome, Firefox, Edge) et saisissez l'adresse fournie par votre administrateur informatique.

### Se connecter

1. Sur la page d'accueil, saisissez votre **nom d'utilisateur** et votre **mot de passe**
2. Cliquez sur le bouton **Se connecter**

> **Mot de passe oublié ?** Contactez votre administrateur système pour réinitialiser votre mot de passe.

### Se déconnecter

Cliquez sur votre nom en haut à droite de l'écran, puis sur **Se déconnecter**. Il est recommandé de se déconnecter à la fin de chaque session, surtout sur un ordinateur partagé.

---

## 3. Tableau de bord

Après connexion, vous arrivez sur le **tableau de bord**. Il affiche un résumé de l'activité liée à votre profil :

| Indicateur | Description |
|---|---|
| **Total des missions** | Nombre total de missions dans le système |
| **En attente** | Missions qui nécessitent votre action |
| **En cours** | Missions actuellement dans le circuit de validation |
| **Approuvées** | Missions finalisées et payées |

Utilisez le menu de gauche pour naviguer entre les différentes sections de l'application.

---

## 4. Les missions — vue d'ensemble

### Le circuit complet d'une mission

Une mission suit un parcours précis avant d'être approuvée et payée. Chaque étape doit être validée par la personne concernée avant de passer à la suivante.

```
Création
    ↓
Validation Directeur
    ↓
Validation Directeur Central
    ↓
Contrôle Technique
    ↓
DGA
    ↓
DMG (affectation des véhicules)
    ↓
En Vigueur
    ↓
CAD Édition (génération de l'Ordre de Mission)
    ↓
CAD Paiement (paiement 70%)
    ↓
Contrôle Financier (paiement 30%)
    ↓
✅ Mission Approuvée
```

> À tout moment, un valideur peut **rejeter** une mission. Elle retourne alors en statut "Rejeté" et l'initiateur en est informé.

### Les statuts d'une mission

| Statut affiché | Signification |
|---|---|
| **Brouillon** | La mission vient d'être créée, en attente de validation |
| **En attente Directeur** | Le directeur doit valider |
| **En attente Dir. Central** | Le Directeur Central doit valider |
| **Contrôle Technique** | En attente du Contrôle Technique |
| **En attente DGA** | En attente de la DGA |
| **En attente DMG** | En attente d'affectation des véhicules par le DMG |
| **En Vigueur** | Approuvée, en attente de génération de l'ordre de mission |
| **En attente CAD Paiement** | L'ordre de mission a été généré, en attente du 1er paiement |
| **Contrôle Financier** | En attente du paiement final |
| **Approuvée** | Mission terminée, tous les paiements effectués |
| **Rejetée** | La mission a été rejetée à une étape du circuit |

---

## 5. Créer une mission

Cette action est réservée aux **employés** et aux **directeurs**.

### Étapes de création

1. Dans le menu de gauche, cliquez sur **Missions**
2. Cliquez sur le bouton **Nouvelle Mission** (en haut à droite)
3. Remplissez le formulaire en suivant les sections ci-dessous

---

### Section 1 — Informations générales

| Champ | Ce qu'il faut saisir |
|---|---|
| **Titre de la mission** | Un titre clair décrivant l'objet de la mission (ex : *Inspection technique des installations à Nouadhibou*) |
| **Destination** | La ville ou la région de destination |
| **Date de début** | La date à laquelle la mission commence (ne peut pas être dans le passé) |
| **Date de fin** | La date à laquelle la mission se termine |

> ⚠️ **Important :** La date de début doit être égale ou postérieure à la date du jour. Il n'est pas possible de créer une mission rétroactive.

---

### Section 2 — Justification et objectifs

| Champ | Ce qu'il faut saisir |
|---|---|
| **Expression des besoins** | Expliquez pourquoi cette mission est nécessaire |
| **Plan d'action** | Décrivez les tâches et activités prévues pendant la mission |

---

### Section 3 — Employés assignés

1. Cliquez sur le champ **Sélectionner des employés**
2. Tapez le nom de l'employé pour le rechercher
3. Cochez les employés à inclure dans la mission
4. Les employés sélectionnés apparaissent sous la liste avec une croix (×) pour les retirer si besoin

> ⚠️ **Important :** Un employé déjà affecté à une autre mission sur la même période ne peut pas être ajouté. Un message d'erreur vous indiquera le nom de l'employé concerné et la mission en conflit.

---

### Section 4 — Logistique

| Option | Cocher si... |
|---|---|
| **Nécessite un ou plusieurs véhicules SOMELEC** | La mission requiert des véhicules de l'entreprise |
| **Nombre de véhicules requis** | Précisez combien (visible uniquement si l'option ci-dessus est cochée) |
| **Nécessite une dotation en carburant** | Du carburant doit être fourni |

---

### Envoyer la demande

Une fois tous les champs remplis, cliquez sur **Créer la mission**. La mission sera envoyée automatiquement au premier valideur du circuit.

---

## 6. Suivre le parcours d'une mission

### Accéder à une mission

1. Cliquez sur **Missions** dans le menu de gauche
2. Cliquez sur le titre d'une mission pour l'ouvrir

### Ce que vous voyez sur la page de détail

**Le suivi de progression** en haut de la page montre les 10 étapes du circuit. Chaque étape est indiquée comme :
- ✅ **Terminée** (fond coloré)
- **En cours** (étape actuelle)
- ⬜ **À venir** (étapes suivantes)

**L'historique des validations** liste toutes les actions effectuées sur la mission : qui a validé, quand, et quel commentaire a été laissé.

**La liste des missionnaires** affiche les employés affectés à la mission.

---

## 7. Rôles et actions par profil

---

### 7.1 Utilisateur simple / Employé

**Ce que vous pouvez faire :**
- Créer de nouvelles missions pour votre département
- Consulter le suivi de vos missions
- Voir l'historique des validations

**Ce que vous ne pouvez pas faire :**
- Valider les missions des autres
- Supprimer une mission (seul l'administrateur peut le faire)

---

### 7.2 Directeur

**Ce que vous pouvez faire :**
- Créer vos propres missions (elles passent directement au Directeur Central)
- **Valider ou rejeter** les missions des employés de votre département

**Comment valider une mission :**
1. Ouvrez la mission depuis la liste
2. Faites défiler vers le bas jusqu'à la section d'action
3. Cliquez sur **Valider** (ou **Rejeter** si la mission n'est pas conforme)
4. Ajoutez un commentaire si nécessaire
5. Confirmez

---

### 7.3 Directeur Central

**Ce que vous pouvez faire :**
- **Valider ou rejeter** les missions transmises par les directeurs et les employés directs

**Comment valider :** même procédure que le Directeur (voir ci-dessus).

---

### 7.4 Contrôle Technique

**Ce que vous pouvez faire :**
- **Valider ou rejeter** les missions après approbation du Directeur Central

**Comment valider :** même procédure que le Directeur (voir ci-dessus).

---

### 7.5 DGA

**Ce que vous pouvez faire :**
- **Valider ou rejeter** les missions après le Contrôle Technique

**Comment valider :** même procédure que le Directeur (voir ci-dessus).

---

### 7.6 DMG

Le DMG est responsable de l'affectation des véhicules et de la mise **En Vigueur** de la mission.

**Comment procéder :**

1. Ouvrez la mission depuis la liste (statut : *En attente DMG*)
2. Dans la section **Missionnaires**, vous pouvez si nécessaire :
   - **Ajouter** un employé supplémentaire (bouton +)
   - **Retirer** un employé (icône poubelle)
3. Faites défiler vers la section **Affectation des véhicules**
4. Saisissez le nombre de véhicules à affecter
5. Cliquez sur **Valider et mettre En Vigueur**

> La mission passe alors au statut **En Vigueur** et est transmise au CAD Édition.

---

### 7.7 CAD Édition

Le CAD Édition génère l'**Ordre de Mission (OM)** officiel.

**Comment procéder :**

1. Ouvrez la mission depuis la liste (statut : *En Vigueur*)
2. Cliquez sur le bouton **Générer l'Ordre de Mission**
3. L'OM est généré automatiquement (PDF avec QR code)
4. La mission est transmise au CAD Paiement

> **Note :** L'ordre de mission ne contient pas les montants des indemnités. Il sert uniquement à autoriser officiellement le départ en mission.

---

### 7.8 CAD Paiement

Le CAD Paiement confirme le **paiement de 70%** des indemnités journalières.

**Comment procéder :**

1. Ouvrez la mission depuis la liste (statut : *En attente CAD Paiement*)
2. Vérifiez les informations de la mission et les montants calculés
3. Cliquez sur **Confirmer le paiement 70%**
4. La mission est transmise au Contrôle Financier

---

### 7.9 Contrôle Financier

Le Contrôle Financier confirme le **solde de 30%** restant.

**Comment procéder :**

1. Ouvrez la mission depuis la liste (statut : *Contrôle Financier*)
2. Vérifiez les informations
3. Cliquez sur **Confirmer le paiement 30% et approuver**
4. La mission passe au statut **Approuvée** — le circuit est terminé

---

### 7.10 Administrateur

L'administrateur dispose d'un accès complet au système.

**Ce que vous pouvez faire en plus des autres profils :**

**Gestion des départements :**
- Créer, modifier et supprimer des départements

**Gestion des employés :**
- Créer, modifier et supprimer des fiches employés
- Assigner les employés à leurs départements

**Gestion des utilisateurs :**
- Créer des comptes utilisateurs
- Attribuer les rôles (directeur, DMG, CAD, etc.)
- Réinitialiser les mots de passe

**Gestion des missions :**
- Consulter toutes les missions du système
- **Supprimer** une mission (action irréversible — une confirmation est demandée)

**Pour accéder aux fonctions d'administration :**
Cliquez sur **Administration** dans le menu de gauche.

---

## 8. Règles importantes à connaître

### Règle 1 — Pas de mission dans le passé
Il est **impossible** de créer une mission dont la date de début est passée. Le calendrier n'autorise que la date du jour ou une date future.

### Règle 2 — Un missionnaire ne peut pas être dans deux missions simultanément
Si vous tentez d'affecter un employé à une mission alors qu'il est déjà affecté à une autre mission sur la même période, le système **bloquera l'action** et affichera un message d'erreur du type :

> *Conflit de mission détecté :*
> *Mohamed Ould Ahmed (Mission #12 — Inspection à Nouadhibou)*
>
> *Ce missionnaire est déjà affecté à une mission sur la même période.*

Pour résoudre ce conflit, vous pouvez :
- Modifier les dates de la mission
- Retirer cet employé de la liste et en choisir un autre

### Règle 3 — Validation obligatoire à chaque étape
Une mission ne peut pas "sauter" une étape. Chaque valideur doit agir dans l'ordre prévu par le circuit.

### Règle 4 — Un rejet arrête le circuit
Si une mission est rejetée à n'importe quelle étape, elle passe au statut **Rejeté** et le circuit s'arrête. L'initiateur doit créer une nouvelle demande si la mission est toujours nécessaire.

---

## 9. Barème des indemnités journalières

Les indemnités sont calculées automatiquement par le système selon la catégorie de l'employé et la durée de la mission.

| Catégorie | 1 à 5 jours | 6 à 10 jours | 11 à 15 jours |
|---|---|---|---|
| DG / DGA | 2 500 MRU/jour | 2 500 MRU/jour | 2 500 MRU/jour |
| Directeur | 3 000 MRU/jour | 1 500 MRU/jour | 900 MRU/jour |
| Chef de Département / Service | 2 000 MRU/jour | 1 000 MRU/jour | 600 MRU/jour |
| Autre Cadre | 1 500 MRU/jour | 750 MRU/jour | 450 MRU/jour |
| Agent | 1 000 MRU/jour | 500 MRU/jour | 300 MRU/jour |

**Répartition du paiement :**
- **70%** versés par le CAD avant le départ en mission
- **30%** versés par le Contrôle Financier à la fin du circuit

---

## 10. Questions fréquentes

**Je ne vois pas le bouton "Valider" sur une mission.**
→ Vérifiez que la mission est bien à votre étape de validation. Si elle attend un autre valideur, vous ne pouvez pas agir dessus.

**J'ai fait une erreur dans ma demande de mission, comment la corriger ?**
→ Une fois soumise, une mission ne peut plus être modifiée directement. Contactez votre administrateur pour la supprimer, puis recréez-la avec les informations correctes.

**Le système me dit que ma date est dans le passé, mais ce n'est pas le cas.**
→ Vérifiez que la date saisie est bien celle d'aujourd'hui ou d'une date à venir. Le système compare la date choisie avec la date du jour au moment de la soumission.

**Un employé que je veux ajouter est bloqué à cause d'une autre mission.**
→ Le système vous indique le numéro et le titre de la mission en conflit. Renseignez-vous auprès du responsable de cette mission pour connaître les dates exactes, puis ajustez les dates de votre demande ou choisissez un autre missionnaire.

**Je ne me souviens plus de mon mot de passe.**
→ Contactez votre administrateur système pour qu'il réinitialise votre mot de passe.

**Je vois "Non autorisé" ou la page reste blanche.**
→ Votre session a peut-être expiré. Retournez à la page de connexion et reconnectez-vous.

---

*Document rédigé pour les utilisateurs du Système de Gestion des Missions — SOMELEC.*
*Pour toute assistance technique, contactez votre administrateur système.*
