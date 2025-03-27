const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

/**
 * Verify that a Solana program is deployed and executable
 * @param {string} programId - The program ID to verify
 * @returns {Promise<boolean>} - True if the program exists and is executable
 */
async function verifyDeployment(programId) {
  try {
    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load our wallet for context
    const walletPath = path.resolve(__dirname, '../../deploy/deploy-keypair.json');
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    // Parse program ID
    const programPubkey = new PublicKey(programId);
    
    console.log('Verification details:');
    console.log('  Network: Solana Devnet');
    console.log('  Wallet address:', wallet.publicKey.toString());
    console.log('  Program ID:', programId);
    
    // Get program account info to verify it exists
    console.log('\nChecking if program exists on devnet...');
    const programInfo = await connection.getAccountInfo(programPubkey);
    
    if (!programInfo) {
      console.error('❌ Program not found on devnet!');
      return false;
    }
    
    console.log('✅ Program exists on devnet');
    console.log('  Program size:', programInfo.data.length, 'bytes');
    console.log('  Executable:', programInfo.executable);
    
    if (!programInfo.executable) {
      console.error('❌ Program account is not executable!');
      return false;
    }
    
    // Check for Registry integration by looking at the program binary
    console.log('\nChecking for Registry Program ID integration...');
    
    // Convert Registry ID to bytes to search in the program binary
    const REGISTRY_ID = 'BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn';
    const registryIdBytes = Buffer.from(REGISTRY_ID);
    
    // Search for Registry ID in program binary
    const programData = Buffer.from(programInfo.data);
    const hasRegistryId = programData.includes(registryIdBytes);
    
    if (hasRegistryId) {
      console.log(`Registry Program ID (${REGISTRY_ID}) found in program binary`);
    } else {
      console.warn(`Registry Program ID not found in binary. This does not necessarily mean it's missing from the code.`);
    }
    
    console.log('\nDeployment verification completed successfully!');
    return true;
  } catch (error) {
    console.error('Error during verification:', error);
    return false;
  }
}

// If called directly from command line
if (require.main === module) {
  const programId = process.argv[2];
  
  if (!programId) {
    console.error('Please provide a program ID as an argument');
    console.error('Usage: node verify_deployment.js <PROGRAM_ID>');
    process.exit(1);
  }
  
  verifyDeployment(programId)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
} else {
  // Export for use as a module
  module.exports = { verifyDeployment };
} 