# SOMELEC - Système de Gestion des Missions

## Overview

A full-stack internal mission management system for SOMELEC (Mauritanian electricity company). Handles the complete lifecycle of professional travel missions — from creation through multi-level validation to order generation and payment.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Session-based (express-session + SHA256 password hashing)

## Key Features

### Mission Lifecycle
1. **Creation**: Employee creates mission with title, needs expression, action plan, dates, destination, fuel/vehicle requests, and employee list
2. **Hierarchical Validation**:
   - Employee → Director → Central Director
   - Director → Central Director
3. **Administrative Circuit**:
   - Central Director → Technical Control → DGA → DMG (assigns vehicles) → CAD (generates order) → Financial Control → DRH
4. **OM Generation**: CAD Édition generates Order of Mission (no fee amounts, includes QR code) → advances to pending_cad_payment
5. **Payment**: CAD Paiement confirms 70% payment → Contrôle Financier confirms 30% → Mission approved

### User Roles
- `admin` — full system access, manage departments/users/employees
- `employee` — create missions for their department
- `director` — validate employee missions, create own missions
- `central_director` — validate director and employee missions
- `technical_control` — validate in admin circuit
- `dga` — validate after technical control
- `dmg` — assign vehicles, puts mission En Vigueur
- `cad_edition` — generate mission order (OM) when status=en_vigueur
- `cad_payment` — confirm 70% payment, advances to financial_control
- `financial_control` — confirm 30% payment, approves mission

### Fee Calculation (MRU/day)
| Category | ≤5 days | 6-10 days | 11-15 days |
|----------|---------|-----------|------------|
| DG/DGA | 2500 | 2500 | 2500 |
| Directeur | 3000 | 1500 | 900 |
| Chef Dépt/Service | 2000 | 1000 | 600 |
| Autre Cadre | 1500 | 750 | 450 |
| Agent | 1000 | 500 | 300 |

CAD pays 70%, DRH pays 30%.

## Default Accounts (Development)

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrateur |
| ahmed.dg | admin123 | Utilisateur Simple (Direction Générale) |
| fatima.drh | password123 | Directeur |
| directeur.central | password123 | Directeur Central |
| controle.tech | password123 | Contrôle Technique |
| dga.somelec | password123 | DGA |
| dmg.somelec | password123 | DMG |
| cad.edition | password123 | CAD Édition (génère l'OM) |
| cad.paiement | password123 | CAD Paiement (confirme paiement 70%) |
| ctrl.financier | password123 | Contrôle Financier (solde 30%) |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

```
artifacts/
  api-server/     # Express 5 REST API
    src/
      routes/     # auth, missions, employees, departments, users, dashboard
      lib/        # auth helpers, fee calculation, mission workflow state machine
      middlewares/ # session auth, admin guard
  missions-app/   # React + Vite frontend
    src/
      pages/      # login, dashboard, missions (list/new/detail/order), employees, admin
      components/ # layout, status-badge, UI components
      hooks/      # use-auth (AuthContext)
lib/
  api-spec/       # OpenAPI spec (single source of truth)
  api-client-react/ # Generated React Query hooks
  api-zod/        # Generated Zod validation schemas
  db/             # Drizzle ORM schema + client
    schema/       # departments, employees, users, missions tables
```

## Docker Deployment

The app is Docker-ready. Use PostgreSQL as the database and set these environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Secret for session signing
- `PORT` — API server port (default 8080)
- `NODE_ENV=production`
