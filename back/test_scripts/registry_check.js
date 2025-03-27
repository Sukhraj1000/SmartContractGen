const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Program, AnchorProvider, BN } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

/**
 * Generic structure of an anchor instruction for testing
 * This allows us to test any contract type with minimal IDL knowledge
 */
const GENERIC_IDL = {
  "version": "0.1.0",
  "name": "generic_contract",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ]
};

/**
 * Check registry integration by attempting to capture transaction logs
 * @param {string} programId - The program ID to check
 * @param {string} contractType - The type of contract (escrow, crowdfunding, etc.)
 * @returns {Promise<boolean>} - True if registry integration is detected
 */
async function checkRegistryIntegration(programId, contractType = 'generic') {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallet
    const walletPath = path.resolve(__dirname, '../../deploy/deploy-keypair.json');
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    console.log(`Testing Registry integration for ${contractType} contract...`);
    console.log('Program ID:', programId);
    console.log('Using wallet:', wallet.publicKey.toString());
    
    // First method: Check program binary for Registry ID
    console.log('\nMethod 1: Checking program binary for Registry ID...');
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    
    if (!programInfo) {
      console.error('❌ Program not found on devnet!');
      return false;
    }
    
    const REGISTRY_ID = 'BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn';
    const programData = Buffer.from(programInfo.data);
    const hasRegistryId = programData.includes(Buffer.from(REGISTRY_ID));
    
    if (hasRegistryId) {
      console.log(`✅ Registry Program ID (${REGISTRY_ID}) found in program binary`);
    } else {
      console.warn(`⚠️ Registry Program ID not found in binary.`);
    }
    
    // Second method: Try to call the program and capture logs
    console.log('\nMethod 2: Attempting to call the program and capture logs...');
    
    // Create a transaction with a legitimate initialize instruction if IDL is available
    // If not, we'll use a simple dummy instruction to trigger program execution
    let txSignature;
    try {
      // Try to initialize the contract
      const dummyAddress = Keypair.generate().publicKey;
      const transaction = new Transaction();
      
      transaction.add({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: dummyAddress, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: new PublicKey(programId),
        data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]) // Generic 8-byte discriminator for initialize
      });
      
      txSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        { commitment: 'confirmed' }
      );
      
      console.log('Transaction signature:', txSignature);
    } catch (err) {
      // This is expected to fail in most cases without the right ID
      // We're just trying to get the program to execute and log
      console.log('Instruction execution failed (expected). Checking logs anyway.');
      if (err.signature) {
        txSignature = err.signature;
      }
    }
    
    // If we got a transaction signature, check the logs
    if (txSignature) {
      const txInfo = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (txInfo && txInfo.meta && txInfo.meta.logMessages) {
        console.log('\nTransaction logs:');
        
        const logs = txInfo.meta.logMessages;
        let registryLogFound = false;
        
        logs.forEach(log => {
          if (log.includes('Registry Transaction:')) {
            console.log('✅ Found Registry integration log:', log);
            registryLogFound = true;
          } else if (log.includes(REGISTRY_ID)) {
            console.log('✅ Found Registry ID in logs:', log);
            registryLogFound = true;
          }
        });
        
        if (registryLogFound) {
          console.log('\nRegistry integration test: PASSED');
          return true;
        } else {
          console.log('\nNo explicit Registry logs found.');
        }
      }
    }
    
    console.log('\nRegistry integration could not be fully confirmed.');
    console.log('This does not necessarily mean the contract lacks integration.');
    console.log('Manual review is recommended to ensure Registry integration is properly implemented.');
    
    return false;
  } catch (error) {
    console.error('Error during registry integration check:', error);
    return false;
  }
}

// If called directly from command line
if (require.main === module) {
  const programId = process.argv[2];
  const contractType = process.argv[3] || 'generic';
  
  if (!programId) {
    console.error('Please provide a program ID as an argument');
    console.error('Usage: node registry_check.js <PROGRAM_ID> [CONTRACT_TYPE]');
    process.exit(1);
  }
  
  checkRegistryIntegration(programId, contractType)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
} else {
  // Export for use as a module
  module.exports = { checkRegistryIntegration };
} 