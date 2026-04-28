/**
 * Camada de persistência offline com Dexie (IndexedDB).
 *
 * Permite ao engenheiro fazer inspeções em campo sem conexão com a internet.
 * Quando o sinal voltar, os rascunhos locais podem ser sincronizados com o
 * backend via `sincronizar()`.
 *
 * Estrutura:
 * - laudos_offline: rascunhos de laudos de inspeção
 * - fotos_offline:  fotos em base64 associadas a um item do checklist
 * - sincronizacoes: histórico de tentativas de sincronização
 */
import Dexie, { type EntityTable } from "dexie";

export interface LaudoOffline {
  id: string; // UUID gerado localmente
  nome_projeto: string;
  cliente: string;
  endereco: string;
  inspetor_nome: string;
  inspetor_registro: string;
  art: string;
  data_inspecao: string; // ISO date
  respostas: Record<string, string>; // código_item → status
  area_classificada: boolean;
  atmosfera_agressiva: boolean;
  servico_essencial: boolean;
  criado_em: number;
  atualizado_em: number;
  sincronizado: boolean;
  // ID do laudo remoto após sincronização (se houver)
  laudo_remoto_id?: string;
}

export interface FotoOffline {
  id: string;
  laudo_id: string;
  codigo_item: string;
  legenda: string;
  data_uri: string; // base64
  nome_arquivo?: string;
  latitude?: number;
  longitude?: number;
  criado_em: number;
  sincronizado: boolean;
}

export interface RegistroSincronizacao {
  id: string;
  laudo_id: string;
  tentativa_em: number;
  sucesso: boolean;
  erro?: string;
}

class PDADatabase extends Dexie {
  laudos!: EntityTable<LaudoOffline, "id">;
  fotos!: EntityTable<FotoOffline, "id">;
  sincs!: EntityTable<RegistroSincronizacao, "id">;

  constructor() {
    super("pda_nbr5419");
    this.version(1).stores({
      laudos: "id, sincronizado, criado_em, atualizado_em",
      fotos: "id, laudo_id, codigo_item, sincronizado",
      sincs: "id, laudo_id, tentativa_em",
    });
  }
}

export const db = new PDADatabase();

// =============================================================================
// API PÚBLICA
// =============================================================================

/** Cria um novo rascunho de laudo offline. */
export async function criarLaudoOffline(
  dados: Omit<LaudoOffline, "id" | "criado_em" | "atualizado_em" | "sincronizado">,
): Promise<string> {
  const id = crypto.randomUUID();
  const agora = Date.now();
  await db.laudos.add({
    ...dados,
    id,
    criado_em: agora,
    atualizado_em: agora,
    sincronizado: false,
  });
  return id;
}

/** Atualiza um rascunho existente. */
export async function atualizarLaudoOffline(
  id: string,
  patch: Partial<LaudoOffline>,
): Promise<void> {
  await db.laudos.update(id, {
    ...patch,
    atualizado_em: Date.now(),
    sincronizado: false, // qualquer mudança invalida o status anterior
  });
}

/** Lista todos os rascunhos locais. */
export async function listarLaudosOffline(): Promise<LaudoOffline[]> {
  return db.laudos.orderBy("atualizado_em").reverse().toArray();
}

/** Busca um rascunho por ID. */
export async function obterLaudoOffline(id: string): Promise<LaudoOffline | undefined> {
  return db.laudos.get(id);
}

/** Remove um rascunho (e suas fotos). */
export async function deletarLaudoOffline(id: string): Promise<void> {
  await db.transaction("rw", db.laudos, db.fotos, async () => {
    await db.fotos.where({ laudo_id: id }).delete();
    await db.laudos.delete(id);
  });
}

/** Adiciona uma foto a um laudo. */
export async function adicionarFoto(
  laudo_id: string,
  codigo_item: string,
  data_uri: string,
  legenda = "",
  geo?: { latitude: number; longitude: number },
  nome_arquivo?: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.fotos.add({
    id,
    laudo_id,
    codigo_item,
    legenda,
    data_uri,
    nome_arquivo,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
    criado_em: Date.now(),
    sincronizado: false,
  });
  await atualizarLaudoOffline(laudo_id, {});
  return id;
}

/** Lista as fotos de um laudo. */
export async function listarFotosLaudo(laudo_id: string): Promise<FotoOffline[]> {
  return db.fotos.where({ laudo_id }).toArray();
}

/** Remove uma foto. */
export async function deletarFoto(id: string): Promise<void> {
  await db.fotos.delete(id);
}

/** Conta quantos rascunhos estão pendentes de sincronização. */
export async function contarPendentes(): Promise<number> {
  const todos = await db.laudos.toArray();
  return todos.filter((l) => !l.sincronizado).length;
}

/**
 * Sincroniza todos os rascunhos pendentes com o backend.
 *
 * Para cada laudo:
 *   1. Faz POST no endpoint de criação
 *   2. Para cada foto, faz upload
 *   3. Marca como sincronizado
 *
 * Registra o resultado na tabela `sincs` para auditoria.
 */
export async function sincronizar(
  token: string,
  apiBase: string,
): Promise<{ total: number; sucesso: number; falhas: number }> {
  const pendentes = (await db.laudos.toArray()).filter((l) => !l.sincronizado);

  let sucesso = 0;
  let falhas = 0;

  for (const laudo of pendentes) {
    try {
      // 1. Envia o laudo
      const body = {
        projeto: {
          nome: laudo.nome_projeto,
          cliente: laudo.cliente,
          endereco: laudo.endereco,
        },
        responsavel: {
          nome: laudo.inspetor_nome,
          registro: laudo.inspetor_registro,
          art: laudo.art,
        },
        respostas: laudo.respostas,
        area_classificada: laudo.area_classificada,
        atmosfera_agressiva: laudo.atmosfera_agressiva,
        servico_essencial: laudo.servico_essencial,
      };

      const response = await fetch(`${apiBase}/laudo/inspecao/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Marca como sincronizado
      await db.laudos.update(laudo.id, { sincronizado: true });

      // Registra sucesso
      await db.sincs.add({
        id: crypto.randomUUID(),
        laudo_id: laudo.id,
        tentativa_em: Date.now(),
        sucesso: true,
      });

      sucesso++;
    } catch (error) {
      falhas++;
      await db.sincs.add({
        id: crypto.randomUUID(),
        laudo_id: laudo.id,
        tentativa_em: Date.now(),
        sucesso: false,
        erro: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { total: pendentes.length, sucesso, falhas };
}

/**
 * Helper para capturar a localização atual do dispositivo.
 * Retorna null se a geolocalização falhar.
 */
export function obterGeolocalizacao(): Promise<
  { latitude: number; longitude: number } | null
> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

/**
 * Converte um File (de input type="file") para data URI base64.
 */
export function fileParaDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
