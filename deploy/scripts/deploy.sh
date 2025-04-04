#!/bin/bash

# Smart Contract Deployment Script
# Automates the build, validation, and deployment process for Solana smart contracts
# Supports: escrow, token_vesting, and crowdfunding contract types

set -e # Exit on error

# Configuration
PROGRAM_ID_PATH="./target/deploy/deploy-keypair.json"
DEVNET_URL="https://api.devnet.solana.com"
MAINNET_URL="https://api.mainnet-beta.solana.com"
LOCAL_URL="http://127.0.0.1:8899"
DEPLOY_NETWORK="devnet" # Default network

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

print_success() {
  echo -e "${GREEN}Success: $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}Warning: $1${NC}"
}

print_error() {
  echo -e "${RED}Error: $1${NC}"
}

# Process command line arguments
process_args() {
  while [[ "$#" -gt 0 ]]; do
    case $1 in
      --local)
        DEPLOY_NETWORK="local"
        RPC_URL=$LOCAL_URL
        ;;
      --devnet)
        DEPLOY_NETWORK="devnet"
        RPC_URL=$DEVNET_URL
        ;;
      --mainnet)
        DEPLOY_NETWORK="mainnet"
        RPC_URL=$MAINNET_URL
        ;;
      --help|-h)
        echo "Usage: ./deploy.sh [OPTIONS]"
        echo "Deploy a Solana smart contract"
        echo ""
        echo "Options:"
        echo "  --local           Deploy to local validator (default)"
        echo "  --devnet          Deploy to Solana Devnet"
        echo "  --mainnet         Deploy to Solana Mainnet (use with caution!)"
        echo "  --help, -h        Show this help message"
        exit 0
        ;;
      *)
        print_error "Unknown parameter: $1"
        echo "Use --help to see available options"
        exit 1
        ;;
    esac
    shift
  done
  
  echo "Deployment target: $DEPLOY_NETWORK"
}

# Check Solana installation and version
check_requirements() {
  print_header "Checking Requirements"
  
  # Check Solana CLI
  if ! command -v solana &> /dev/null; then
    print_error "Solana CLI not found. Please install it and try again."
    exit 1
  fi
  
  SOLANA_VERSION=$(solana --version | head -n 1)
  echo "Solana CLI: $SOLANA_VERSION"
  
  # Check Anchor
  if ! command -v anchor &> /dev/null; then
    print_error "Anchor not found. Please install it and try again."
    exit 1
  fi
  
  ANCHOR_VERSION=$(anchor --version | head -n 1)
  echo "Anchor: $ANCHOR_VERSION"
  
  # Set up wallet
  WALLET_PATH="/Users/sukhrajkalon/Documents/Developer/SmartContractGen/deploy/wallets/deploy-wallet.json"
  
  # Create wallets directory if it doesn't exist
  mkdir -p "./wallets"
  
  # Check if wallet exists
  if [ ! -f "$WALLET_PATH" ]; then
    print_error "Deployment wallet not found at $WALLET_PATH."
    print_error "Please create a wallet first using scripts/check_wallet.sh"
    exit 1
  else
    print_success "Found deployment wallet at $WALLET_PATH"
  fi
  
  # Set the wallet in Solana config
  solana config set --keypair "$WALLET_PATH"
  
  # Get wallet address
  WALLET_ADDRESS=$(solana address -k "$WALLET_PATH")
  echo "Wallet address: $WALLET_ADDRESS"
  
  # Check balance based on target network
  if [ "$DEPLOY_NETWORK" = "devnet" ]; then
    BALANCE=$(solana balance --url $DEVNET_URL 2>/dev/null || echo "0 SOL")
    echo "Devnet Balance: $BALANCE"
    
    SOL_AMOUNT=$(echo $BALANCE | grep -o '[0-9.]*')
    if (( $(echo "$SOL_AMOUNT < 0.5" | bc -l) )); then
      print_warning "Low SOL balance on Devnet. Please airdrop SOL before deploying."
      read -p "Would you like to airdrop 1 SOL? (y/n): " airdrop
      if [[ $airdrop == "y" || $airdrop == "Y" ]]; then
        solana airdrop 1 --url $DEVNET_URL
        print_success "Airdropped 1 SOL"
      fi
    fi
  elif [ "$DEPLOY_NETWORK" = "mainnet" ]; then
    BALANCE=$(solana balance --url $MAINNET_URL 2>/dev/null || echo "0 SOL")
    echo "Mainnet Balance: $BALANCE"
    
    SOL_AMOUNT=$(echo $BALANCE | grep -o '[0-9.]*')
    if (( $(echo "$SOL_AMOUNT < 1.0" | bc -l) )); then
      print_error "Insufficient SOL balance on Mainnet. Minimum 1 SOL recommended."
      read -p "Continue anyway? (y/n): " continue_deploy
      if [[ $continue_deploy != "y" && $continue_deploy != "Y" ]]; then
        exit 1
      fi
    fi
  else # local
    solana-test-validator --no-bpf-jit --reset &
    TEST_VALIDATOR_PID=$!
    sleep 3 # Give the validator time to start
    solana config set --url $LOCAL_URL
    echo "Started local validator (PID: $TEST_VALIDATOR_PID)"
    
    # Airdrop SOL to wallet
    solana airdrop 10 --url $LOCAL_URL
    BALANCE=$(solana balance --url $LOCAL_URL 2>/dev/null || echo "0 SOL")
    echo "Local Balance: $BALANCE"
  fi
  
  print_success "All requirements satisfied"
}

# Build the contract
build_contract() {
  print_header "Building Smart Contract"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  # Clean and build
  echo "Cleaning previous build..."
  anchor clean
  
  echo "Building contract..."
  if [ "$DEPLOY_NETWORK" = "mainnet" ]; then
    # For mainnet, use verifiable builds
    echo "Using verifiable build for mainnet deployment..."
    anchor build --verifiable
  else
    anchor build
  fi
  
  if [ $? -eq 0 ]; then
    print_success "Contract built successfully"
  else
    print_error "Build failed"
    exit 1
  fi
  
  # Determine contract type
  detect_contract_type
}

# Detect the contract type by analyzing the IDL
detect_contract_type() {
  IDL_PATH="./target/idl/deploy.json"
  
  if [ ! -f "$IDL_PATH" ]; then
    print_error "IDL file not found at $IDL_PATH"
    exit 1
  fi
  
  echo "Detecting contract type..."
  
  # Look for instruction names to identify contract type
  if grep -q '"name": "execute"' "$IDL_PATH" || grep -q '"name": "cancel"' "$IDL_PATH"; then
    CONTRACT_TYPE="escrow"
  elif grep -q '"name": "createVestingSchedule"' "$IDL_PATH" || grep -q '"name": "createVesting"' "$IDL_PATH"; then
    CONTRACT_TYPE="token_vesting"
  elif grep -q '"name": "createCampaign"' "$IDL_PATH" || grep -q '"name": "contribute"' "$IDL_PATH"; then
    CONTRACT_TYPE="crowdfunding"
  else
    CONTRACT_TYPE="unknown"
  fi
  
  echo "Contract type detected: $CONTRACT_TYPE"
  
  # Process IDL file after detection
  process_idl
}

# Process IDL file
process_idl() {
  IDL_PATH="./target/idl/deploy.json"
  
  if [ ! -f "$IDL_PATH" ]; then
    return
  fi
  
  echo "Processing IDL file..."
  
  # Ensure app/src/idl directory exists
  mkdir -p "../app/src/idl"
  
  # Copy IDL to React app
  cp "$IDL_PATH" "../app/src/idl/deploy.json"
  
  print_success "IDL file processed and copied to app/src/idl/"
}

# Validate the contract on a local test validator
validate_contract() {
  print_header "Validating Contract"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  # Run the validation script
  echo "Running validation script..."
  
  # Skip validation for mainnet deployments if already deployed to devnet
  if [ "$DEPLOY_NETWORK" = "mainnet" ]; then
    read -p "Do you want to run validation for mainnet deployment? (y/n): " run_validation
    if [[ $run_validation != "y" && $run_validation != "Y" ]]; then
      print_warning "Skipping validation for mainnet deployment"
      return
    fi
  fi
  
  # Use the TypeScript validator to test on local validator
  npm run validate
  
  if [ $? -eq 0 ]; then
    print_success "Contract validation successful"
  else
    print_error "Contract validation failed"
    read -p "Contract validation failed. Continue with deployment? (y/n): " continue_deploy
    if [[ $continue_deploy != "y" && $continue_deploy != "Y" ]]; then
      exit 1
    fi
  fi
}

# Deploy to the selected network
deploy_contract() {
  print_header "Deploying to Solana $DEPLOY_NETWORK"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  # Confirm deployment
  echo "You are about to deploy a $CONTRACT_TYPE contract to $DEPLOY_NETWORK."
  
  if [ "$DEPLOY_NETWORK" = "mainnet" ]; then
    echo "⚠️ THIS IS A PRODUCTION DEPLOYMENT TO MAINNET! ⚠️"
    echo "This will cost real SOL and cannot be reversed."
    read -p "Are you ABSOLUTELY SURE you want to continue? Type 'yes' to confirm: " confirm
    
    if [[ $confirm != "yes" ]]; then
      print_warning "Mainnet deployment cancelled"
      exit 0
    fi
  else
    echo "This will cost a small amount of SOL for rent exemption."
    read -p "Continue? (y/n): " confirm
    
    if [[ $confirm != "y" && $confirm != "Y" ]]; then
      print_warning "Deployment cancelled"
      exit 0
    fi
  fi
  
  # Configure Solana for deployment
  case $DEPLOY_NETWORK in
    local)
      echo "Deploying to local validator..."
      solana config set --url $LOCAL_URL
      anchor deploy --provider.cluster localnet
      ;;
    devnet)
      echo "Deploying to Devnet..."
      solana config set --url $DEVNET_URL
      anchor deploy --provider.cluster devnet
      ;;
    mainnet)
      echo "Deploying to Mainnet..."
      solana config set --url $MAINNET_URL
      anchor deploy --provider.cluster mainnet
      ;;
  esac
  
  if [ $? -eq 0 ]; then
    PROGRAM_ID=$(solana address -k ./target/deploy/deploy-keypair.json)
    print_success "Contract deployed successfully to $DEPLOY_NETWORK!"
    echo "Program ID: $PROGRAM_ID"
    
    # Store program ID in a JSON file for other tools to use
    echo "{\"programId\": \"$PROGRAM_ID\", \"contractType\": \"$CONTRACT_TYPE\", \"network\": \"$DEPLOY_NETWORK\", \"deployTime\": \"$(date)\"}" > ./program-info.json
    print_success "Saved program info to deploy/program-info.json"
  else
    print_error "Deployment failed"
    exit 1
  fi
}

# Run post-deployment tests
test_deployed_contract() {
  print_header "Testing Deployed Contract"
  
  # Skip tests for mainnet deployments
  if [ "$DEPLOY_NETWORK" = "mainnet" ]; then
    print_warning "Skipping automated tests for mainnet deployment"
    return
  fi
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  echo "Running tests on deployed contract..."
  npm run test-deployed
  
  if [ $? -eq 0 ]; then
    print_success "Contract tests passed on $DEPLOY_NETWORK"
  else
    print_warning "Some tests failed on $DEPLOY_NETWORK"
  fi
}

# Print deployment summary
summarize_deployment() {
  print_header "Deployment Summary"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  PROGRAM_ID=$(solana address -k ./target/deploy/deploy-keypair.json)
  
  echo "Contract Type: $CONTRACT_TYPE"
  echo "Program ID: $PROGRAM_ID"
  echo "Network: $DEPLOY_NETWORK (${RPC_URL})"
  
  # Get account data size and rent
  case $DEPLOY_NETWORK in
    local)
      ACCOUNT_DATA=$(solana program show $PROGRAM_ID --output json --url $LOCAL_URL 2>/dev/null)
      ;;
    devnet)
      ACCOUNT_DATA=$(solana program show $PROGRAM_ID --output json --url $DEVNET_URL 2>/dev/null)
      ;;
    mainnet)
      ACCOUNT_DATA=$(solana program show $PROGRAM_ID --output json --url $MAINNET_URL 2>/dev/null)
      ;;
  esac
  
  ACCOUNT_SIZE=$(echo "$ACCOUNT_DATA" | grep dataLen | awk '{print $2}' | tr -d ',')
  RENT=$(echo "$ACCOUNT_DATA" | grep rentExemptBalance | awk '{print $2}' | tr -d ',')
  
  if [ ! -z "$ACCOUNT_SIZE" ]; then
    echo "Program Size: $ACCOUNT_SIZE bytes"
  fi
  
  if [ ! -z "$RENT" ]; then
    RENT_SOL=$(echo "scale=6; $RENT / 1000000000" | bc)
    echo "Rent-exempt Balance: $RENT_SOL SOL"
  fi
  
  # Print explorer link
  echo -e "\nView your contract on Solana Explorer:"
  case $DEPLOY_NETWORK in
    local)
      echo "Local deployment - no explorer link available"
      ;;
    devnet)
      echo -e "${BLUE}https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet${NC}"
      ;;
    mainnet)
      echo -e "${BLUE}https://explorer.solana.com/address/$PROGRAM_ID${NC}"
      ;;
  esac
  
  # Print documentation on how to interact with the contract
  echo -e "\nTo interact with your $CONTRACT_TYPE contract:"
  
  case $CONTRACT_TYPE in
    "escrow")
      echo "1. Initialize an escrow: solana program call $PROGRAM_ID initialize <parameters>"
      echo "2. Execute the escrow: solana program call $PROGRAM_ID execute <parameters>"
      echo "3. Cancel the escrow: solana program call $PROGRAM_ID cancel <parameters>"
      ;;
    "token_vesting")
      echo "1. Create a vesting schedule: solana program call $PROGRAM_ID createVestingSchedule <parameters>"
      echo "2. Withdraw vested tokens: solana program call $PROGRAM_ID withdraw <parameters>"
      ;;
    "crowdfunding")
      echo "1. Create a campaign: solana program call $PROGRAM_ID createCampaign <parameters>"
      echo "2. Contribute to a campaign: solana program call $PROGRAM_ID contribute <parameters>"
      echo "3. Withdraw funds: solana program call $PROGRAM_ID withdrawFunds <parameters>"
      ;;
    *)
      echo "Check your contract's IDL for available instructions:"
      echo "solana program show $PROGRAM_ID --output json"
      ;;
  esac
  
  echo -e "\nFor more detailed instructions, refer to the documentation."
}

# Cleanup function
cleanup() {
  if [ "$DEPLOY_NETWORK" = "local" ] && [ ! -z "$TEST_VALIDATOR_PID" ]; then
    echo "Stopping local validator (PID: $TEST_VALIDATOR_PID)..."
    kill $TEST_VALIDATOR_PID
  fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution flow
main() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}  Solana Smart Contract Deployment   ${NC}"
  echo -e "${BLUE}=====================================${NC}"
  
  # Process command line arguments
  process_args "$@"
  
  # Check requirements
  check_requirements
  
  # Build the contract
  build_contract
  
  # Validate the contract
  validate_contract
  
  # Deploy to selected network
  deploy_contract
  
  # Test deployed contract
  test_deployed_contract
  
  # Summarize deployment
  summarize_deployment
  
  print_success "Deployment process completed on $DEPLOY_NETWORK"
}

# Run the main function with all arguments
main "$@" 