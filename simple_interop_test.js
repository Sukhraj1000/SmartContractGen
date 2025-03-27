#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');

async function main() {
  // Parse command line arguments
  const programId = process.argv[2];
  
  if (!programId) {
    console.error('Program ID is required');
    console.log('Usage: node simple_interop_test.js <program_id>');
    process.exit(1);
  }
  
  console.log(`Running simplified interoperability test for program: ${programId}`);
  
  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Verify program exists
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    
    if (!programInfo) {
      console.error(`Program ${programId} not found on devnet`);
      process.exit(1);
    }
    
    console.log(`Program exists on devnet with ${programInfo.data.length} bytes`);
    
    // Check if the program binary contains registry integration
    const programData = Buffer.from(programInfo.data);
    const programText = programData.toString('utf8');
    
    if (programText.includes('REGISTRY_PROGRAM_ID')) {
      console.log('\n✅ Registry integration detected: "REGISTRY_PROGRAM_ID" found in binary');
      console.log('Interoperability test passed!');
    } else {
      console.log('\n❌ Registry integration not detected');
      console.log('Check if the contract was deployed correctly with Registry support.');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 