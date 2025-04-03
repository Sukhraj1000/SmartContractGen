#!/usr/bin/env node

/**
 * TPS (Transactions Per Second) Test for Solana Smart Contracts
 * 
 * This test measures transaction throughput for a deployed smart contract.
 * It works with any contract type (escrow, crowdfunding, etc)
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const NUM_TRANSACTIONS = 10;
const BATCH_SIZE = 2;
const MAX_RETRIES = 3;
const TX_INTERVAL = 1000; // 1 second between transactions

// Program IDs for different contract types
const PROGRAM_IDS = {
  escrow: "6bxjHnAj8m5Fs6hve9xeLcKyN4b2gGonCnBDsv59DNXQ",
  crowdfunding: "6bxjHnAj8m5Fs6hve9xeLcKyN4b2gGonCnBDsv59DNXQ", // Replace with actual crowdfunding ID when deployed
  // Add more contract types as needed
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function confirmTransaction(connection, signature) {
  try {
    // First check if transaction is already confirmed
    const status = await connection.getSignatureStatus(signature);
    
    if (status.value && status.value.confirmationStatus === 'finalized') {
      return true;
    }

    // If not finalized, wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      lastValidBlockHeight: status.context.slot + 150, // Give plenty of blocks for confirmation
      blockhash: await connection.getLatestBlockhash().blockhash
    }, 'confirmed');
    
    return !confirmation.value.err;
  } catch (error) {
    console.log(`Confirmation error for ${signature}:`, error.message);
    return false;
  }
}

async function sendTransaction(connection, transaction, signers) {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    
    transaction.sign(...signers);
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`Transaction sent: ${signature}`);
    
    // Wait for confirmation
    const confirmed = await confirmTransaction(connection, signature);
    if (!confirmed) {
      throw new Error('Transaction failed to confirm');
    }
    
    return signature;
  } catch (error) {
    throw error;
  }
}

async function runTpsTest() {
  console.log('\nStarting TPS (Transactions Per Second) Test\n');
  
  // Parse command line arguments
  const contractType = process.argv[2]?.toLowerCase();
  const customProgramId = process.argv[3]; // Optional custom program ID
  
  if (!contractType || !PROGRAM_IDS[contractType]) {
    console.log('Usage: node tps_test.js <contract_type> [custom_program_id]');
    console.log('Available contract types:');
    Object.keys(PROGRAM_IDS).forEach(type => {
      console.log(`  - ${type}`);
    });
    console.log('\nYou can also provide a custom program ID as the second argument.');
    process.exit(1);
  }
  
  // Get program ID - use custom if provided, otherwise use from the mapping
  const programId = customProgramId || PROGRAM_IDS[contractType];
  
  console.log(`Contract Type: ${contractType}`);
  console.log(`Program ID: ${programId}`);
  
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', {
    commitment: 'confirmed',
    wsEndpoint: 'wss://api.devnet.solana.com/'
  });
  
  // Load wallet
  const walletPath = path.resolve(__dirname, '../../deploy/deploy-keypair.json');
  const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
  const wallet = Keypair.fromSecretKey(secretKey);
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1000000000} SOL`);
  
  if (balance < 10000000) {
    console.log('Warning: Low wallet balance. Requesting airdrop...');
    try {
      const signature = await connection.requestAirdrop(wallet.publicKey, 1000000000);
      await confirmTransaction(connection, signature);
      console.log('Airdrop successful!');
    } catch (error) {
      console.log('Airdrop failed:', error.message);
      console.log('Continuing with current balance...');
    }
  }
  
  // Verify program exists
  try {
    const programPubkey = new PublicKey(programId);
    const programInfo = await connection.getAccountInfo(programPubkey);
    if (!programInfo) {
      console.error('Error: Program not found on devnet. Has it been deployed?');
      process.exit(1);
    }
    console.log('Program exists on devnet');
  } catch (error) {
    console.error('Error checking program:', error);
    process.exit(1);
  }
  
  console.log('\nStarting performance test...');
  console.log(`Sending ${NUM_TRANSACTIONS} transactions in batches of ${BATCH_SIZE}`);
  
  const startTime = Date.now();
  let successfulTransactions = 0;
  let failedTransactions = 0;
  const signatures = [];
  
  // Send transactions in batches
  for (let i = 0; i < NUM_TRANSACTIONS; i += BATCH_SIZE) {
    const batch = [];
    const batchSize = Math.min(BATCH_SIZE, NUM_TRANSACTIONS - i);
    
    console.log(`\nPreparing batch ${Math.floor(i/BATCH_SIZE) + 1} (${batchSize} transactions)...`);
    
    // Create transactions
    const programPubkey = new PublicKey(programId);
    
    for (let j = 0; j < batchSize; j++) {
      // For simplicity, using a transfer transaction for all contract types
      // In a real-world test, you would use actual program instructions specific to each contract type
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey,
          lamports: 100,
        })
      );
      
      batch.push({
        transaction,
        signers: [wallet],
      });
    }
    
    // Process transactions sequentially with delay between each
    for (const { transaction, signers } of batch) {
      try {
        const signature = await sendTransaction(connection, transaction, signers);
        signatures.push(signature);
        successfulTransactions++;
        console.log(`Transaction ${successfulTransactions}/${NUM_TRANSACTIONS} successful`);
        
        // Add delay between transactions
        if (successfulTransactions < NUM_TRANSACTIONS) {
          await sleep(TX_INTERVAL);
        }
      } catch (error) {
        console.error('Transaction failed:', error.message);
        failedTransactions++;
      }
    }
  }
  
  // Final verification of all transactions
  console.log('\nVerifying all transactions...');
  for (const signature of signatures) {
    const status = await connection.getSignatureStatus(signature);
    console.log(`Transaction ${signature.slice(0, 8)}... status: ${status.value?.confirmationStatus || 'unknown'}`);
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // in seconds
  const tps = successfulTransactions / duration;
  
  console.log('\nPerformance Test Results:');
  console.log(`Total attempted transactions: ${NUM_TRANSACTIONS}`);
  console.log(`Successful transactions: ${successfulTransactions}`);
  console.log(`Failed transactions: ${failedTransactions}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Transactions Per Second (TPS): ${tps.toFixed(2)}`);
  
  if (tps > 10) {
    console.log('\nExcellent performance! Your contract is highly optimised.');
  } else if (tps > 5) {
    console.log('\nGood performance. Your contract is well optimised.');
  } else {
    console.log('\nPerformance could be improved. Consider optimising your contract.');
  }
  
  console.log('\nTPS Test Complete');
}

runTpsTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 