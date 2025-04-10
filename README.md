# SmartContractGen

A comprehensive platform for generating, building, and deploying smart contracts on the Solana blockchain using AI.

## Overview

SmartContractGen automates the process of creating, testing, and deploying Solana smart contracts using AI. It features:

- AI-powered smart contract generation based on user requirements
- Automatic build and deployment process for Solana smart contracts
- Web interface for specifying contract parameters
- Support for multiple contract types (escrow, crowdfunding)
- Testing framework for validating contract functionality

## Project Structure

- `back/` - Backend API and AI integration
- `ui/` - React frontend interface
- `deploy/` - Solana contract deployment resources
- `registry_contract/` - Registry contract for interoperability
- `contracts/` - Generated smart contracts
- `.keypair/` - Wallet configuration

## Prerequisites

- Node.js (v14+)
- Python 3.8+
- Solana CLI tools
- Anchor Framework
- Anthropic API key (for Claude AI)

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/SmartContractGen.git
cd SmartContractGen
```

### 2. Set up backend
```bash
cd back
pip install -r requirements.txt
```

Create a `.env` file in the `back/` directory with:
```
ANTHROPIC_API_KEY=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

```

### 3. Set up frontend
```bash
cd ../ui
npm install
```

### 4. Set up wallet
```bash
# From project root
chmod +x setup_wallet.sh
./setup_wallet.sh
```

## Getting Started

### 1. Start the backend server
```bash
cd back
python main.py
```

### 2. Start the frontend
```bash
cd ui
npm run dev
```

### 3. Access the application
Open your browser and navigate to: http://localhost:5173

## Using SmartContractGen

1. From the home page, select "Create Contract"
2. Choose a contract type (escrow or crowdfunding)
3. Configure the parameters for your contract
4. Click "Generate Contract"
5. Wait for the AI to build your contract
6. View the generated contract code and deployment details

## Development

### Backend API Endpoints

- `GET /api/view-contract/{contract_id}` - View a generated contract
- `POST /api/build-contract` - Generate and build a new contract

### AI Contract Generation

The system uses Claude AI from Anthropic to generate Rust code for Solana contracts. The AI:
1. Interprets user requirements
2. Generates Solana-compatible Rust code
3. Iteratively fixes build errors
4. Prepares the contract for deployment

## Testing

Test scripts are available in the `back/test_scripts/` directory for:
- Transaction throughput testing
- Interoperability testing with the registry contract
- Security analysis


# Repository restored and working properly
