#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Deployment Wallet Status =====${NC}"

WALLET_PATH="./wallets/deploy-wallet.json"

if [ ! -f "$WALLET_PATH" ]; then
  echo -e "${RED}Wallet not found at ${WALLET_PATH}${NC}"
  echo "Would you like to create one? (y/n)"
  read -r response
  if [ "$response" = "y" ]; then
    mkdir -p "./wallets"
    echo "Creating wallet..."
    solana-keygen new -o "$WALLET_PATH" --force --no-bip39-passphrase
  else
    echo "Exiting without creating wallet."
    exit 1
  fi
fi

# Display wallet info
echo -e "${YELLOW}Wallet Path:${NC} $WALLET_PATH"
echo -e "${YELLOW}Wallet Address:${NC} $(solana address -k $WALLET_PATH)"

# Check balances
echo -e "\n${BLUE}==== Balances ====${NC}"
echo -e "${YELLOW}Devnet:${NC} $(solana balance -k $WALLET_PATH --url https://api.devnet.solana.com)"
echo -e "${YELLOW}Localnet:${NC} $(solana balance -k $WALLET_PATH --url http://127.0.0.1:8899 2>/dev/null || echo "Not available")"

# Set as default wallet
echo -e "\nSetting this wallet as default for Solana CLI..."
solana config set --keypair $WALLET_PATH

echo -e "\n${GREEN}Done!${NC}" 