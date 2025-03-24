# Smart Contract Build Loop

This directory contains examples of how to use the smart contract build loop functionality that intelligently generates, fixes, and builds Solana smart contracts using the Anchor framework.

## What is the Build Loop?

The build loop is an automated process that:

1. Generates an initial smart contract based on your specifications
2. Attempts to build the contract using Anchor
3. If errors occur, passes those errors back to the AI to fix the contract
4. Repeats steps 2-3 until a successful build is achieved or max attempts reached
5. Extracts the program ID and updates the contract with it
6. Writes the final contract to `lib.rs` ready for manual deployment

This creates a much more reliable contract generation process as it can automatically fix common errors that might occur during the build process.

## Using the Build Loop

### From Command Line

You can use the build loop directly from the command line using the `test_build_loop.py` script:

```bash
# Generate and build an escrow contract
./test_build_loop.py escrow

# Generate and build a token vesting contract with custom schema
./test_build_loop.py token_vesting --schema /path/to/schema.json

# Allow more attempts for complex contracts
./test_build_loop.py escrow --max-attempts 5
```

After successful build, you can manually deploy the contract using:

```bash
cd deploy
anchor deploy
```

### From Python Code

You can also use the build loop directly in your Python code:

```python
from ai.contract_updater import smart_contract_build_loop

# Define schema (or use empty dict for default)
schema = {
    "name": "MyEscrow",
    "description": "A simple escrow contract",
    "owner": "initializer",
    "amount": "u64",
    # Add more schema properties as needed
}

# Run the build loop
success, program_id = smart_contract_build_loop(
    contract_type="escrow",
    schema=schema,
    max_attempts=3
)

if success and program_id:
    print(f"Contract built successfully! Program ID: {program_id}")
    print("Ready for manual deployment via `anchor deploy`")
```

### From the API

You can also use the build loop through the FastAPI endpoint:

```bash
curl -X POST http://localhost:8000/api/build-contract \
  -H "Content-Type: application/json" \
  -d '{
    "contract_type": "escrow",
    "contract_name": "MyEscrow",
    "parameters": {
      "name": "MyEscrow",
      "description": "A simple escrow contract"
    },
    "max_attempts": 3
  }'
```

## Supported Contract Types

- `escrow`: Simple escrow contracts for secure transactions
- `token_vesting`: Time-locked token release schedules
- `crowdfunding`: Campaign-based fundraising contracts

## Troubleshooting

If the build loop is failing:

1. Check the logs for specific error messages
2. Try increasing the `max_attempts` value
3. Simplify your schema requirements
4. Make sure Anchor and Solana CLI are properly installed
5. Ensure your Solana version is compatible with Anchor

## Advanced Usage

For advanced users, you can modify the `ai.contract_updater.py` file to customize how the build loop processes errors and generates fixes. 