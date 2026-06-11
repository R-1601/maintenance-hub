/**
 * arquivoHash.ts
 * Gera hash SHA-256 do conteúdo de um arquivo usando Web Crypto API.
 * Usado para detectar arquivos idênticos mesmo com nomes diferentes.
 */

/**
 * Calcula o SHA-256 de um arquivo e retorna a string hexadecimal.
 * @param file — Arquivo (File) ou ArrayBuffer
 */
export async function computeFileHash(file: File | ArrayBuffer): Promise<string> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compara dois arquivos verificando se o conteúdo é idêntico via SHA-256.
 */
export async function arquivosSaoIguais(a: File, b: File): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [ha, hb] = await Promise.all([computeFileHash(a), computeFileHash(b)]);
  return ha === hb;
}
