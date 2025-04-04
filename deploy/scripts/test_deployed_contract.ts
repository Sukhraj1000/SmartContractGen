import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script for analyzing deployed contract on Devnet
 * - Detects contract type automatically
 * - Tests functionality specific to each contract type
 * - Measures transaction performance
 * - Tests security aspects
 * - Generates a comprehensive report
 */

// Configuration
const PROGRAM_ID_PATH = '../target/deploy/deploy-keypair.json';
const TEST_ITERATIONS = 3;
const REPORT_PATH = './devnet_test_report.json';

// Initialize provider and program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

interface TestResults {
  programId: string;
  contractType: string;
  testTimestamp: number;
  performance: {
    averageExecutionTime: number;
    transactionsPerSecond: number;
  };
  security: {
    unauthorizedAccessBlocked: boolean;
    invalidInputRejected: boolean;
  };
  interoperability: {
    systemProgramInteraction: boolean;
  };
  testTransactions: Array<{
    operation: string;
    signature: string;
    success: boolean;
    executionTime: number;
  }>;
}

async function main() {
  console.log('====== Devnet Contract Test =======');
  
  try {
    // Read program keypair
    const programKeyPair = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(PROGRAM_ID_PATH, 'utf8')))
    );
    const programId = programKeyPair.publicKey;
    console.log(`Program ID: ${programId.toString()}`);
    
    // Initialize the program
    const idlFile = '../target/idl/deploy.json';
    if (!fs.existsSync(idlFile)) {
      console.error(`IDL file not found at ${idlFile}`);
      process.exit(1);
    }
    
    const idl = JSON.parse(fs.readFileSync(idlFile, 'utf8'));
    const program = new anchor.Program(idl, programId);
    
    // Detect contract type
    const contractType = detectContractType(idl);
    console.log(`Detected contract type: ${contractType}`);
    
    // Initialize results
    const results: TestResults = {
      programId: programId.toString(),
      contractType: contractType,
      testTimestamp: Date.now(),
      performance: {
        averageExecutionTime: 0,
        transactionsPerSecond: 0
      },
      security: {
        unauthorizedAccessBlocked: false,
        invalidInputRejected: false
      },
      interoperability: {
        systemProgramInteraction: false
      },
      testTransactions: []
    };
    
    // Test the contract based on its type
    console.log('\n🔍 Testing contract functionality...');
    
    switch (contractType) {
      case 'escrow':
        await testEscrowContract(program, provider, results);
        break;
      case 'token_vesting':
        await testVestingContract(program, provider, results);
        break;
      case 'crowdfunding':
        await testCrowdfundingContract(program, provider, results);
        break;
      default:
        console.log('Using generic contract test...');
        await testGenericContract(program, provider, results);
    }
    
    // Calculate performance metrics
    const validTransactions = results.testTransactions.filter(tx => tx.success && tx.executionTime > 0);
    if (validTransactions.length > 0) {
      const avgTime = validTransactions.reduce((sum, tx) => sum + tx.executionTime, 0) / validTransactions.length;
      results.performance.averageExecutionTime = avgTime;
      results.performance.transactionsPerSecond = 1000 / avgTime;
    }
    
    // Generate report
    console.log('\n📝 Generating report...');
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
    console.log(`Report saved to ${REPORT_PATH}`);
    
    // Summary
    console.log('\n====== Test Summary =======');
    console.log(`Contract type: ${results.contractType}`);
    console.log(`Average execution time: ${results.performance.averageExecutionTime.toFixed(2)}ms`);
    console.log(`Estimated TPS: ${results.performance.transactionsPerSecond.toFixed(2)}`);
    console.log(`Security tests passed: ${results.security.unauthorizedAccessBlocked && results.security.invalidInputRejected}`);
    console.log(`Interoperability tests passed: ${results.interoperability.systemProgramInteraction}`);
    console.log(`Total transactions: ${results.testTransactions.length}`);
    console.log(`Successful transactions: ${validTransactions.length}`);
    
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

function detectContractType(idl: any): string {
  // Examine instruction names to determine contract type
  const instructionNames = idl.instructions.map((ix: any) => ix.name);
  
  if (instructionNames.includes("initialize") && 
     (instructionNames.includes("execute") || instructionNames.includes("cancel"))) {
    return "escrow";
  } 
  
  if (instructionNames.includes("createVestingSchedule") || 
     instructionNames.includes("withdraw") || 
     instructionNames.includes("createVesting")) {
    return "token_vesting";
  } 
  
  if (instructionNames.includes("createCampaign") || 
     instructionNames.includes("contribute") || 
     instructionNames.includes("withdrawFunds")) {
    return "crowdfunding";
  }
  
  return "unknown";
}

async function recordTransaction(
  results: TestResults, 
  operation: string, 
  startTime: number,
  signature: string,
  success: boolean
) {
  const executionTime = performance.now() - startTime;
  results.testTransactions.push({
    operation,
    signature,
    success,
    executionTime
  });
  
  console.log(`${operation}: ${success ? '✅ Success' : '❌ Failed'}`);
  if (success) {
    console.log(`  Signature: ${signature}`);
    console.log(`  Execution time: ${executionTime.toFixed(2)}ms`);
  }
  
  return executionTime;
}

async function testEscrowContract(program: any, provider: anchor.AnchorProvider, results: TestResults) {
  console.log('Testing Escrow contract...');
  
  // Test initialization and basic functionality
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      console.log(`\nTest iteration ${i+1}/${TEST_ITERATIONS}`);
      
      // Create escrow
      const escrowSeed = new anchor.BN(Math.floor(Math.random() * 1000000));
      const amount = new anchor.BN(10000); // 0.00001 SOL
      const releaseCondition = new anchor.BN(100);
      
      // Calculate PDAs
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), escrowSeed.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      
      // Create taker account
      const taker = anchor.web3.Keypair.generate();
      
      // Initialize escrow
      const startInit = performance.now();
      let txInit = '';
      let initSuccess = false;
      
      try {
        txInit = await program.methods
          .initialize(escrowSeed, amount, releaseCondition)
          .accounts({
            initializer: provider.wallet.publicKey,
            taker: taker.publicKey,
            escrow: escrowPda,
            escrowAuthority: escrowPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();
          
        initSuccess = true;
      } catch (err) {
        console.error('Initialization failed:', err);
      }
      
      await recordTransaction(results, 'Initialize Escrow', startInit, txInit, initSuccess);
      
      // If initialization succeeded, try to cancel it
      if (initSuccess) {
        // Test cancel functionality
        const startCancel = performance.now();
        let txCancel = '';
        let cancelSuccess = false;
        
        try {
          txCancel = await program.methods
            .cancel()
            .accounts({
              initializer: provider.wallet.publicKey,
              escrow: escrowPda,
              escrowAuthority: escrowPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();
            
          cancelSuccess = true;
        } catch (err) {
          console.error('Cancel failed:', err);
        }
        
        await recordTransaction(results, 'Cancel Escrow', startCancel, txCancel, cancelSuccess);
      }
      
      // Test security: Initialize with invalid amount (0)
      if (i === TEST_ITERATIONS - 1) {
        const invalidAmount = new anchor.BN(0);
        const startInvalid = performance.now();
        let txInvalid = '';
        let invalidRejected = false;
        
        try {
          txInvalid = await program.methods
            .initialize(escrowSeed, invalidAmount, releaseCondition)
            .accounts({
              initializer: provider.wallet.publicKey,
              taker: taker.publicKey,
              escrow: escrowPda,
              escrowAuthority: escrowPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();
            
          console.log('❌ Security issue: Invalid amount was accepted');
          results.security.invalidInputRejected = false;
        } catch (err) {
          console.log('✅ Security test passed: Invalid amount was rejected');
          invalidRejected = true;
          results.security.invalidInputRejected = true;
        }
        
        await recordTransaction(results, 'Security Test: Invalid Amount', startInvalid, txInvalid, false);
        
        // Check System Program interaction
        if (initSuccess) {
          try {
            const txDetails = await provider.connection.getParsedTransaction(txInit, 'confirmed');
            if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
              const logs = txDetails.meta.logMessages.join('\n');
              if (logs.includes('system_instruction') || logs.includes('System Program')) {
                console.log('✅ System Program interaction verified');
                results.interoperability.systemProgramInteraction = true;
              }
            }
          } catch (err) {
            console.error('Error checking System Program interaction:', err);
          }
        }
      }
    } catch (error) {
      console.error('Test iteration failed:', error);
    }
  }
}

async function testVestingContract(program: any, provider: anchor.AnchorProvider, results: TestResults) {
  console.log('Testing Token Vesting contract...');
  
  // Test initialization and basic functionality
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      console.log(`\nTest iteration ${i+1}/${TEST_ITERATIONS}`);
      
      // Create vesting schedule
      const scheduleId = new anchor.BN(Math.floor(Math.random() * 1000000));
      const amount = new anchor.BN(100000); // 0.0001 SOL
      const releaseTime = new anchor.BN(Math.floor(Date.now() / 1000) + 60); // 1 minute from now
      
      // Create recipient
      const recipient = anchor.web3.Keypair.generate();
      
      // Calculate PDA
      const [vestingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vesting"), recipient.publicKey.toBuffer(), scheduleId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      
      // Initialize vesting schedule
      const startInit = performance.now();
      let txInit = '';
      let initSuccess = false;
      
      // Determine which method to use (contract may vary)
      const methods = program.methods;
      
      try {
        if (methods.createVestingSchedule) {
          txInit = await methods.createVestingSchedule(
            scheduleId,
            amount,
            releaseTime
          ).accounts({
            creator: provider.wallet.publicKey,
            recipient: recipient.publicKey,
            vestingAccount: vestingPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          }).rpc();
          initSuccess = true;
        } else if (methods.createVesting) {
          txInit = await methods.createVesting(
            scheduleId,
            amount,
            releaseTime
          ).accounts({
            admin: provider.wallet.publicKey,
            recipient: recipient.publicKey,
            vestingAccount: vestingPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          }).rpc();
          initSuccess = true;
        } else {
          console.log('Could not find compatible vesting creation method');
        }
      } catch (err) {
        console.error('Vesting initialization failed:', err);
      }
      
      await recordTransaction(results, 'Initialize Vesting', startInit, txInit, initSuccess);
      
      // Check System Program interaction on the last iteration
      if (i === TEST_ITERATIONS - 1 && initSuccess) {
        try {
          const txDetails = await provider.connection.getParsedTransaction(txInit, 'confirmed');
          if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
            const logs = txDetails.meta.logMessages.join('\n');
            if (logs.includes('system_instruction') || logs.includes('System Program')) {
              console.log('✅ System Program interaction verified');
              results.interoperability.systemProgramInteraction = true;
            }
          }
        } catch (err) {
          console.error('Error checking System Program interaction:', err);
        }
        
        // Test security: invalid input rejection
        const invalidAmount = new anchor.BN(0);
        const startInvalid = performance.now();
        let txInvalid = '';
        let invalidRejected = false;
        
        try {
          if (methods.createVestingSchedule) {
            txInvalid = await methods.createVestingSchedule(
              scheduleId,
              invalidAmount,
              releaseTime
            ).accounts({
              creator: provider.wallet.publicKey,
              recipient: recipient.publicKey,
              vestingAccount: vestingPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            }).rpc();
          } else if (methods.createVesting) {
            txInvalid = await methods.createVesting(
              scheduleId,
              invalidAmount,
              releaseTime
            ).accounts({
              admin: provider.wallet.publicKey,
              recipient: recipient.publicKey,
              vestingAccount: vestingPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            }).rpc();
          }
          
          console.log('❌ Security issue: Invalid amount was accepted');
          results.security.invalidInputRejected = false;
        } catch (err) {
          console.log('✅ Security test passed: Invalid amount was rejected');
          invalidRejected = true;
          results.security.invalidInputRejected = true;
        }
        
        await recordTransaction(results, 'Security Test: Invalid Amount', startInvalid, txInvalid, false);
      }
    } catch (error) {
      console.error('Test iteration failed:', error);
    }
  }
}

async function testCrowdfundingContract(program: any, provider: anchor.AnchorProvider, results: TestResults) {
  console.log('Testing Crowdfunding contract...');
  
  // Test initialization and basic functionality
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    try {
      console.log(`\nTest iteration ${i+1}/${TEST_ITERATIONS}`);
      
      // Create campaign
      const campaignId = new anchor.BN(Math.floor(Math.random() * 1000000));
      const target = new anchor.BN(1000000); // 0.001 SOL
      const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      
      // Calculate PDA
      const [campaignPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("campaign"), campaignId.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );
      
      // Initialize campaign
      const startInit = performance.now();
      let txInit = '';
      let initSuccess = false;
      
      // Determine which method to use (contract may vary)
      const methods = program.methods;
      
      try {
        if (methods.createCampaign) {
          txInit = await methods.createCampaign(
            campaignId,
            target,
            deadline,
            "Test Campaign"
          ).accounts({
            creator: provider.wallet.publicKey,
            campaign: campaignPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          }).rpc();
          initSuccess = true;
        } else if (methods.initialize) {
          txInit = await methods.initialize(
            campaignId,
            target,
            deadline,
            "Test Campaign"
          ).accounts({
            creator: provider.wallet.publicKey,
            campaign: campaignPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          }).rpc();
          initSuccess = true;
        } else {
          console.log('Could not find compatible campaign creation method');
        }
      } catch (err) {
        console.error('Campaign initialization failed:', err);
      }
      
      await recordTransaction(results, 'Initialize Campaign', startInit, txInit, initSuccess);
      
      // If initialization succeeded, try to contribute
      if (initSuccess && methods.contribute) {
        const contribution = new anchor.BN(10000); // 0.00001 SOL
        const startContribute = performance.now();
        let txContribute = '';
        let contributeSuccess = false;
        
        try {
          txContribute = await methods.contribute(
            campaignId,
            contribution
          ).accounts({
            contributor: provider.wallet.publicKey,
            campaign: campaignPda,
            systemProgram: anchor.web3.SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          }).rpc();
          
          contributeSuccess = true;
        } catch (err) {
          console.error('Contribution failed:', err);
        }
        
        await recordTransaction(results, 'Contribute to Campaign', startContribute, txContribute, contributeSuccess);
      }
      
      // Test security on the last iteration
      if (i === TEST_ITERATIONS - 1) {
        // Check System Program interaction
        if (initSuccess) {
          try {
            const txDetails = await provider.connection.getParsedTransaction(txInit, 'confirmed');
            if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
              const logs = txDetails.meta.logMessages.join('\n');
              if (logs.includes('system_instruction') || logs.includes('System Program')) {
                console.log('✅ System Program interaction verified');
                results.interoperability.systemProgramInteraction = true;
              }
            }
          } catch (err) {
            console.error('Error checking System Program interaction:', err);
          }
        }
        
        // Test security: invalid input rejection
        const invalidTarget = new anchor.BN(0);
        const startInvalid = performance.now();
        let txInvalid = '';
        let invalidRejected = false;
        
        try {
          if (methods.createCampaign) {
            txInvalid = await methods.createCampaign(
              campaignId,
              invalidTarget,
              deadline,
              "Test Campaign"
            ).accounts({
              creator: provider.wallet.publicKey,
              campaign: campaignPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            }).rpc();
          } else if (methods.initialize) {
            txInvalid = await methods.initialize(
              campaignId,
              invalidTarget,
              deadline,
              "Test Campaign"
            ).accounts({
              creator: provider.wallet.publicKey,
              campaign: campaignPda,
              systemProgram: anchor.web3.SystemProgram.programId,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            }).rpc();
          }
          
          console.log('❌ Security issue: Invalid target was accepted');
          results.security.invalidInputRejected = false;
        } catch (err) {
          console.log('✅ Security test passed: Invalid target was rejected');
          invalidRejected = true;
          results.security.invalidInputRejected = true;
        }
        
        await recordTransaction(results, 'Security Test: Invalid Target', startInvalid, txInvalid, false);
      }
    } catch (error) {
      console.error('Test iteration failed:', error);
    }
  }
}

async function testGenericContract(program: any, provider: anchor.AnchorProvider, results: TestResults) {
  console.log('Testing Generic contract functionality...');
  
  // Get the first instruction from the IDL
  const instructions = program.idl.instructions;
  if (!instructions || instructions.length === 0) {
    console.log('No instructions found in IDL');
    return;
  }
  
  // Find an instruction that might be an initialization
  const initInstruction = instructions.find((ix: any) => 
    ix.name.toLowerCase().includes('init') || 
    ix.name.toLowerCase() === 'create' || 
    ix.name.toLowerCase() === 'new'
  ) || instructions[0];
  
  console.log(`Testing instruction: ${initInstruction.name}`);
  
  // Try to call the instruction with default values
  try {
    // Note: This is a simplified approach and would need to be
    // customized based on the actual contract's requirements
    console.log('Generic testing not implemented - would need specific parameters');
    
    // Mark system program interaction as unknown
    results.interoperability.systemProgramInteraction = false;
    
    // Mark security tests as unknown
    results.security.invalidInputRejected = false;
    results.security.unauthorizedAccessBlocked = false;
  } catch (error) {
    console.error('Generic test failed:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 