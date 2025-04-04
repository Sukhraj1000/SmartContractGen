#!/bin/bash

# Smart Contract Build Script
# Automates the build and validation process for Solana smart contracts

set -e # Exit on error

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
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

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
  
  # Check if verifiable build flag is provided
  if [ "$1" == "verifiable" ]; then
    echo "Building verifiable build (for production)..."
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
  
  # Process IDL
  process_idl
  
  # Output program ID
  PROGRAM_ID=$(solana address -k ./target/deploy/deploy-keypair.json)
  echo "Program ID: $PROGRAM_ID"
  
  # Store program ID in a JSON file for other tools to use
  if [ -f "./target/idl/deploy.json" ]; then
    CONTRACT_TYPE=$(detect_contract_type)
    echo "{\"programId\": \"$PROGRAM_ID\", \"contractType\": \"$CONTRACT_TYPE\", \"buildTime\": \"$(date)\"}" > ./program-info.json
    print_success "Saved program info to deploy/program-info.json"
  fi
}

# Process IDL file
process_idl() {
  IDL_PATH="./target/idl/deploy.json"
  
  if [ ! -f "$IDL_PATH" ]; then
    print_warning "IDL file not found at $IDL_PATH"
    return
  fi
  
  echo "Processing IDL file..."
  
  # Ensure app/src/idl directory exists
  mkdir -p "../app/src/idl"
  
  # Copy IDL to React app
  cp "$IDL_PATH" "../app/src/idl/deploy.json"
  
  print_success "IDL file processed and copied to app/src/idl/"
}

# Detect the contract type by analyzing the IDL
detect_contract_type() {
  IDL_PATH="./target/idl/deploy.json"
  
  if [ ! -f "$IDL_PATH" ]; then
    echo "unknown"
    return
  fi
  
  # Look for instruction names to identify contract type
  if grep -q '"name": "execute"' "$IDL_PATH" || grep -q '"name": "cancel"' "$IDL_PATH"; then
    echo "escrow"
  elif grep -q '"name": "createVestingSchedule"' "$IDL_PATH" || grep -q '"name": "createVesting"' "$IDL_PATH"; then
    echo "token_vesting"
  elif grep -q '"name": "createCampaign"' "$IDL_PATH" || grep -q '"name": "contribute"' "$IDL_PATH"; then
    echo "crowdfunding"
  else
    echo "unknown"
  fi
}

# Validate the contract on a local test validator
validate_contract() {
  print_header "Validating Contract"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  # Run the validation script
  echo "Running validation script..."
  
  # Use the TypeScript validator to test on local validator
  node ./scripts/validate_contract.js
  
  if [ $? -eq 0 ]; then
    print_success "Contract validation successful"
  else
    print_error "Contract validation failed"
    read -p "Contract validation failed. Continue? (y/n): " continue_build
    if [[ $continue_build != "y" && $continue_build != "Y" ]]; then
      exit 1
    fi
  fi
}

# Print build summary
summarize_build() {
  print_header "Build Summary"
  
  # Make sure we're in the deploy directory
  cd "$(dirname "$0")/.."
  
  PROGRAM_ID=$(solana address -k ./target/deploy/deploy-keypair.json)
  
  CONTRACT_TYPE=$(detect_contract_type)
  
  echo "Contract Type: $CONTRACT_TYPE"
  echo "Program ID: $PROGRAM_ID"
  
  # Check if IDL was generated
  if [ -f "./target/idl/deploy.json" ]; then
    print_success "IDL file generated successfully"
    
    # Count instructions
    INSTRUCTION_COUNT=$(grep -c '"name":' "./target/idl/deploy.json")
    echo "Total instructions: $INSTRUCTION_COUNT"
  else
    print_warning "IDL file not found"
  fi
  
  echo -e "\nYour contract is ready for deployment."
  echo -e "To deploy, use one of the following commands:"
  echo -e "  npm run deploy:local   - Deploy to local validator"
  echo -e "  npm run deploy:devnet  - Deploy to Solana Devnet"
  echo -e "  npm run deploy:mainnet - Deploy to Solana Mainnet"
}

# Main execution flow
main() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}  Solana Smart Contract Build Tool   ${NC}"
  echo -e "${BLUE}=====================================${NC}"
  
  BUILD_TYPE="regular"
  if [ "$1" == "--verifiable" ] || [ "$1" == "-v" ]; then
    BUILD_TYPE="verifiable"
  fi
  
  # Check requirements
  check_requirements
  
  # Build the contract
  build_contract $BUILD_TYPE
  
  # Validate the contract
  validate_contract
  
  # Summarize build
  summarize_build
  
  print_success "Build process completed"
}

# Get command line arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  echo "Usage: ./build.sh [OPTIONS]"
  echo "Build a Solana smart contract"
  echo ""
  echo "Options:"
  echo "  --verifiable, -v    Create a verifiable build for production deployment"
  echo "  --help, -h          Show this help message"
  exit 0
fi

# Run the main function with arguments
main "$@" 