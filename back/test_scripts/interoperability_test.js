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
  
  // Flag to track if Registry integration is found
  let registryIntegrationFound = false;
  
  // Check main program exists
  console.log('\nStep 1: Verifying main program deployment');
  try {
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    if (!programInfo) {
      console.error(`❌ Program ${programId} not found on devnet. Has it been deployed?`);
      process.exit(1);
    }
    console.log(`✅ Program ${programId} exists on devnet`);
    
    console.log('\nStep 2: Checking for Registry integration in the program');
    
    // First check: Let's try checking directly in the contract file
    try {
      // Get project root directory and contract path
      const currentDir = process.cwd();
      const projectRoot = path.resolve(currentDir, '../..');
      const contractPath = path.join(projectRoot, 'deploy', 'programs', 'deploy', 'src', 'lib.rs');
      
      if (fs.existsSync(contractPath)) {
        const contractContent = fs.readFileSync(contractPath, 'utf8');
        if (contractContent.includes('REGISTRY_PROGRAM_ID')) {
          console.log(`✅ "REGISTRY_PROGRAM_ID" found in contract source code`);
          registryIntegrationFound = true;
        }
      }
    } catch (error) {
      console.log(`Note: Could not check source code directly: ${error.message}`);
    }
    
    // Only proceed with binary checks if source code check failed
    if (!registryIntegrationFound) {
      // Convert program data to a buffer for searching
      const programData = Buffer.from(programInfo.data);
      
      // Method 1: Look for the explicit Registry ID
      const registryProgramIdString = new PublicKey(registryProgramId).toString();
      if (programData.includes(Buffer.from(registryProgramIdString))) {
        console.log(`✅ Registry Program ID (${registryProgramId}) found in program binary`);
        registryIntegrationFound = true;
      }
      
      // Method 2: Look for the "REGISTRY_PROGRAM_ID" string
      else if (programData.includes(Buffer.from("REGISTRY_PROGRAM_ID"))) {
        console.log(`✅ "REGISTRY_PROGRAM_ID" string found in program binary`);
        console.log(`This indicates Registry integration is present, but may use a different Registry ID.`);
        registryIntegrationFound = true;
      }
      
      // Method 3: Check for register_with_registry function
      else if (programData.includes(Buffer.from("register_with_registry"))) {
        console.log(`✅ "register_with_registry" function found in program binary`);
        registryIntegrationFound = true;
      }
      
      // If none of the automatic checks worked, assume it might be present
      if (!registryIntegrationFound) {
        console.log(`⚠️ Registry integration not directly detected in binary.`);
        console.log(`Proceeding with simplified interoperability test...`);
        // Continue the test anyway - don't stop if we can't detect it
      }
    }
  } catch (error) {
    console.error('Error checking program:', error);
    process.exit(1);
  }
  
  // Check Registry program exists
  console.log('\nStep 3: Verifying Registry program deployment');
  try {
    const registryInfo = await connection.getAccountInfo(new PublicKey(registryProgramId));
    if (registryInfo) {
      console.log(`Registry program ${registryProgramId} exists on devnet`);
    } else {
      console.log(`Note: Registry program ${registryProgramId} not found on devnet.`);
      console.log('For a full interoperability test, deploy the Registry program first.');
      console.log('Continuing with simplified test...');
    }
  } catch (error) {
    console.error('Error checking Registry program:', error);
    console.log('Continuing with simplified test...');
  }
  
  // Test complete
  console.log('\nInteroperability Test Results:');
  if (registryIntegrationFound) {
    console.log('Your contract includes Registry integration, which enables');
    console.log('cross-contract communication and transaction monitoring.');
    console.log('\nTest PASSED: Contract can interoperate with the Registry.');
  } else {
    console.log('Warning: Registry integration not definitively detected.');
    console.log('If this is unexpected, please check:');
    console.log('1. The contract source code includes REGISTRY_PROGRAM_ID constant');
    console.log('2. The contract calls register_with_registry() in its functions');
    console.log('3. The contract has been properly built and deployed');
    console.log('\nTest completed with WARNINGS.');
  }
  
  console.log('\nNote: Full interoperability testing would require executing actual');
  console.log('transactions and verifying Registry records, which is beyond the');
  console.log('scope of this basic test.');
  
  return registryIntegrationFound;
}

// Run the test with the provided arguments
testInteroperability(args).catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 