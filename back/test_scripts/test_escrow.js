const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { BN, Program, AnchorProvider } = require('@coral-xyz/anchor');
const fs = require('fs');

// Define the IDL directly
const IDL = {
  "version": "0.1.0",
  "name": "escrow",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "initializer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "initializerReceives",
          "type": "bool"
        }
      ]
    },
    {
      "name": "execute",
      "accounts": [
        {
          "name": "taker",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "initializer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "cancel",
      "accounts": [
        {
          "name": "initializer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "close",
      "accounts": [
        {
          "name": "initializer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "escrowAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "initializer",
            "type": "publicKey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "initializerReceives",
            "type": "bool"
          },
          {
            "name": "escrowBump",
            "type": "u8"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "EscrowNotActive",
      "msg": "Escrow is not active"
    },
    {
      "code": 6002,
      "name": "EscrowStillActive",
      "msg": "Escrow is still active"
    },
    {
      "code": 6003,
      "name": "CannotTakeOwnEscrow",
      "msg": "Cannot take your own escrow"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6005,
      "name": "InsufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6006,
      "name": "AmountOverflow",
      "msg": "Amount overflow"
    }
  ]
};

async function testEscrow() {
  try {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallet
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync('../../deploy/deploy-keypair.json', 'utf8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    // Set up provider
    const provider = new AnchorProvider(
      connection,
      { publicKey: wallet.publicKey, signTransaction: tx => tx.partialSign(wallet), signAllTransactions: txs => txs.map(tx => tx.partialSign(wallet)) },
      { commitment: 'confirmed' }
    );
    
    // Set up program
    const programId = new PublicKey('CxEvoPT1kHshLT8GoDVS1mKJqeYNGiNzN4puGei9tXKq');
    const program = new Program(IDL, programId, provider);
    
    console.log('Wallet address:', wallet.publicKey.toString());
    
    // Test initialize
    const amount = new BN(100000000); // 0.1 SOL
    
    // Derive PDA for escrow account
    const [escrowPDA, bump] = await PublicKey.findProgramAddress(
      [
        Buffer.from('escrow'),
        wallet.publicKey.toBuffer(),
        amount.toArrayLike(Buffer, 'le', 8)
      ],
      programId
    );
    
    console.log('Escrow PDA:', escrowPDA.toString());
    
    // Send transaction
    const tx = await program.methods
      .initialize(amount, true)
      .accounts({
        initializer: wallet.publicKey,
        escrow: escrowPDA,
        systemProgram: new PublicKey('11111111111111111111111111111111'),
      })
      .signers([wallet])
      .rpc();
    
    console.log('Transaction signature:', tx);
  } catch (error) {
    console.error('Error:', error);
  }
}

testEscrow(); 