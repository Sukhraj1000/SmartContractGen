# Test Scripts for AI-Generated Solana Smart Contracts

This directory contains test scripts designed to assess the scalability, interoperability, and security of AI-generated Solana smart contracts.

## Prerequisites

- Node.js v14+
- npm
- Solana CLI tools
- Anchor Framework
- jq (for JSON processing)

## Installation

Install Node.js dependencies:

```bash
npm install @solana/web3.js @coral-xyz/anchor
```

## Wallet Configuration

All test scripts use the project's primary deployment wallet by default:

- **Wallet Path**: `../../deploy/deploy-keypair.json`
- **Public Key**: `4BmD1ryDpm5xZiLJtcSVuDWNxCAAxUdw9f7QheRpF4ML`

This wallet is configured as the default for all Solana operations in the project to maintain consistency and simplify SOL management.

## Test Scripts

### 1. Scalability Testing: TPS (Transactions Per Second)

The `tps_test.js` script measures the throughput and performance of your smart contract by sending batches of transactions and recording metrics.

```bash
# Usage
node tps_test.js <contract_type> <program_id>

# Example
node tps_test.js escrow BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn
```

Results are saved to `tps_results.json`.

### 2. Interoperability Testing

The `interoperability_test.js` script tests interoperability between AI-generated contracts and the Registry subcontract.

```bash
# Usage
node interoperability_test.js <contract_type> <main_program_id> [registry_program_id] [wallet_path]

# Example (using default Registry and wallet path)
node interoperability_test.js escrow CxEvoPT1kHshLT8GoDVS1mKJqeYNGiNzN4puGei9tXKq

# Example (with custom Registry program)
node interoperability_test.js crowdfunding HeZ7kRyMg91UNY5VvPHt1zBRYNW1sw9UA3BwhPvMimcP BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn
```

Results are saved to `interop_results.json`.

### 3. Security Analysis

The `security_analysis.sh` script performs static analysis and security checks on AI-generated contracts.

```bash
# Usage
./security_analysis.sh

# The script analyzes the contract at the path configured in the script
# and saves results to security_results.json
```

## Typical Testing Workflow

1. Generate a contract using the build loop
   ```bash
   cd ../back
   python -c "from ai.contract_generator import generate_smart_contract; generate_smart_contract('escrow', {'title': 'Escrow Contract', 'description': 'Simple escrow for SOL exchange', 'fields': {'amount': {'type': 'u64', 'description': 'Amount of SOL to be held in escrow'}, 'initializer_receives': {'type': 'bool', 'description': 'Whether initializer will receive the funds back'}, 'escrow_bump': {'type': 'u8', 'description': 'PDA bump for escrow account'}}})"
   ```

2. Build and deploy the contract to Devnet
   ```bash
   cd ../deploy
   anchor build
   anchor deploy --provider.cluster devnet
   ```

3. Run security analysis
   ```bash
   cd ../back/test_scripts
   ./security_analysis.sh
   ```

4. Run TPS test with the new Program ID
   ```bash
   node tps_test.js escrow <program_id_from_deployment>
   ```

5. Run interoperability test with the new Program ID
   ```bash
   node interoperability_test.js escrow <program_id_from_deployment>
   ```

## Directory Structure

- `idl/`: IDL files for contracts
- `tps_results.json`: Performance test results
- `interop_results.json`: Interoperability test results
- `security_results.json`: Security analysis results

## Registry Subcontract Deployment

For interoperability tests to work, the Registry contract must be deployed to devnet:

```bash
# Deploy Registry contract (already deployed at BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn)
cd registry_contract/registry
anchor deploy --provider.cluster devnet
```

The Registry contract has a fixed Program ID: `BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn`. This ID is referenced in:
- `back/templates/registry_interface.rs` template file
- `back/ai/contract_generator.py` with the REGISTRY_PROGRAM_ID constant
- `back/test_scripts/interoperability_test.js` REGISTRY_PROGRAM_ID constant

## Troubleshooting

If tests fail, check:
1. Wallet has sufficient SOL for transactions (2+ SOL recommended)
2. Contract has been deployed correctly with Registry integration
3. IDL files exist and match the deployed contracts
4. Contract handles the specific test operations properly 