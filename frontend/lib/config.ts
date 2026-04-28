// lib/config.ts — configurações centralizadas do cliente
// NEXT_PUBLIC_API_URL é injetado em build time pelo Next.js
// Usa || (não ??) para também tratar string vazia

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
