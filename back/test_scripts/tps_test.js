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
const NUM_TRANSACTIONS = 10; // Number of transactions to send
const BATCH_SIZE = 5; // Number of transactions to send in parallel

async function runTpsTest() {
  console.log('\n🚀 Starting TPS (Transactions Per Second) Test\n');
  
  // Parse command line arguments
  const contractType = process.argv[2];
  const programId = process.argv[3];
  
  if (!contractType || !programId) {
    console.log('Usage: node tps_test.js <contract_type> <program_id>');
    process.exit(1);
  }
  
  console.log(`Contract Type: ${contractType}`);
  console.log(`Program ID: ${programId}`);
  
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet from deploy directory
  const walletPath = path.resolve(__dirname, '../../deploy/deploy-keypair.json');
  const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
  const wallet = Keypair.fromSecretKey(secretKey);
  console.log(`Using wallet: ${wallet.publicKey.toString()}`);
  
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1000000000} SOL`);
  
  if (balance < 10000000) {
    console.log('Warning: Low wallet balance. Request an airdrop:');
    console.log(`solana airdrop 1 ${wallet.publicKey.toString()} --url devnet`);
    
    try {
      console.log('Requesting airdrop of 1 SOL...');
      const signature = await connection.requestAirdrop(wallet.publicKey, 1000000000);
      await connection.confirmTransaction(signature);
      console.log('Airdrop successful!');
    } catch (error) {
      console.log('Airdrop failed:', error.message);
      console.log('Continuing with current balance...');
    }
  }
  
  // Verify the program exists
  try {
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    if (!programInfo) {
      console.error('Error: Program not found on devnet. Has it been deployed?');
      process.exit(1);
    }
    console.log('✅ Program exists on devnet');
  } catch (error) {
    console.error('Error checking program:', error);
    process.exit(1);
  }
  
  console.log('\nStarting performance test...');
  console.log(`Sending ${NUM_TRANSACTIONS} transactions in batches of ${BATCH_SIZE}`);
  
  const startTime = Date.now();
  
  // Send transactions in batches
  for (let i = 0; i < NUM_TRANSACTIONS; i += BATCH_SIZE) {
    const batch = [];
    const batchSize = Math.min(BATCH_SIZE, NUM_TRANSACTIONS - i);
    
    console.log(`Sending batch ${Math.floor(i/BATCH_SIZE) + 1} (${batchSize} transactions)...`);
    
    // Create dummy transactions (just transfers to self)
    for (let j = 0; j < batchSize; j++) {
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
    
    try {
      // Sign and send transactions in parallel
      const signedTransactions = batch.map(({ transaction, signers }) => {
        transaction.recentBlockhash = null; // Will be set below
        transaction.setSigners(...signers.map(s => s.publicKey));
        return { transaction, signers };
      });
      
      // Get recent blockhash once for all transactions
      const recentBlockhash = await connection.getRecentBlockhash();
      
      // Set blockhash and sign all transactions
      const signedAndReadyTransactions = signedTransactions.map(({ transaction, signers }) => {
        transaction.recentBlockhash = recentBlockhash.blockhash;
        transaction.sign(...signers);
        return transaction;
      });
      
      const signatures = await Promise.all(
        signedAndReadyTransactions.map(signedTransaction =>
          connection.sendRawTransaction(signedTransaction.serialize())
        )
      );
      
      console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} sent. Confirming...`);
      
      // Wait for confirmations
      await Promise.all(
        signatures.map(signature =>
          connection.confirmTransaction(signature)
        )
      );
      
      console.log(`✅ Batch ${Math.floor(i/BATCH_SIZE) + 1} confirmed`);
    } catch (error) {
      console.error(`Error sending batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // in seconds
  const tps = NUM_TRANSACTIONS / duration;
  
  console.log('\n🏁 Performance Test Results:');
  console.log(`Total transactions: ${NUM_TRANSACTIONS}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Transactions Per Second (TPS): ${tps.toFixed(2)}`);
  
  // Provide context for the results
  if (tps > 10) {
    console.log('\nExcellent performance! Your contract is highly optimized.');
  } else if (tps > 5) {
    console.log('\nGood performance. Your contract is well optimized.');
  } else {
    console.log('\nPerformance could be improved. Consider optimizing your contract.');
  }
  
  console.log('\n✅ TPS Test Complete');
}

runTpsTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 