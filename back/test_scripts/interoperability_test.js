#!/usr/bin/env node

// Registry Program ID - this is the ID of the deployed Registry program
const REGISTRY_PROGRAM_ID = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = {
  contractType: process.argv[2],
  programId: process.argv[3],
  registryProgramId: process.argv[4] || REGISTRY_PROGRAM_ID, // Registry program ID - should be fixed
  walletPath: process.argv[5] || '../../deploy/deploy-keypair.json', // Path to keypair
};

// Print usage if required args are missing
if (!args.contractType || !args.programId) {
  console.error('Required arguments missing');
  console.log('Usage: node interoperability_test.js <contract_type> <main_program_id> [registry_program_id] [wallet_path]');
  console.log('Example: node interoperability_test.js escrow Fy6hNJzz1y8odKtYW7RiDti5aQXPYtYEnqKK3pHfrt9R');
  process.exit(1);
}

/**
 * Test interoperability between a contract and the Registry
 */
async function testInteroperability(options) {
  const { contractType, programId, registryProgramId, walletPath } = options;
  
  console.log('\n🔗 Testing Interoperability with Registry');
  console.log('----------------------------------------');
  console.log(`Contract Type: ${contractType}`);
  console.log(`Program ID: ${programId}`);
  console.log(`Registry Program ID: ${registryProgramId}`);
  console.log(`Wallet Path: ${walletPath}`);
  
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  try {
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / 1000000000} SOL`);
  } catch (error) {
    console.error(`Error loading wallet from ${walletPath}:`, error);
    console.error('Please ensure the wallet file exists and has the correct format.');
    process.exit(1);
  }
  
  // Check main program exists
  console.log('\nStep 1: Verifying main program deployment');
  try {
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    if (!programInfo) {
      console.error(`❌ Program ${programId} not found on devnet. Has it been deployed?`);
      process.exit(1);
    }
    console.log(`✅ Program ${programId} exists on devnet`);
    
    // Binary search for Registry ID in program
    const programData = Buffer.from(programInfo.data);
    const registryIdBuffer = Buffer.from(registryProgramId.replace(/^0x/, ''), 'hex');
    
    // Convert PublicKey to string for searching in binary data
    const registryProgramIdString = new PublicKey(registryProgramId).toString();
    
    // Search for Registry Program ID in the binary data
    const hasRegistryProgramId = programData.includes(Buffer.from(registryProgramIdString));
    
    if (hasRegistryProgramId) {
      console.log(`✅ Registry Program ID (${registryProgramId}) found in program binary`);
    } else {
      console.warn(`⚠️ Registry Program ID not found in binary. This means the contract does not reference the Registry.`);
      console.warn('Interoperability test cannot continue without Registry integration.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking program:', error);
    process.exit(1);
  }
  
  // Check Registry program exists
  console.log('\nStep 2: Verifying Registry program deployment');
  try {
    const registryInfo = await connection.getAccountInfo(new PublicKey(registryProgramId));
    if (!registryInfo) {
      console.error(`❌ Registry program ${registryProgramId} not found on devnet.`);
      console.error('The Registry program must be deployed for interoperability to work.');
      process.exit(1);
    }
    console.log(`✅ Registry program ${registryProgramId} exists on devnet`);
  } catch (error) {
    console.error('Error checking Registry program:', error);
    process.exit(1);
  }
  
  // Test complete - no actual transactions needed since we verified the binary integration
  console.log('\n✅ Interoperability Test Passed');
  console.log('Your contract includes Registry integration, which will enable');
  console.log('cross-contract communication and transaction monitoring.');
  console.log('\nNote: Full interoperability testing would require executing actual');
  console.log('transactions and verifying Registry records, which is beyond the');
  console.log('scope of this basic test.');
  
  return true;
}

// Run the test with the provided arguments
testInteroperability(args).catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 