/**
 * Seed script — crée les comptes et départements par défaut.
 * Utilise pg directement (pas de TypeScript, pas de drizzle-kit).
 * Idempotent : n'insère que si les données n'existent pas.
 */

import crypto from "crypto";
import pg from "pg";

const { Client } = pg;

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "somelec_salt").digest("hex");
}

const ADMIN_PASS   = hashPassword("Somelec@2024");
const DEFAULT_PASS = hashPassword("Somelec@2024");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// ── Départements ───────────────────────────────────────────────────
const departments = [
  { name: "Direction Générale",          code: "DG",   type: "central_direction" },
  { name: "Direction des Ressources Humaines", code: "DRH",  type: "direction" },
  { name: "Direction Générale Adjointe", code: "DGA",  type: "central_direction" },
  { name: "Direction du Matériel et du Garage", code: "DMG", type: "direction" },
  { name: "Comptabilité et Administration", code: "CAD", type: "direction" },
  { name: "Contrôle Technique",          code: "CT",   type: "direction" },
  { name: "Contrôle Financier",          code: "CF",   type: "direction" },
];

for (const dept of departments) {
  await client.query(
    `INSERT INTO departments (name, code, type)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO NOTHING`,
    [dept.name, dept.code, dept.type]
  );
}

console.log("  [seed] Départements OK");

// ── Utilisateurs ───────────────────────────────────────────────────
const users = [
  { username: "admin",              passwordHash: ADMIN_PASS,   fullName: "Administrateur Système",    role: "admin",             status: "active" },
  { username: "ahmed.dg",           passwordHash: DEFAULT_PASS, fullName: "Ahmed - Direction Générale", role: "employee",          status: "active" },
  { username: "fatima.drh",         passwordHash: DEFAULT_PASS, fullName: "Fatima - DRH",              role: "director",          status: "active" },
  { username: "directeur.central",  passwordHash: DEFAULT_PASS, fullName: "Directeur Central",         role: "central_director",  status: "active" },
  { username: "controle.tech",      passwordHash: DEFAULT_PASS, fullName: "Contrôle Technique",        role: "technical_control", status: "active" },
  { username: "dga.somelec",        passwordHash: DEFAULT_PASS, fullName: "DGA Somelec",               role: "dga",               status: "active" },
  { username: "dmg.somelec",        passwordHash: DEFAULT_PASS, fullName: "DMG Somelec",               role: "dmg",               status: "active" },
  { username: "cad.edition",        passwordHash: DEFAULT_PASS, fullName: "CAD Édition",               role: "cad_edition",       status: "active" },
  { username: "cad.paiement",       passwordHash: DEFAULT_PASS, fullName: "CAD Paiement",              role: "cad_payment",       status: "active" },
  { username: "ctrl.financier",     passwordHash: DEFAULT_PASS, fullName: "Contrôle Financier",        role: "financial_control", status: "active" },
];

for (const u of users) {
  await client.query(
    `INSERT INTO users (username, password_hash, full_name, role, status, must_change_password)
     VALUES ($1, $2, $3, $4, $5, false)
     ON CONFLICT (username) DO NOTHING`,
    [u.username, u.passwordHash, u.fullName, u.role, u.status]
  );
}

console.log("  [seed] Utilisateurs OK");

await client.end();
