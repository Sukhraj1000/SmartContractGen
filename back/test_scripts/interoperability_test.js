#!/usr/bin/env node

/**
 * Enhanced Interoperability Test for Solana Smart Contracts
 * 
 * This test verifies that a smart contract properly integrates
 * with the registry service primarily through static analysis.
 * Optional dynamic network verification can be enabled with a flag.
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction 
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const BN = require('bn.js');

// Registry Program ID (fixed)
const REGISTRY_PROGRAM_ID = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";

// Show usage information
function showUsage() {
  console.log('\nUsage: node interoperability_test.js <contract_type> <program_id> [source_file] [--skip-network] [registry_program_id] [wallet_path]');
  console.log('\nArguments:');
  console.log('  <contract_type>     Type of contract (e.g., crowdfunding, escrow)');
  console.log('  <program_id>        Program ID of the contract to test');
  console.log('  [source_file]       Optional: Path to the contract source file for static analysis (default: ../deploy/programs/deploy/src/lib.rs)');
  console.log('  [--skip-network]    Optional: Skip dynamic network tests (faster, requires only source code)');
  console.log('  [registry_program_id] Optional: Registry program ID (default: BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn)');
  console.log('  [wallet_path]       Optional: Path to wallet keypair (default: ../../deploy/deploy-keypair.json)');
  console.log('\nExamples:');
  console.log('  node interoperability_test.js crowdfunding 3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J');
  console.log('  node interoperability_test.js crowdfunding 3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J --skip-network');
}

// Parse command line arguments
function parseArgs() {
  // Display usage if requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  if (process.argv.length < 4) {
    console.log('Insufficient arguments provided.');
    showUsage();
    process.exit(1);
  }
  
  const defaultSourcePath = path.resolve(__dirname, '../../deploy/programs/deploy/src/lib.rs');
  const skipNetwork = process.argv.includes('--skip-network');
  
  // Extract registry program ID and wallet path, considering the possibility of --skip-network flag
  let registryProgramId = REGISTRY_PROGRAM_ID;
  let walletPath = '../../deploy/deploy-keypair.json';
  let sourceFile = defaultSourcePath;
  
  // Check for source file (3rd parameter if it's not --skip-network)
  if (process.argv.length > 4 && process.argv[4] !== '--skip-network') {
    sourceFile = process.argv[4];
  }
  
  // Check for registry program ID and wallet path
  for (let i = 4; i < process.argv.length; i++) {
    if (process.argv[i] !== '--skip-network') {
      if (process.argv[i].startsWith('--')) continue;
      
      if (process.argv[i].length === 43 || process.argv[i].length === 44) {
        // Likely a Solana public key (registry ID)
        registryProgramId = process.argv[i];
      } else if (process.argv[i].endsWith('.json')) {
        // Likely a wallet path
        walletPath = process.argv[i];
      } else if (!sourceFile || sourceFile === defaultSourcePath) {
        // If source file not yet set, use this argument
        sourceFile = process.argv[i];
      }
    }
  }
  
  return {
    contractType: process.argv[2],
    programId: process.argv[3],
    sourceFile: sourceFile,
    skipNetwork: skipNetwork,
    registryProgramId: registryProgramId,
    walletPath: walletPath,
  };
}

// Get the arguments
const args = parseArgs();

// Define the TX types we'll use
const TX_TYPES = {
  CROWDFUNDING: "crowdfunding",
  DONATION: "donation",
  ESCROW: "escrow",
  PAYMENT: "payment"
};

/**
 * Execute a simple SOL transfer transaction
 */
async function executeSimpleTransaction(connection, wallet) {
  try {
    // Create a simple SOL transfer to self
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 10000, // 0.00001 SOL
      })
    );
    
    console.log('Sending simple SOL transfer transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Error in simple transaction:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Calculate a PDA for the registry transaction
 */
async function findRegistryTransactionPDA(payer, txType, amount) {
  // Convert amount to LE bytes
  const amountLeBytes = new BN(amount).toBuffer('le', 8);
  
  return await PublicKey.findProgramAddressSync(
    [
      Buffer.from("transaction_v1"),
      payer.toBuffer(),
      Buffer.from(txType),
      amountLeBytes
    ],
    new PublicKey(args.registryProgramId)
  );
}

/**
 * Inspect registry accounts for program ID references
 */
async function inspectRegistryAccounts(connection, programId) {
  try {
    const accounts = await connection.getProgramAccounts(new PublicKey(args.registryProgramId));
    if (accounts.length === 0) {
      return [];
    }
    
    // Filter for account data that contains our program ID
    const programIdBuffer = new PublicKey(programId).toBuffer();
    
    let matchingAccounts = [];
    
    // Inspect accounts (skip the 8-byte discriminator)
    for (const account of accounts) {
      const data = account.account.data;
      
      if (data.length < 40) {
        continue;
      }
      
      // Look for the program ID bytes in the account data
      for (let offset = 8; offset < data.length - 32; offset++) {
        const slice = data.slice(offset, offset + 32);
        try {
          const pubkey = new PublicKey(slice);
          if (pubkey.equals(new PublicKey(programId))) {
            matchingAccounts.push({
              pubkey: account.pubkey.toString(),
              data: data,
            });
            break;
          }
        } catch (err) {
          // Not a valid pubkey, continue
        }
      }
    }
    
    return matchingAccounts;
  } catch (error) {
    console.error('Error inspecting registry accounts:', error);
    return [];
  }
}

// ----- ENHANCED STATIC ANALYSIS FUNCTIONS -----

/**
 * Analyze structural elements (imports, declarations, etc.)
 */
function performStructuralAnalysis(sourceCode) {
  console.log("Checking structural elements...");
  
  const results = {
    hasRegistryProgramId: false,
    hasRegistryImports: false,
    hasCpiImports: false,
    hasRegistryTypes: false,
    hasCpiContexts: false
  };
  
  // Check for Registry Program ID (direct appearance)
  results.hasRegistryProgramId = sourceCode.includes(REGISTRY_PROGRAM_ID);
  
  // Check for imports related to CPI
  results.hasCpiImports = /use\s+anchor_lang::solana_program::\{.*program::invoke.*\}/.test(sourceCode) || 
                          /use\s+anchor_lang::solana_program::program::invoke/.test(sourceCode) ||
                          /cpi::/.test(sourceCode);
  
  // Check for registry-related imports or modules
  results.hasRegistryImports = /use\s+.*registry/.test(sourceCode) || 
                               /mod\s+registry/.test(sourceCode);
  
  // Check for registry-related type definitions
  results.hasRegistryTypes = /struct\s+Registry/.test(sourceCode) || 
                             /struct\s+.*Transaction/.test(sourceCode) &&
                             sourceCode.includes("registry");
  
  // Check for CPI context structures
  results.hasCpiContexts = /CpiContext/.test(sourceCode) || 
                           /invoke\s*\(/.test(sourceCode);
  
  return results;
}

/**
 * Analyze semantic patterns (function calls, variable usage, etc.)
 */
function performSemanticAnalysis(sourceCode) {
  console.log("Checking semantic patterns...");
  
  const results = {
    hasRegistryFunctionCalls: false,
    hasRegistryAccountArgs: false,
    hasTransactionRegistration: false,
    hasRegistryAccountCreation: false,
    hasPdaDerivation: false
  };
  
  // Check for registry function calls
  results.hasRegistryFunctionCalls = /register_transaction/.test(sourceCode) ||
                                    /registry::.*\(/.test(sourceCode);
  
  // Check for registry account arguments
  results.hasRegistryAccountArgs = /registry:.*Account/.test(sourceCode) ||
                                   /registry_program:.*Account/.test(sourceCode);
  
  // Check for transaction registration patterns
  results.hasTransactionRegistration = /register.*transaction/.test(sourceCode) ||
                                       /log.*transaction/.test(sourceCode) &&
                                       sourceCode.includes("registry");
  
  // Check for registry account creation
  results.hasRegistryAccountCreation = /init,.*registry/.test(sourceCode) ||
                                       /init.*seeds\s*=/.test(sourceCode) && 
                                       sourceCode.includes("transaction");
  
  // Check for PDA derivation with transaction-like seeds
  results.hasPdaDerivation = /find_program_address/.test(sourceCode) &&
                            /\[\s*b"transaction/.test(sourceCode);
  
  return results;
}

/**
 * Analyze data flow patterns (how registry data moves through the code)
 */
function performDataFlowAnalysis(sourceCode) {
  console.log("Checking data flow patterns...");
  
  const results = {
    hasRegistryDataFlows: false,
    hasCpiDataPassing: false,
    hasTransactionTypeHandling: false,
    hasRegistryErrorHandling: false,
    hasSystematicLogging: false
  };
  
  // Check for registry data flows
  results.hasRegistryDataFlows = sourceCode.includes("registry") &&
                                 /\.\w+\s*=/.test(sourceCode);
  
  // Check for CPI data passing
  results.hasCpiDataPassing = /invoke\s*\(.*,.*\[.*\]/.test(sourceCode) ||
                              /CpiContext::new\s*\(.*,.*\{.*\}/.test(sourceCode);
  
  // Check for transaction type handling
  results.hasTransactionTypeHandling = /"crowdfunding"|"donation"|"escrow"|"payment"/.test(sourceCode) &&
                                       sourceCode.includes("transaction");
  
  // Check for registry-specific error handling
  results.hasRegistryErrorHandling = /catch|match|Result|Ok|Err|try/.test(sourceCode) &&
                                     sourceCode.includes("registry");
  
  // Check for systematic logging that might indicate registry interactions
  results.hasSystematicLogging = /msg!\(.*transaction/.test(sourceCode) ||
                                /emit!\(.*transaction/.test(sourceCode);
  
  return results;
}

/**
 * Combine results from different analysis phases with weighted scoring
 */
function combineStaticResults(structural, semantic, dataFlow) {
  const combined = {
    // Core interoperability requirements (highest weight)
    registryProgramId: {
      result: structural.hasRegistryProgramId,
      weight: 5,
      critical: true,
      description: "Registry Program ID is present in the contract"
    },
    cpiMechanisms: {
      result: structural.hasCpiImports || structural.hasCpiContexts,
      weight: 5,
      critical: true,
      description: "Cross-Program Invocation mechanisms are implemented"
    },
    registryIntegration: {
      result: semantic.hasRegistryFunctionCalls || semantic.hasTransactionRegistration,
      weight: 5,
      critical: true,
      description: "Registry integration is implemented with function calls"
    },
    
    // Supporting interoperability features (medium weight)
    registryAccountHandling: {
      result: semantic.hasRegistryAccountArgs || semantic.hasRegistryAccountCreation,
      weight: 3,
      critical: false,
      description: "Registry accounts are properly handled"
    },
    transactionTyping: {
      result: dataFlow.hasTransactionTypeHandling || semantic.hasPdaDerivation,
      weight: 3,
      critical: false,
      description: "Transaction types are properly handled"
    },
    registryDataFlow: {
      result: dataFlow.hasRegistryDataFlows || dataFlow.hasCpiDataPassing,
      weight: 3,
      critical: false,
      description: "Registry data flows are implemented"
    },
    
    // Supplementary features (lowest weight)
    registryErrorHandling: {
      result: dataFlow.hasRegistryErrorHandling,
      weight: 1,
      critical: false,
      description: "Registry-specific error handling exists"
    },
    registryTypes: {
      result: structural.hasRegistryTypes,
      weight: 1,
      critical: false,
      description: "Registry-related type definitions exist"
    },
    systematicLogging: {
      result: dataFlow.hasSystematicLogging,
      weight: 1,
      critical: false,
      description: "Systematic transaction logging is implemented"
    }
  };
  
  // Calculate weighted score
  let totalWeight = 0;
  let weightedScore = 0;
  let criticalsPassed = 0;
  let criticalsTotal = 0;
  
  for (const [key, item] of Object.entries(combined)) {
    totalWeight += item.weight;
    if (item.result) {
      weightedScore += item.weight;
    }
    
    if (item.critical) {
      criticalsTotal++;
      if (item.result) {
        criticalsPassed++;
      }
    }
  }
  
  const percentageScore = Math.round((weightedScore / totalWeight) * 100);
  
  // Add final scores to the results
  combined.weightedScore = weightedScore;
  combined.totalWeight = totalWeight;
  combined.percentageScore = percentageScore;
  combined.criticalsPassed = criticalsPassed;
  combined.criticalsTotal = criticalsTotal;
  combined.allCriticalsPassed = (criticalsPassed === criticalsTotal);
  combined.interoperable = (criticalsPassed === criticalsTotal && percentageScore >= 70);
  
  return combined;
}

/**
 * Generate a detailed report of the static analysis
 */
function generateStaticReport(results) {
  console.log(`\nStatic Analysis Results:`);
  console.log(`-------------------------`);
  
  // Critical requirements section
  console.log("\nCritical Requirements:");
  let criticalResults = Object.entries(results).filter(([key, value]) => 
    typeof value === 'object' && value.critical === true
  );
  
  criticalResults.forEach(([key, value]) => {
    console.log(`${value.result ? '[✓]' : '[✗]'} ${value.description} [Weight: ${value.weight}]`);
  });
  
  // Supporting features section
  console.log("\nSupporting Features:");
  let supportingResults = Object.entries(results).filter(([key, value]) => 
    typeof value === 'object' && value.critical === false && value.weight >= 2
  );
  
  supportingResults.forEach(([key, value]) => {
    console.log(`${value.result ? '[✓]' : '[✗]'} ${value.description} [Weight: ${value.weight}]`);
  });
  
  // Supplementary features section
  console.log("\nSupplementary Features:");
  let supplementaryResults = Object.entries(results).filter(([key, value]) => 
    typeof value === 'object' && value.critical === false && value.weight < 2
  );
  
  supplementaryResults.forEach(([key, value]) => {
    console.log(`${value.result ? '[✓]' : '[✗]'} ${value.description} [Weight: ${value.weight}]`);
  });
  
  // Overall score and assessment
  console.log(`\nOverall Static Assessment:`);
  console.log(`-------------------------`);
  console.log(`Weighted Score: ${results.weightedScore}/${results.totalWeight} (${results.percentageScore}%)`);
  console.log(`Critical Requirements Met: ${results.criticalsPassed}/${results.criticalsTotal}`);
  
  if (results.interoperable) {
    console.log(`\n[✓] INTEROPERABLE: This contract has proper registry integration`);
  } else if (results.allCriticalsPassed) {
    console.log(`\n[!] PARTIALLY INTEROPERABLE: All critical requirements met, but score below threshold`);
  } else if (results.percentageScore >= 50) {
    console.log(`\n[!] POTENTIALLY INTEROPERABLE: Some critical requirements missing, but has interoperability features`);
  } else {
    console.log(`\n[✗] NOT INTEROPERABLE: Missing critical requirements for registry integration`);
  }
  
  // Detailed breakdown for missing requirements
  console.log(`\nMissing Requirements:`);
  let missingRequirements = Object.entries(results).filter(([key, value]) => 
    typeof value === 'object' && !value.result
  );
  
  if (missingRequirements.length === 0) {
    console.log(`  None - All requirements satisfied`);
  } else {
    missingRequirements.forEach(([key, value]) => {
      console.log(`  - ${value.description} ${value.critical ? '[CRITICAL]' : ''}`);
    });
  }
}

/**
 * Perform a comprehensive static analysis on source code
 */
function performStaticAnalysis(sourceFilePath) {
  console.log(`\nRunning security analysis for deployed contract...`);
  console.log(`Contract ID: ${args.programId}`);
  
  try {
    // Read the source file
    const sourceCode = fs.readFileSync(sourceFilePath, 'utf8');
    
    // Perform the various types of analysis
    const structural = performStructuralAnalysis(sourceCode);
    const semantic = performSemanticAnalysis(sourceCode);
    const dataFlow = performDataFlowAnalysis(sourceCode);
    
    // Combine results with weighted scoring
    const results = combineStaticResults(structural, semantic, dataFlow);
    
    // Generate report
    generateStaticReport(results);
    
    return results;
  } catch (error) {
    console.error(`Error in static analysis: ${error.message}`);
    return {
      interoperable: false,
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function testInteroperability() {
  console.log('\nInteroperability Test');
  console.log('--------------------');
  console.log(`Contract Type: ${args.contractType}`);
  console.log(`Program ID: ${args.programId}`);
  console.log(`Source File: ${args.sourceFile}`);
  console.log(`Registry Program ID: ${args.registryProgramId}`);
  
  if (args.skipNetwork) {
    console.log(`Network Tests: Skipped (--skip-network flag provided)`);
  } else {
    console.log(`Wallet Path: ${args.walletPath}`);
  }
  
  // Part 1: Static Source Analysis (Always run)
  console.log('\nStatic Code Analysis');
  console.log('-------------------');
  const staticResults = performStaticAnalysis(args.sourceFile);
  
  // Recommendations based on static analysis
  if (!staticResults.interoperable) {
    console.log('\nRecommendations to Achieve Interoperability:');
    
    let missingRequirements = Object.entries(staticResults).filter(([key, value]) => 
      typeof value === 'object' && !value.result && value.critical
    );
    
    missingRequirements.forEach(([key, value], index) => {
      console.log(`  ${index + 1}. Add ${value.description.toLowerCase()}`);
    });
  }
  
  // Skip dynamic tests if requested
  if (args.skipNetwork) {
    console.log('\nNetwork tests skipped.');
    console.log('\nFinal Determination:');
    if (staticResults.interoperable) {
      console.log(`[✓] POTENTIALLY INTEROPERABLE: Contract has all required features (network verification skipped)`);
    } else {
      console.log(`[✗] NOT INTEROPERABLE: Contract lacks required features for registry integration`);
    }
    
    console.log('\nTest completed successfully.');
    return;
  }
  
  // Part 2: Dynamic Tests (Only if --skip-network is not provided)
  console.log('\nDynamic Network Tests');
  console.log('-------------------');
  
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  let wallet;
  try {
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(args.walletPath, 'utf8')));
    wallet = Keypair.fromSecretKey(secretKey);
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 10000000) {
      console.log('Warning: Low wallet balance. Requesting airdrop...');
      try {
        const signature = await connection.requestAirdrop(wallet.publicKey, 100000000);
        await connection.confirmTransaction(signature);
        console.log('Airdrop successful!');
      } catch (error) {
        console.log('Airdrop failed:', error.message);
        console.log('Continuing with current balance...');
      }
    }
  } catch (error) {
    console.error(`Error loading wallet from ${args.walletPath}:`, error);
    console.error('Please ensure the wallet file exists and has the correct format.');
    process.exit(1);
  }
  
  // 1. Verify program deployments
  console.log('\n1. Verifying program deployments...');
  
  try {
    // Check program
    const programInfo = await connection.getAccountInfo(new PublicKey(args.programId));
    if (programInfo) {
      console.log(`[✓] Program ${args.programId} (${args.contractType}) exists on devnet`);
    } else {
      console.error(`[✗] Program ${args.programId} not found on devnet.`);
      process.exit(1);
    }
    
    // Check registry
    const registryInfo = await connection.getAccountInfo(new PublicKey(args.registryProgramId));
    if (registryInfo) {
      console.log(`[✓] Registry program ${args.registryProgramId} exists on devnet`);
    } else {
      console.error(`[✗] Registry program ${args.registryProgramId} not found on devnet.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking program deployment:', error);
    process.exit(1);
  }
  
  // 2. Verify network connectivity
  console.log('\n2. Verifying network connectivity...');
  const simpleResult = await executeSimpleTransaction(connection, wallet);
  
  if (simpleResult.success) {
    console.log(`[✓] Network connectivity confirmed with signature: ${simpleResult.signature}`);
  } else {
    console.error('[✗] Network connectivity test failed. Exiting.');
    process.exit(1);
  }
  
  // 3. Check for existing accounts and interoperability evidence
  console.log('\n3. Checking for existing accounts and interoperability...');
  
  // Program accounts
  let programAccounts = [];
  let registryAccounts = [];
  let matchingAccounts = [];
  
  try {
    programAccounts = await connection.getProgramAccounts(new PublicKey(args.programId));
    console.log(`Found ${programAccounts.length} accounts for the ${args.contractType} program.`);
    
    if (programAccounts.length > 0) {
      console.log(`Example account: ${programAccounts[0].pubkey.toString()}`);
    }
    
    // Registry accounts and interop check
    registryAccounts = await connection.getProgramAccounts(new PublicKey(args.registryProgramId));
    console.log(`Found ${registryAccounts.length} accounts for the registry program.`);
    
    matchingAccounts = await inspectRegistryAccounts(connection, args.programId);
    
    if (matchingAccounts.length > 0) {
      console.log(`\n[✓] INTEROPERABILITY DETECTED!`);
      console.log(`Found ${matchingAccounts.length} registry accounts that reference the ${args.contractType} program!`);
      console.log('Registry accounts: ' + matchingAccounts.map(a => a.pubkey).join(', '));
    } else {
      console.log('\nNo direct interoperability detected in the examined accounts.');
      console.log('This does not mean interoperability is not possible, just that no past transactions were found.');
    }
  } catch (error) {
    console.error(`Error checking accounts: ${error.message}`);
  }
  
  // 4. Final determination combining static and dynamic results
  console.log('\nFinal Determination:');
  
  // Dynamic analysis results
  const hasMatchingAccounts = matchingAccounts && matchingAccounts.length > 0;
  
  if (staticResults.interoperable && hasMatchingAccounts) {
    console.log(`[✓] FULLY INTEROPERABLE: Contract has all required features and shows evidence of registry interaction`);
  } else if (staticResults.interoperable) {
    console.log(`[!] POTENTIALLY INTEROPERABLE: Contract has all required features but no evidence of actual registry interaction`);
  } else if (hasMatchingAccounts) {
    console.log(`[!] UNEXPECTED INTEROPERABILITY: Contract shows registry interaction despite missing features in the code`);
    console.log(`    This may indicate the analysis missed something or the contract was modified after deployment`);
  } else {
    console.log(`[✗] NOT INTEROPERABLE: Contract lacks required features and shows no evidence of registry interaction`);
  }
  
  console.log('\nTest completed successfully.');
}

// Run the test
testInteroperability().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});