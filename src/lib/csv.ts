/**
 * Lê CSV separado por ";" (padrão do Excel em português) ou ",".
 * Suporta campos entre aspas com quebras de linha e aspas duplicadas.
 */
export function lerCsv(conteudo: string): string[][] {
  const textoLimpo = conteudo.replace(/^﻿/, '');
  const primeiraLinha = textoLimpo.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ',';

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;

  for (let i = 0; i < textoLimpo.length; i++) {
    const c = textoLimpo[i];
    if (aspas) {
      if (c === '"' && textoLimpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && textoLimpo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim() !== '')) linhas.push(linha);
  return linhas.map((l) => l.map((v) => v.trim()));
}
