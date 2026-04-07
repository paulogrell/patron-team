/**
 * Utilitário para gerar hash SHA-256 de uma senha.
 *
 * Uso:
 *   node scripts/generate-hash.js <senha>
 *
 * Copie o hash gerado e substitua o valor de VITE_AUTH_PASSWORD_HASH no .env
 */
import { createHash } from 'crypto';

const senha = process.argv[2];

if (!senha) {
  console.error('❌ Uso: node scripts/generate-hash.js <senha>');
  console.error('   Exemplo: node scripts/generate-hash.js minhaSenhaSegura123');
  process.exit(1);
}

const hash = createHash('sha256').update(senha).digest('hex');

console.log('');
console.log('🔐 Hash SHA-256 gerado com sucesso!');
console.log('');
console.log(`   Senha:  ${senha}`);
console.log(`   Hash:   ${hash}`);
console.log('');
console.log('📋 Copie a linha abaixo e cole no seu arquivo .env:');
console.log(`   VITE_AUTH_PASSWORD_HASH=${hash}`);
console.log('');

