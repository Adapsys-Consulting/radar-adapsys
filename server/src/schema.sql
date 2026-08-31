-- Esquema del Radar Adapsys IA.
-- Se aplica solo al arrancar (db.js -> initSchema). Todo es idempotente.

create extension if not exists "pgcrypto";

create table if not exists responses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Fuente de verdad. Los campos derivados de abajo son caché de consulta y
  -- siempre se pueden recomputar desde aquí con scoring.js.
  answers         jsonb not null,
  barrier         text,

  -- Resultado calculado en el servidor, nunca el que manda el cliente.
  level           int  not null,
  energy_key      text not null,
  bottleneck_key  text not null,
  total           int  not null,
  dim_totals      jsonb not null,

  -- Fase 2: solo se llena si la persona pide el reporte completo.
  contact_name    text,
  contact_email   text,
  contact_company text,
  contact_at      timestamptz,

  -- Metadata técnica. ip_hash = sha256(ip + IP_SALT); la IP cruda no se guarda.
  user_agent      text,
  referrer        text,
  ip_hash         text
);

create index if not exists responses_created_at_idx
  on responses (created_at desc);

create index if not exists responses_contact_idx
  on responses (contact_email)
  where contact_email is not null;
