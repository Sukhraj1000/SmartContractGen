#!/bin/bash

echo "Running security analysis for deployed contract..."

# Get the project root directory
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$CURRENT_DIR/../.." && pwd )"
PROGRAM_INFO="$PROJECT_ROOT/deploy/program-info.json"
CONTRACT_PATH="$PROJECT_ROOT/deploy/programs/deploy/src/lib.rs"

PROGRAM_ID=$(grep -o '"programId": "[^"]*"' "$PROGRAM_INFO" | cut -d'"' -f4)
echo "Checking deployed contract with ID: $PROGRAM_ID"

echo "Checking Registry integration..."
if grep -q "REGISTRY_PROGRAM_ID" "$CONTRACT_PATH"; then 
  echo "✅ Registry integration found"; 
else 
  echo "❌ Registry integration missing"; 
fi

echo "Checking account validation..."
if grep -q "#\[account(signer" "$CONTRACT_PATH"; then 
  echo "✅ Proper signer validation found"; 
else 
  echo "❌ Signer validation missing"; 
fi

echo "Security analysis completed."
