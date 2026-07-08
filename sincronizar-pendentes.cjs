#!/usr/bin/env node

/**
 * sincronizar-pendentes.js
 * 
 * Sincroniza dados pendentes (bloqueados por RLS) do localStorage com Supabase
 * 
 * Uso:
 *   node sincronizar-pendentes.js "https://seu-projeto.supabase.co" "sua-chave"
 *   ou
 *   node sincronizar-pendentes.js --url "https://..." --key "..." --file "dados.json"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// =========================================================================
// CONFIGURAÇÃO
// =========================================================================

const args = process.argv.slice(2);
let config = {
  url: null,
  key: null,
  file: 'os_pendentes_backup.json'
};

// Parse argumentos
if (args[0] && args[0].startsWith('--')) {
  // Modo --flag value
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i].replace('--', '');
    config[flag] = args[i + 1];
  }
} else if (args.length >= 2) {
  // Modo posicional: url key
  config.url = args[0];
  config.key = args[1];
  if (args[2]) config.file = args[2];
}

// =========================================================================
// VALIDAÇÃO
// =========================================================================

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          Sincronizador de Ordens de Serviço               ║');
console.log('║         (Contorna erro RLS do Supabase)                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (!config.url || !config.key) {
  console.error('❌ Uso:');
  console.error('   node sincronizar-pendentes.js <url> <chave>');
  console.error('   node sincronizar-pendentes.js --url "https://..." --key "..." --file "dados.json"');
  console.error('\n💡 Exemplo:');
  console.error('   node sincronizar-pendentes.js "https://seu-projeto.supabase.co" "eyJhbGci..."');
  process.exit(1);
}

console.log('📋 Configuração:');
console.log(`   URL: ${config.url}`);
console.log(`   Chave: ${config.key.substring(0, 20)}...`);
console.log(`   Arquivo: ${config.file}\n`);

// =========================================================================
// LER ARQUIVO DE DADOS
// =========================================================================

console.log('📂 Procurando arquivo de dados...');

let dados = [];

if (fs.existsSync(config.file)) {
  console.log(`✅ Arquivo encontrado: ${config.file}`);
  try {
    const conteudo = fs.readFileSync(config.file, 'utf-8');
    dados = JSON.parse(conteudo);
    console.log(`✅ ${dados.length || 1} registro(s) carregado(s)\n`);
  } catch (e) {
    console.error(`❌ Erro ao ler arquivo: ${e.message}`);
    process.exit(1);
  }
} else {
  console.log(`❌ Arquivo não encontrado: ${config.file}`);
  console.log(`\n💡 Você pode exportar os dados pendentes clicando em "Exportar pendentes" na UI\n`);
  process.exit(1);
}

// =========================================================================
// FUNÇÕES DE API
// =========================================================================

function fazer_request(metodo, rota, dados_json = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.url);
    const opcoes = {
      hostname: url.hostname,
      path: `/rest/v1${rota}`,
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`,
        'apikey': config.key,
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(opcoes, (res) => {
      let resposta = '';

      res.on('data', (chunk) => {
        resposta += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = resposta ? JSON.parse(resposta) : null;
          resolve({ status: res.statusCode, dados: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, dados: resposta });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (dados_json) {
      req.write(JSON.stringify(dados_json));
    }

    req.end();
  });
}

async function buscar_loja_id(codigo_loja, nome_loja) {
  if (codigo_loja) {
    const { status, dados } = await fazer_request(
      'GET',
      `/lojas?codigo_loja=eq.${codigo_loja}&select=id`
    );
    if (dados && dados.length > 0) {
      return dados[0].id;
    }
  }

  if (nome_loja) {
    const { status, dados } = await fazer_request(
      'GET',
      `/lojas?nome=ilike.*${nome_loja.slice(0, 20)}*&select=id`
    );
    if (dados && dados.length > 0) {
      return dados[0].id;
    }
  }

  return null;
}

async function buscar_prestadora_id(nome_prestadora) {
  if (!nome_prestadora) return null;

  const { status, dados } = await fazer_request(
    'GET',
    `/prestadoras?nome=ilike.*${nome_prestadora.slice(0, 20)}*&select=id`
  );

  if (dados && dados.length > 0) {
    return dados[0].id;
  }

  return null;
}

async function buscar_tecnico_id(nome_tecnico) {
  if (!nome_tecnico) return null;

  const primeiro_nome = nome_tecnico.split(' ')[0];
  const { status, dados } = await fazer_request(
    'GET',
    `/tecnicos?nome=ilike.*${primeiro_nome}*&select=id`
  );

  if (dados && dados.length > 0) {
    return dados[0].id;
  }

  return null;
}

async function buscar_categoria_id(nome_categoria) {
  if (!nome_categoria) return null;

  const { status, dados } = await fazer_request(
    'GET',
    `/categorias?nome=ilike.*${nome_categoria.slice(0, 15)}*&select=id`
  );

  if (dados && dados.length > 0) {
    return dados[0].id;
  }

  return null;
}

async function sincronizar_os(os_dados, nome_arquivo) {
  console.log(`  📄 Processando: ${nome_arquivo}`);

  // Resolver IDs de FK
  const loja_id = await buscar_loja_id(os_dados.loja_codigo, os_dados.loja_nome);
  const prestadora_id = await buscar_prestadora_id(os_dados.prestadora_nome);
  const tecnico_id = await buscar_tecnico_id(os_dados.tecnico_nome);
  const categoria_id = await buscar_categoria_id(os_dados.categoria_nome);

  // Preparar dados
  const nova_os = {
    numero_os: os_dados.numero_os,
    loja_id: loja_id,
    prestadora_id: prestadora_id,
    tecnico_responsavel_id: tecnico_id,
    categoria_id: categoria_id,
    status: os_dados.status || 'aberta',
    tipo_servico: os_dados.tipo_servico,
    descricao_problema: os_dados.descricao_problema,
    data_abertura: os_dados.data_abertura,
    data_conclusao: os_dados.data_conclusao,
    custo_total: os_dados.custo_total,
    custo_mao_obra: os_dados.custo_mao_obra,
    custo_materiais: os_dados.custo_materiais,
    custo_pecas: os_dados.custo_pecas,
  };

  // Inserir OS
  const { status, dados: resultado } = await fazer_request(
    'POST',
    '/ordens_servico',
    nova_os
  );

  if (status !== 201) {
    console.log(`  ❌ Erro ao inserir OS #${os_dados.numero_os}: ${status}`);
    if (resultado && resultado.message) {
      console.log(`     ${resultado.message}`);
    }
    return { status: 'erro', numeroOS: os_dados.numero_os };
  }

  console.log(`  ✅ Salva: OS #${os_dados.numero_os}`);

  // Inserir materiais
  if (os_dados.materiais && os_dados.materiais.length > 0 && resultado[0]) {
    const materiais = os_dados.materiais.map(m => ({
      ordem_servico_id: resultado[0].id,
      descricao: m.descricao,
      quantidade: m.quantidade,
      valor_unitario: m.valor_unitario,
      valor_total: m.valor_total,
    }));

    await fazer_request('POST', '/materiais', materiais);
    console.log(`     📦 ${os_dados.materiais.length} material(is) adicionado(s)`);
  }

  return { status: 'sucesso', numeroOS: os_dados.numero_os };
}

// =========================================================================
// MAIN
// =========================================================================

async function main() {
  console.log('🔄 Iniciando sincronização...\n');

  let sucesso = 0;
  let erros = 0;

  // Se é um array direto (consolidado)
  if (Array.isArray(dados)) {
    for (const item of dados) {
      const os_data = item.dados || item;
      const nome_arquivo = item.arquivo || 'desconhecido';
      
      try {
        const resultado = await sincronizar_os(os_data, nome_arquivo);
        if (resultado.status === 'sucesso') {
          sucesso++;
        } else {
          erros++;
        }
      } catch (e) {
        console.log(`  ❌ Erro fatal: ${e.message}`);
        erros++;
      }
    }
  }

  // Resumo
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              RESUMO DE SINCRONIZAÇÃO                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Sucesso:  ${sucesso}`);
  console.log(`❌ Erros:    ${erros}`);
  console.log('');

  if (erros === 0 && sucesso > 0) {
    console.log('🎉 Sincronização concluída com sucesso!');
    console.log('   Dados agora estão no Supabase.\n');
  } else if (erros > 0) {
    console.log('⚠️  Houve erros durante a sincronização.');
    console.log('   Verifique as mensagens acima.\n');
  }
}

main().catch(e => {
  console.error('❌ Erro fatal:', e.message);
  process.exit(1);
});
