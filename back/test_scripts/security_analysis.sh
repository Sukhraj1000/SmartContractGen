#!/bin/bash

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running security analysis for deployed contract...${NC}"

# Get the project root directory
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$CURRENT_DIR/../.." && pwd )"
PROGRAM_INFO="$PROJECT_ROOT/deploy/program-info.json"
CONTRACT_PATH="$PROJECT_ROOT/deploy/programs/deploy/src/lib.rs"
SECURITY_RESULTS="$CURRENT_DIR/security_results.json"

# Initialize scores
TOTAL_CHECKS=0
PASSED_CHECKS=0

# Function to log check results
check_security() {
  local check_name=$1
  local check_command=$2
  local description=$3
  
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  
  echo -e "\n${BLUE}Checking ${check_name}...${NC}"
  echo -e "  ${YELLOW}${description}${NC}"
  
  if eval "$check_command"; then
    echo -e "  ${GREEN} PASS: ${check_name} check passed${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    return 0
  else
    echo -e "  ${RED}FAIL: ${check_name} check failed${NC}"
    return 1
  fi
}

# Verify contract file exists
if [ ! -f "$CONTRACT_PATH" ]; then
  echo -e "${RED}ERROR: Contract file not found at $CONTRACT_PATH${NC}"
  exit 1
fi

# Get program ID from program-info.json if available
if [ -f "$PROGRAM_INFO" ]; then
  PROGRAM_ID=$(grep -o '"programId": "[^"]*"' "$PROGRAM_INFO" | cut -d'"' -f4)
  echo -e "Checking deployed contract with ID: ${GREEN}$PROGRAM_ID${NC}"
else
  echo -e "${YELLOW}Warning: program-info.json not found. Will analyze contract without program ID.${NC}"
fi

# 1. Registry Integration Check
check_security "Registry Integration" "grep -q \"REGISTRY_PROGRAM_ID\" \"$CONTRACT_PATH\"" \
  "Verifies that the contract integrates with the Registry service"

# 2. Signer Validation
check_security "Signer Validation" "grep -q \"#\[account(signer\" \"$CONTRACT_PATH\"" \
  "Ensures proper signer validation for transaction authorization"

# 3. Checked Math
check_security "Checked Math" "grep -q \"checked_\" \"$CONTRACT_PATH\"" \
  "Confirms use of checked math operations to prevent overflows/underflows"

# 4. Error Handling
check_security "Error Handling" "grep -q \"require!\" \"$CONTRACT_PATH\"" \
  "Verifies proper error handling with require statements"

# 5. Proper Account Validation
check_security "Account Validation" "grep -q \"#\[account(\" \"$CONTRACT_PATH\"" \
  "Checks for proper account constraint validation"

# 6. PDA Usage
check_security "PDA Usage" "grep -q \"seeds =\" \"$CONTRACT_PATH\"" \
  "Confirms the use of Program Derived Addresses (PDAs)"

# 7. Ownership Checks
check_security "Ownership Checks" "grep -q \"owner =\" \"$CONTRACT_PATH\"" \
  "Verifies ownership validation for accounts"

# 8. Input Validation
check_security "Input Validation" "grep -q \"if \" \"$CONTRACT_PATH\"" \
  "Checks for input validation logic"

# Calculate security score
SECURITY_SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))

echo "Security analysis completed."
