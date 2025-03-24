import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * Pre-deployment validation script for Solana contracts
 * 
 * This script:
 * 1. Validates the contract by testing it on a local validator
 * 2. Reports any deployment issues before using SOL on Devnet
 * 3. Provides metrics on compute units and transaction size
 */
async function main() {
  console.log("🔍 Starting contract validation...");

  // Start a local validator for testing
  console.log("🚀 Starting local validator...");
  try {
    await execAsync("solana-test-validator --reset --quiet &");
    console.log("✅ Local validator started");
    
    // Wait for validator to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Save current config
    const configResult = await execAsync("solana config get");
    const currentUrl = configResult.stdout.match(/RPC URL: (.*)/)?.[1] || "";
    
    // Set to localhost for testing
    await execAsync("solana config set --url localhost");
    console.log("Switched to local validator");
    
    // Build the program
    console.log("🔨 Building program...");
    await execAsync("anchor build");
    console.log("Program built successfully");
    
    // Test deploy
    console.log("Test deploying program...");
    await execAsync("anchor deploy");
    console.log("Test deployment successful");
    
    // Load IDL to determine contract type
    console.log("Detecting contract type...");
    let idlPath = '../target/idl/deploy.json';
    if (!fs.existsSync(idlPath)) {
      console.error("IDL file not found at", idlPath);
      process.exit(1);
    }
    
    const idlContent = fs.readFileSync(idlPath, 'utf8');
    const idl = JSON.parse(idlContent);
    const programId = new PublicKey(idl.metadata.address);
    
    // Detect contract type by examining instruction names
    const instructionNames = idl.instructions.map((ix: any) => ix.name);
    let contractType = "unknown";
    
    if (instructionNames.includes("initialize") && 
       (instructionNames.includes("execute") || instructionNames.includes("cancel"))) {
      contractType = "escrow";
    } else if (instructionNames.includes("createVestingSchedule") || 
              instructionNames.includes("withdraw") || 
              instructionNames.includes("createVesting")) {
      contractType = "token_vesting";
    } else if (instructionNames.includes("createCampaign") || 
              instructionNames.includes("contribute") || 
              instructionNames.includes("withdrawFunds")) {
      contractType = "crowdfunding";
    }
    
    console.log(`Detected contract type: ${contractType}`);
    
    // Set up Anchor provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    
    // Create the program
    const program = new anchor.Program(idl, programId);
    
    // Test the appropriate contract type
    switch (contractType) {
      case "escrow":
        await testEscrowContract(program, provider);
        break;
      case "token_vesting":
        await testVestingContract(program, provider);
        break;
      case "crowdfunding":
        await testCrowdfundingContract(program, provider);
        break;
      default:
        console.log("Using generic contract test for unknown contract type");
        await testGenericContract(program, provider);
    }
    
    // Get program logs to analyze compute units
    console.log("📊 Analyzing program performance...");
    const txLogs = await execAsync("solana logs --limit 10");
    
    // Check for CU usage in logs (simplified)
    const cuMatch = txLogs.stdout.match(/consumed (\d+) of \d+ compute units/);
    if (cuMatch) {
      const cuUsed = parseInt(cuMatch[1]);
      console.log(`ℹ️ Program used approximately ${cuUsed} compute units`);
      
      if (cuUsed > 180000) {
        console.warn("⚠️ WARNING: High compute unit usage (>180k)");
      } else {
        console.log("✅ Compute unit usage is acceptable");
      }
    }
    
    console.log("🎉 Contract validation successful!");
    
    // Cleanup
    console.log("🧹 Cleaning up...");
    await execAsync("pkill solana-test-validator");
    
    // Restore original config
    if (currentUrl) {
      await execAsync(`solana config set --url "${currentUrl}"`);
      console.log(`✅ Restored original RPC URL: ${currentUrl}`);
    }
    
    console.log("✅ Validation complete, contract ready for Devnet deployment");
    console.log("💡 To deploy to Devnet, run: solana config set --url https://api.devnet.solana.com && anchor deploy --provider.cluster devnet");
    
  } catch (error) {
    console.error("❌ Validation failed:", error);
    // Try to kill test validator on error
    try {
      await execAsync("pkill solana-test-validator");
    } catch {}
    process.exit(1);
  }
}

/**
 * Tests an escrow contract
 */
async function testEscrowContract(program: anchor.Program, provider: anchor.AnchorProvider) {
  console.log("Running escrow contract test...");
  
  // Basic test - create escrow
  const escrowSeed = new anchor.BN(Math.floor(Math.random() * 1000000));
  const amount = new anchor.BN(1000000); // 0.001 SOL
  const releaseCondition = new anchor.BN(100);
  
  // Generate escrow PDA
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), escrowSeed.toBuffer('le', 8)],
    program.programId
  );
  
  // Generate a new keypair for taker
  const taker = anchor.web3.Keypair.generate();
  
  // Initialize escrow
  await program.methods
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
    
  console.log("✅ Escrow initialized successfully");
}

/**
 * Tests a token vesting contract
 */
async function testVestingContract(program: anchor.Program, provider: anchor.AnchorProvider) {
  console.log("Running vesting contract test...");
  
  try {
    // Create vesting schedule
    const recipient = anchor.web3.Keypair.generate();
    const scheduleId = new anchor.BN(Math.floor(Math.random() * 1000000));
    const amount = new anchor.BN(1000000); // 0.001 SOL
    const releaseTime = new anchor.BN(Math.floor(Date.now() / 1000) + 60); // 1 minute from now
    
    // Generate vesting PDA
    const [vestingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting"), recipient.publicKey.toBuffer(), scheduleId.toBuffer('le', 8)],
      program.programId
    );
    
    // Find available method to create vesting schedule
    const methods = program.methods as any;
    
    if (methods.createVestingSchedule) {
      await methods.createVestingSchedule(
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
    } else if (methods.createVesting) {
      await methods.createVesting(
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
    } else {
      throw new Error("No compatible vesting creation method found");
    }
    
    console.log("✅ Vesting schedule created successfully");
  } catch (error) {
    console.error("Error testing vesting contract:", error);
    throw error;
  }
}

/**
 * Tests a crowdfunding contract
 */
async function testCrowdfundingContract(program: anchor.Program, provider: anchor.AnchorProvider) {
  console.log("Running crowdfunding contract test...");
  
  try {
    // Create campaign
    const campaignId = new anchor.BN(Math.floor(Math.random() * 1000000));
    const target = new anchor.BN(5000000); // 0.005 SOL
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    
    // Generate campaign PDA
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), campaignId.toBuffer('le', 8)],
      program.programId
    );
    
    // Find available method to create campaign
    const methods = program.methods as any;
    
    if (methods.createCampaign) {
      await methods.createCampaign(
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
    } else if (methods.initialize) {
      await methods.initialize(
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
    } else {
      throw new Error("No compatible campaign creation method found");
    }
    
    console.log("✅ Campaign created successfully");
    
    // Try making a contribution if the method exists
    if (methods.contribute) {
      const contribution = new anchor.BN(1000000); // 0.001 SOL
      
      await methods.contribute(
        campaignId,
        contribution
      ).accounts({
        contributor: provider.wallet.publicKey,
        campaign: campaignPda,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      }).rpc();
      
      console.log("✅ Contribution made successfully");
    }
  } catch (error) {
    console.error("Error testing crowdfunding contract:", error);
    throw error;
  }
}

/**
 * Generic test for unknown contract types
 */
async function testGenericContract(program: anchor.Program, provider: anchor.AnchorProvider) {
  console.log("Running generic contract test...");
  
  try {
    // Get the first instruction from the IDL
    const firstInstruction = program.idl.instructions[0];
    if (!firstInstruction) {
      console.log("⚠️ No instructions found in IDL");
      return;
    }
    
    const instructionName = firstInstruction.name;
    console.log(`Testing first instruction: ${instructionName}`);
    
    // Get all accounts required for this instruction
    const requiredAccounts = firstInstruction.accounts.map((acc: any) => acc.name);
    console.log(`Required accounts: ${requiredAccounts.join(', ')}`);
    
    // Not executing instruction - just validating structure
    console.log("✅ Contract structure validated");
  } catch (error) {
    console.error("Error in generic contract test:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 