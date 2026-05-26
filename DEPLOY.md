# Guide de Déploiement — SOMELEC Gestion des Missions

## Prérequis sur votre serveur

- **Docker** ≥ 24 et **Docker Compose** v2 (`docker compose`)
- Git
- 1 Go de RAM minimum, 2 Go recommandé
- Ports ouverts : **80** (et **443** si vous utilisez HTTPS)

---

## 1. Cloner le dépôt

```bash
git clone https://github.com/VOTRE_ORG/VOTRE_REPO.git somelec-missions
cd somelec-missions
```

---

## 2. Créer le fichier de configuration

```bash
cp .env.example .env
```

Éditez `.env` et remplissez les valeurs :

```bash
nano .env
```

| Variable | Description | Exemple |
|---|---|---|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | `M0t_De_Pass3_F0rt!` |
| `SESSION_SECRET` | Secret de session (≥ 32 chars) | `$(openssl rand -hex 32)` |
| `HTTP_PORT` | Port HTTP exposé | `80` |

**Générer un SESSION_SECRET fort :**
```bash
openssl rand -hex 32
```

---

## 3. Construire et démarrer les conteneurs

```bash
# Première fois (construction des images, peut prendre 5-10 min)
docker compose up --build -d

# Suivre les logs au démarrage
docker compose logs -f
```

Les services démarrent dans cet ordre :
1. **postgres** — base de données
2. **api** — migration automatique de la base + serveur Express
3. **frontend** — nginx servant l'interface React

L'application est accessible sur `http://VOTRE_IP` (ou votre domaine).

---

## 4. Vérifier que tout fonctionne

```bash
# Statut des conteneurs
docker compose ps

# Tester l'API
curl http://localhost/api/healthz

# Voir les logs de l'API
docker compose logs api

# Voir les logs nginx
docker compose logs frontend
```

---

## 5. Compte administrateur par défaut

À la première connexion, utilisez :

| Champ | Valeur |
|---|---|
| Identifiant | `admin` |
| Mot de passe | `admin123` |

**Changez ce mot de passe immédiatement** après la première connexion via le menu utilisateur en bas à gauche de l'interface.

---

## 6. Mises à jour de l'application

Lorsque vous mettez à jour le code source :

```bash
# Récupérer les nouvelles versions
git pull

# Reconstruire et redémarrer (sans interruption de la base de données)
docker compose up --build -d

# Les migrations de base de données s'appliquent automatiquement au démarrage de l'API
```

---

## 7. Sauvegarde de la base de données

```bash
# Exporter la base de données
docker compose exec postgres pg_dump -U somelec somelec_missions > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurer une sauvegarde
docker compose exec -T postgres psql -U somelec somelec_missions < backup_YYYYMMDD_HHMMSS.sql
```

---

## 8. Configuration HTTPS (recommandé en production)

### Option A — Caddy (le plus simple, certificat Let's Encrypt automatique)

Installez Caddy sur le serveur, puis créez `/etc/caddy/Caddyfile` :

```caddyfile
votre-domaine.com {
    reverse_proxy localhost:80
}
```

Modifiez `.env` : `HTTP_PORT=8000` (pour éviter le conflit avec Caddy sur le port 80), puis :

```bash
docker compose up -d
sudo systemctl restart caddy
```

### Option B — Nginx + Certbot sur le serveur hôte

```bash
# Installer certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir un certificat
sudo certbot --nginx -d votre-domaine.com

# Configurer nginx pour proxifier vers le conteneur
```

Config nginx hôte (`/etc/nginx/sites-available/somelec`) :
```nginx
server {
    listen 443 ssl;
    server_name votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 9. Commandes utiles

```bash
# Arrêter l'application
docker compose down

# Arrêter + supprimer les données (ATTENTION : irréversible)
docker compose down -v

# Redémarrer uniquement l'API
docker compose restart api

# Accéder au shell PostgreSQL
docker compose exec postgres psql -U somelec somelec_missions

# Voir l'utilisation des ressources
docker stats
```

---

## Structure des conteneurs

```
Port 80 (public)
    └── frontend (nginx)
            ├── /* → fichiers statiques React
            └── /api/* → proxy → api:8080

api:8080 (réseau interne)
    └── Se connecte à postgres:5432

postgres:5432 (réseau interne)
    └── Volume persistant : postgres_data
```
