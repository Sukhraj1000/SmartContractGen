const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const fs = require('fs');

async function testEscrowDeploy() {
  try {
    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load our wallet
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync('../../deploy/deploy-keypair.json', 'utf8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    // Program ID
    const programId = new PublicKey('CxEvoPT1kHshLT8GoDVS1mKJqeYNGiNzN4puGei9tXKq');
    
    console.log('Wallet address:', wallet.publicKey.toString());
    console.log('Program ID:', programId.toString());
    
    // Get program account info to verify it exists
    const programInfo = await connection.getAccountInfo(programId);
    
    if (programInfo) {
      console.log('Program exists on devnet.');
      console.log('Program size:', programInfo.data.length, 'bytes');
      console.log('Program executable:', programInfo.executable);
      
      // We've successfully verified the program exists
      return true;
    } else {
      console.error('Program not found on devnet!');
      return false;
    }
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

testEscrowDeploy(); 