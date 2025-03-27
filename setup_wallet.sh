#!/bin/bash

# SmartContractGen Wallet Setup Script
# This script configures your Solana CLI to use the primary deployment wallet for all operations

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}SmartContractGen Wallet Setup${NC}"
echo "-----------------------------"
echo "This script will configure your Solana CLI to use the project's primary wallet."

# Define paths
CURRENT_DIR=$(pwd)
WALLET_PATH="$CURRENT_DIR/deploy/deploy-keypair.json"
SOLANA_CONFIG_DIR="$HOME/.config/solana"
SOLANA_ID_PATH="$SOLANA_CONFIG_DIR/id.json"

# Check if wallet exists
if [ ! -f "$WALLET_PATH" ]; then
    echo -e "${RED}Error: Wallet not found at $WALLET_PATH${NC}"
    echo "Please run this script from the root directory of the SmartContractGen project."
    exit 1
fi

# Create Solana config directory if it doesn't exist
mkdir -p "$SOLANA_CONFIG_DIR/cli"

# Set the wallet as the default for Solana CLI
solana config set --keypair "$WALLET_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to set Solana CLI config.${NC}"
    exit 1
fi

# Copy the wallet to the default Solana location
cp "$WALLET_PATH" "$SOLANA_ID_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to copy wallet to $SOLANA_ID_PATH${NC}"
    exit 1
fi

# Configure for devnet
solana config set --url https://api.devnet.solana.com
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to set Solana network to devnet.${NC}"
    exit 1
fi

# Verify configuration
WALLET_PUBKEY=$(solana-keygen pubkey "$WALLET_PATH")
echo -e "${GREEN}✓ Successfully configured Solana CLI to use the project wallet:${NC}"
echo "  Public Key: $WALLET_PUBKEY"
echo ""

# Check the balance
echo "Checking wallet balance on devnet..."
BALANCE=$(solana balance | head -n 1)
echo "  Current balance: $BALANCE"

# If balance is low, provide instructions
if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
    echo -e "${YELLOW}Warning:${NC} Wallet balance is below 2 SOL, which is needed for deployments."
    echo "To fund your wallet, you can use:"
    echo "  1. The Solana CLI: solana airdrop 2"
    echo "  2. A faucet like https://solfaucet.com"
    echo ""
fi

echo -e "${GREEN}Setup complete!${NC}"
echo "This wallet will now be used for all Solana operations in the project."
echo "For more information about wallet management, see deploy/WALLET.md" 