const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const prompt = require('prompt-sync')({ sigint: true });

// Display a welcome message
console.log('\n=== Solana Wallet Import Tool ===\n');

// This is a utility script to create a wallet file for deployments
function createWallet(seedPhrase) {
  try {
    // Create wallets directory
    const walletsDir = path.join(__dirname, '..', 'wallets');
    if (!fs.existsSync(walletsDir)) {
      fs.mkdirSync(walletsDir, { recursive: true });
    }

    // Generate random keypair if no seed phrase
    let keypair;
    if (!seedPhrase) {
      keypair = Keypair.generate();
      console.log('Generated new random keypair');
    } else {
      // Handle seed phrase - this is where you'd use your recovery words
      // This is a simplified placeholder - normally you'd do BIP39 conversion
      console.log('Importing from seed phrase is not implemented in this script');
      console.log('Please enter your private key directly');
      return;
    }

    // Save the keypair to a file
    const walletPath = path.join(walletsDir, 'deploy-wallet.json');
    fs.writeFileSync(walletPath, `[${keypair.secretKey.toString()}]`);

    console.log(`\nWallet saved to: ${walletPath}`);
    console.log(`Public Key: ${keypair.publicKey.toString()}`);
    console.log('\nYou can now use this wallet for deployments by running:');
    console.log('solana config set --keypair ./wallets/deploy-wallet.json');

  } catch (error) {
    console.error('Error creating wallet:', error);
  }
}

// For direct private key import 
function importFromPrivateKey(privateKeyString) {
  try {
    // Parse the private key
    const privateKeyArray = Uint8Array.from(privateKeyString.split(',').map(Number));
    const keypair = Keypair.fromSecretKey(privateKeyArray);

    // Save the keypair to a file
    const walletsDir = path.join(__dirname, '..', 'wallets');
    if (!fs.existsSync(walletsDir)) {
      fs.mkdirSync(walletsDir, { recursive: true });
    }
    
    const walletPath = path.join(walletsDir, 'deploy-wallet.json');
    fs.writeFileSync(walletPath, `[${Array.from(keypair.secretKey)}]`);

    console.log(`\nWallet imported to: ${walletPath}`);
    console.log(`Public Key: ${keypair.publicKey.toString()}`);
    console.log('\nYou can now use this wallet for deployments by running:');
    console.log('solana config set --keypair ./wallets/deploy-wallet.json');
    
  } catch (error) {
    console.error('Error importing private key:', error);
  }
}

// Check for arguments
if (process.argv.length > 2) {
  const arg = process.argv[2];
  if (arg === '--new') {
    createWallet();
  } else if (arg === '--private-key') {
    const privateKey = prompt('Enter your private key (comma-separated numbers): ');
    importFromPrivateKey(privateKey);
  } else {
    console.log('Unknown argument:', arg);
    console.log('Usage: node import_wallet.js [--new|--private-key]');
  }
} else {
  console.log('No arguments provided. Creating new wallet.');
  createWallet();
} 