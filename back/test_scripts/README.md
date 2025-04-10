# Test Scripts for Solana Smart Contracts

Test scripts for assessing scalability, interoperability, and security of Solana smart contracts.

## Prerequisites

- Node.js v14+
- npm
- Solana CLI tools
- Anchor Framework
- jq (for JSON processing)

## Installation

```bash
npm install @solana/web3.js @coral-xyz/anchor chalk
```

## Wallet Configuration

Default wallet: `../../deploy/deploy-keypair.json`
Public Key: `4BmD1ryDpm5xZiLJtcSVuDWNxCAAxUdw9f7QheRpF4ML`

## Test Scripts

### 1. TPS Test

Measures transaction throughput and performance.

```bash
# Usage
node tps_test.js <contract_type> <program_id>

# Example
node tps_test.js escrow BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn
```


### 2. Interoperability Test

Tests integration with Registry subcontract.

```bash
# Usage
node interoperability_test.js <contract_type> <main_program_id> [registry_program_id] [wallet_path]

# Example
node interoperability_test.js escrow CxEvoPT1kHshLT8GoDVS1mKJqeYNGiNzN4puGei9tXKq
```

Results saved to `interop_results.json`.

### 3. Security Analysis

Performs static analysis and security checks.

```bash
# Usage
node security_analysis.js [program_id] [options]

# Examples
node security_analysis.js
node security_analysis.js 3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J
node security_analysis.js 3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J 
```

Reports generated in `security_reports` directory.


## Security Analysis Features

1. **Static Analysis**: Clippy checks
2. **Code Formatting**: Rustfmt validation
3. **Vulnerability Detection**:
   - Math operations
   - Authority validation
   - Registry integration
   - Error handling
   - PDA bump handling
   - Re-entrancy protection
   - Integer overflow protection
4. **Deployment Verification**
5. **Detailed Reporting**

## Registry Subcontract

Registry contract ID: `BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn`

## Troubleshooting

Check:
1. Wallet has sufficient SOL (2+ SOL recommended)
2. Contract deployed correctly with Registry integration
3. IDL files exist and match deployed contracts
4. Contract handles test operations properly 