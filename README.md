# SmartContractGen - Automated Solana Smart Contract Platform

SmartContractGen is a comprehensive platform for generating, building, testing, and deploying secure Solana smart contracts. It uses AI to generate production-ready contracts with security, scalability, and interoperability in mind.

## Features

- **AI-Powered Contract Generation**: Create secure smart contracts in minutes
- **Template-Based Development**: Leverages proven contract templates for reliability
- **Automated Building & Deployment**: Streamlined process from code to Devnet
- **Security Analysis**: Comprehensive security scoring and validation
- **Contract Updates**: Easily update contracts while preserving security patterns

## Contract Types Supported

- **Escrow**: Secure exchange of assets between parties
- **Token Vesting**: Time-locked token release schedules 
- **Crowdfunding**: Campaign-based fundraising contracts

## System Architecture

The platform consists of two main components:

1. **Backend (`/back`)**: Python-based AI integration, contract generation, and metrics
2. **Deployment (`/deploy`)**: Rust/Anchor contracts, build scripts, and deployment tools

## Prerequisites

- Python 3.9+
- Solana CLI tools
- Anchor Framework
- Node.js & npm
- Rust

## Setup Instructions

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/SmartContractGen.git
   cd SmartContractGen
   ```

2. Set up the environment
   ```bash
   # Install Python dependencies
   cd back
   pip install -r requirements.txt
   
   # Install JavaScript dependencies
   cd ../deploy
   npm install
   ```

3. Configure Solana
   ```bash
   # Create a wallet for deployment (if you don't have one)
   solana-keygen new -o deploy/wallets/deploy-wallet.json
   
   # Configure Solana to use Devnet
   solana config set --url https://api.devnet.solana.com
   ```

## Contract Generation

### Using the Automation Script

Our automation script provides an easy way to generate and deploy contracts:

```bash
cd back
python script/automate_contract.py automate <contract_type> [options]
```

Available contract types:
- `escrow`
- `token_vesting`
- `crowdfunding`

Options:
- `--schema <schema.json>`: Provide a JSON schema for the contract
- `--deploy`: Automatically deploy after generation

### Advanced Usage

For more control, you can use the individual components:

1. Generate a contract:
   ```bash
   python script/automate_contract.py generate <contract_type> [--schema <schema.json>]
   ```

2. Update an existing contract:
   ```bash
   python script/automate_contract.py update <contract_path> <contract_type> "<update requirements>"
   ```

## Deployment

The platform includes automated deployment to Solana Devnet:

```bash
cd deploy
./scripts/deploy.sh
```

This script will:
1. Check system requirements
2. Build the contract
3. Validate the contract
4. Deploy to Devnet
5. Test the deployed contract

## Understanding Metrics

Each generated or updated contract is evaluated on:

- **Security Score**: Measures resistance to common vulnerabilities
- **Interoperability**: Ability to interact with other Solana programs
- **Scalability**: Performance and efficiency under load

## Troubleshooting

### Common Issues

1. **Compilation Errors**:
   - Check that the contract implements all required Anchor attributes
   - Ensure proper PDA derivation and bump handling

2. **Deployment Failures**:
   - Verify you have sufficient SOL in your wallet for deployment
   - Check that Solana is configured to use Devnet

3. **Template Issues**:
   - If templates are missing, run `python script/automate_contract.py automate <contract_type>` to regenerate

## Best Practices

1. Always review generated contracts before deployment
2. Test contracts thoroughly on a local validator before Devnet
3. Use the template-based generation for consistent results
4. When updating contracts, specify clear requirements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Solana Foundation for the development framework
- Anchor for the smart contract infrastructure
- Claude API for powering the AI contract generation

## Metrics Removal

The metrics functionality has been completely removed from the application in both frontend and backend:

**Backend changes:**
- Removed all metrics-related API endpoints from `main.py`
- Removed metrics integration from `contract_generator.py` and `contract_updater.py`
- Removed metrics import from `automation.py`
- Removed all contract evaluation based on metrics

**Frontend changes:**
- Removed all metrics components and views
- Updated UI to focus on contract generation and deployment
- Improved overall interface with Material-UI components

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   # Frontend
   cd front
   npm install
   
   # Backend
   cd back
   pip install -r requirements.txt
   ```

### Running the application

1. Start the backend:
   ```
   cd back
   uvicorn main:app --reload
   ```

2. Start the frontend:
   ```
   cd front
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`
