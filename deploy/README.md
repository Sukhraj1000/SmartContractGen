# Solana Smart Contract Build & Deploy Guide

This directory contains the Solana smart contract implementation using the Anchor framework. Below are instructions on how to build, test, and deploy your contract.

## Prerequisites

- [Solana CLI Tools](https://docs.solanalabs.com/cli/install)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation)
- [Node.js and npm](https://nodejs.org/en/download)

## Project Structure

```
deploy/
├── programs/           # Smart contract source code
│   └── deploy/         # Main program directory
│       └── src/        # Contract source files
├── scripts/            # Build and deployment scripts
├── tests/              # Test files
├── target/             # Build output directory
├── templates/          # Contract templates
└── wallets/            # Wallet keypairs for deployment
```

## Quick Start

1. **Check Requirements**

   Ensure you have Solana and Anchor installed:
   ```bash
   solana --version
   anchor --version
   ```

2. **Setup Wallet**

   Create a deployment wallet or import an existing one:
   ```bash
   npm run check-wallet
   ```

3. **Build Contract**

   Build the smart contract:
   ```bash
   npm run build
   ```

   For a verifiable build (production):
   ```bash
   npm run build:production
   ```

4. **Deploy Contract**

   - Deploy to a local validator:
     ```bash
     npm run deploy:local
     ```

   - Deploy to Solana Devnet:
     ```bash
     npm run deploy:devnet
     ```

   - Deploy to Solana Mainnet (use with caution!):
     ```bash
     npm run deploy:mainnet
     ```

## Build & Deploy Scripts

### Build Script (`scripts/build.sh`)

The build script performs the following operations:
- Validates Solana and Anchor installations
- Cleans previous build artifacts
- Builds the contract with Anchor
- Detects the contract type
- Processes IDL files and copies them to the frontend

Options:
```bash
./scripts/build.sh [--verifiable | -v]
```

### Deploy Script (`scripts/deploy.sh`)

The deploy script handles the deployment process:
- Checks requirements and wallet setup
- Validates contract code with tests
- Deploys to the selected network (local, devnet, or mainnet)
- Runs post-deployment tests
- Provides a deployment summary

Options:
```bash
./scripts/deploy.sh [--local | --devnet | --mainnet]
```

## Contract Types

This project supports multiple contract types:
- **Escrow**: Simple escrow contracts for secure transactions
- **Token Vesting**: Time-locked token release schedules
- **Crowdfunding**: Campaign-based fundraising contracts

The system automatically detects the contract type based on the instructions defined in your code.

## Testing

Run tests on your contract:
```bash
npm test
```

Test a deployed contract:
```bash
npm run test-deployed
```

## Additional Commands

- Start a local validator:
  ```bash
  npm run start-local-validator
  ```

- Check wallet status:
  ```bash
  npm run check-wallet
  ```

- Validate contract:
  ```bash
  npm run validate
  ```

## Troubleshooting

1. **Insufficient SOL Balance**
   - For devnet: Use `solana airdrop 1 --url https://api.devnet.solana.com`
   - For mainnet: Transfer SOL to your deployment wallet

2. **Build Errors**
   - Check your contract for syntax errors
   - Ensure proper Anchor account structures
   - Validate imports and dependencies

3. **Deployment Failures**
   - Verify network connection
   - Check wallet permissions and balance
   - Review validator logs for errors

## Resources

- [Solana Documentation](https://docs.solanalabs.com)
- [Anchor Framework Docs](https://www.anchor-lang.com/docs/intro)
- [Solana Explorer](https://explorer.solana.com) 