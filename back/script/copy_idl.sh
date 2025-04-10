#!/bin/bash

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Copying IDL files to test scripts directory...${NC}"

# Get the project root directory
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$CURRENT_DIR/../.." && pwd )"

# Set source and destination paths
SOURCE_IDL="$PROJECT_ROOT/deploy/target/idl/deploy.json"
DEST_DIR="$PROJECT_ROOT/back/test_scripts/idl"
DEST_IDL="$DEST_DIR/latest.json"

# Make sure the destination directory exists
mkdir -p "$DEST_DIR"

# Check if source IDL exists
if [ ! -f "$SOURCE_IDL" ]; then
    echo -e "${RED}ERROR: IDL file not found at $SOURCE_IDL${NC}"
    echo -e "${YELLOW}Have you run 'anchor build' or 'anchor deploy'?${NC}"
    exit 1
fi

# Get program ID from program-info.json
PROGRAM_INFO="$PROJECT_ROOT/deploy/program-info.json"
if [ -f "$PROGRAM_INFO" ]; then
    PROGRAM_ID=$(grep -o '"programId": "[^"]*"' "$PROGRAM_INFO" | cut -d'"' -f4)
    CONTRACT_TYPE=$(grep -o '"contractType": "[^"]*"' "$PROGRAM_INFO" | cut -d'"' -f4)
    
    if [ -z "$PROGRAM_ID" ]; then
        echo -e "${RED}Error: Could not extract program ID from program-info.json${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Found program ID: ${NC}$PROGRAM_ID"
    echo -e "${GREEN}Contract type: ${NC}$CONTRACT_TYPE"
else
    echo -e "${RED}Error: program-info.json not found at $PROGRAM_INFO${NC}"
    exit 1
fi

# Copy and update IDL file with program ID
cp "$SOURCE_IDL" "$DEST_IDL"
cp "$SOURCE_IDL" "$DEST_DIR/${CONTRACT_TYPE}.json"

# Update program ID in the IDL file
sed -i.bak "s/\"address\": \"[^\"]*\"/\"address\": \"$PROGRAM_ID\"/" "$DEST_IDL"
sed -i.bak "s/\"address\": \"[^\"]*\"/\"address\": \"$PROGRAM_ID\"/" "$DEST_DIR/${CONTRACT_TYPE}.json"

# Remove backup files
rm -f "$DEST_IDL.bak"
rm -f "$DEST_DIR/${CONTRACT_TYPE}.json.bak"

echo -e "${GREEN}Successfully copied and updated IDL files:${NC}"
echo "  - $DEST_IDL"
echo "  - $DEST_DIR/${CONTRACT_TYPE}.json"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run security analysis: ./back/test_scripts/security_analysis.sh"
echo "  2. Test performance: node ./back/test_scripts/tps_test.js $CONTRACT_TYPE $PROGRAM_ID"
echo "  3. Test interoperability: node ./back/test_scripts/interoperability_test.js $CONTRACT_TYPE $PROGRAM_ID" 