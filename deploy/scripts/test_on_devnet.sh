#!/bin/bash

# Colors for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to display info messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Function to display error messages
error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to display warning messages
warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Set up the environment
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROGRAM_ID_FILE="$DEPLOY_DIR/program_id.txt"
TEST_WALLET_PATH="$DEPLOY_DIR/../back/test-wallet.json"
RECEIVER_WALLET_PATH="$DEPLOY_DIR/../back/receiver-wallet.json"
CONTRACT_TYPE="$1"

# Check if program_id.txt exists
if [ ! -f "$PROGRAM_ID_FILE" ]; then
    error "Program ID file not found. Make sure to deploy the contract first."
    exit 1
fi

# Read program ID from file
PROGRAM_ID=$(cat "$PROGRAM_ID_FILE")
info "Testing program: $PROGRAM_ID"

# Check if wallet exists
if [ ! -f "$TEST_WALLET_PATH" ]; then
    error "Test wallet not found at $TEST_WALLET_PATH"
    exit 1
fi

if [ ! -f "$RECEIVER_WALLET_PATH" ]; then
    warning "Receiver wallet not found at $RECEIVER_WALLET_PATH. Creating new one..."
    solana-keygen new --no-bip39-passphrase -o "$RECEIVER_WALLET_PATH"
fi

# Get wallet addresses
WALLET_ADDRESS=$(solana address -k "$TEST_WALLET_PATH")
RECEIVER_ADDRESS=$(solana address -k "$RECEIVER_WALLET_PATH")

info "Using wallet: $WALLET_ADDRESS"
info "Using receiver wallet: $RECEIVER_ADDRESS"

# Check wallet balance
BALANCE=$(solana balance "$WALLET_ADDRESS" --url devnet)
info "Current balance: $BALANCE SOL"

if [[ "$BALANCE" == "0 SOL" ]]; then
    info "Requesting airdrop..."
    solana airdrop 1 "$WALLET_ADDRESS" --url devnet
    sleep 2
    BALANCE=$(solana balance "$WALLET_ADDRESS" --url devnet)
    info "New balance: $BALANCE SOL"
fi

# Generate a random seed for the transaction
SEED=$((RANDOM + RANDOM * RANDOM))
info "Using transaction seed: $SEED"

# Function to test escrow contract
test_escrow() {
    info "Testing escrow contract..."
    
    # Initialize escrow
    AMOUNT=100000000 # 0.1 SOL
    RELEASE_CONDITION=50
    
    info "Initializing escrow with amount $AMOUNT lamports and release condition $RELEASE_CONDITION"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$TEST_WALLET_PATH" \
        --url devnet \
        -- initialize \
        "$SEED" \
        "$AMOUNT" \
        "$RELEASE_CONDITION" \
        "$WALLET_ADDRESS" \
        "$RECEIVER_ADDRESS" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Escrow created successfully"* ]]; then
        info "Escrow created successfully!"
    else
        error "Failed to create escrow"
        echo "$OUTPUT"
        exit 1
    fi
    
    sleep 2
    
    # Execute escrow
    info "Executing escrow with condition value 100"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$RECEIVER_WALLET_PATH" \
        --url devnet \
        -- execute \
        "100" \
        "$WALLET_ADDRESS" \
        "$RECEIVER_ADDRESS" \
        "$SEED" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Escrow executed successfully"* ]]; then
        info "Escrow executed successfully!"
    else
        error "Failed to execute escrow"
        echo "$OUTPUT"
        # Try to cancel instead
        info "Attempting to cancel escrow..."
        OUTPUT=$(solana program call \
            --program-id "$PROGRAM_ID" \
            --keypair "$TEST_WALLET_PATH" \
            --url devnet \
            -- cancel \
            "$WALLET_ADDRESS" \
            "$SEED" 2>&1)
        
        if [[ "$OUTPUT" == *"Program log: Escrow cancelled successfully"* ]]; then
            info "Escrow cancelled successfully!"
        else
            error "Failed to cancel escrow"
            echo "$OUTPUT"
        fi
    fi
}

# Function to test token vesting contract
test_token_vesting() {
    info "Testing token vesting contract..."
    
    # Current timestamp
    CURRENT_TIME=$(date +%s)
    
    # Create vesting schedule
    AMOUNT=200000000 # 0.2 SOL
    CLIFF_TIME=$((CURRENT_TIME + 60)) # 1 minute from now
    RELEASE_TIME=$((CURRENT_TIME + 300)) # 5 minutes from now
    
    info "Creating vesting schedule with amount $AMOUNT lamports, cliff at $CLIFF_TIME, release at $RELEASE_TIME"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$TEST_WALLET_PATH" \
        --url devnet \
        -- create_vesting_schedule \
        "$AMOUNT" \
        "$RELEASE_TIME" \
        "$CLIFF_TIME" \
        "$SEED" \
        "255" \
        "$RECEIVER_ADDRESS" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Vesting schedule created successfully"* ]]; then
        info "Vesting schedule created successfully!"
    else
        error "Failed to create vesting schedule"
        echo "$OUTPUT"
        exit 1
    fi
    
    # Wait for 2 minutes so we pass the cliff time
    info "Waiting 2 minutes to pass cliff time..."
    sleep 120
    
    # Try to withdraw some funds after cliff
    WITHDRAW_AMOUNT=50000000 # 0.05 SOL
    info "Attempting to withdraw $WITHDRAW_AMOUNT lamports after cliff time"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$RECEIVER_WALLET_PATH" \
        --url devnet \
        -- withdraw \
        "$WITHDRAW_AMOUNT" \
        "$RECEIVER_ADDRESS" \
        "$SEED" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Withdrawn"* ]]; then
        info "Withdrawal successful!"
    else
        info "Withdrawal might have failed, checking if we can cancel instead..."
        OUTPUT=$(solana program call \
            --program-id "$PROGRAM_ID" \
            --keypair "$TEST_WALLET_PATH" \
            --url devnet \
            -- cancel \
            "$WALLET_ADDRESS" \
            "$SEED" 2>&1)
        
        if [[ "$OUTPUT" == *"Program log: Vesting schedule cancelled"* ]]; then
            info "Vesting schedule cancelled successfully!"
        else
            error "Failed to interact with vesting contract"
            echo "$OUTPUT"
        fi
    fi
}

# Function to test crowdfunding contract
test_crowdfunding() {
    info "Testing crowdfunding contract..."
    
    # Current timestamp
    CURRENT_TIME=$(date +%s)
    
    # Create campaign
    TARGET_AMOUNT=500000000 # 0.5 SOL
    END_TIME=$((CURRENT_TIME + 600)) # 10 minutes from now
    
    info "Creating campaign with target $TARGET_AMOUNT lamports, ending at $END_TIME"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$TEST_WALLET_PATH" \
        --url devnet \
        -- create_campaign \
        "Test Campaign" \
        "This is a test campaign for devnet" \
        "$TARGET_AMOUNT" \
        "$END_TIME" \
        "$SEED" \
        "255" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Campaign created successfully"* ]]; then
        info "Campaign created successfully!"
    else
        error "Failed to create campaign"
        echo "$OUTPUT"
        exit 1
    fi
    
    # Make a contribution
    CONTRIBUTION_AMOUNT=100000000 # 0.1 SOL
    info "Contributing $CONTRIBUTION_AMOUNT lamports to campaign"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$RECEIVER_WALLET_PATH" \
        --url devnet \
        -- contribute \
        "$CONTRIBUTION_AMOUNT" \
        "$RECEIVER_ADDRESS" \
        "$SEED" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Contributed"* ]]; then
        info "Contribution successful!"
    else
        error "Failed to contribute to campaign"
        echo "$OUTPUT"
    fi
    
    # For testing, we'll end the campaign early and withdraw funds
    info "Testing withdraw_funds (this may fail if campaign conditions aren't met)"
    OUTPUT=$(solana program call \
        --program-id "$PROGRAM_ID" \
        --keypair "$TEST_WALLET_PATH" \
        --url devnet \
        -- withdraw_funds \
        "$WALLET_ADDRESS" \
        "$SEED" 2>&1)
    
    if [[ "$OUTPUT" == *"Program log: Campaign did not meet target"* || "$OUTPUT" == *"Successful campaign: withdrew"* ]]; then
        info "Withdraw operation processed!"
    else
        warning "Withdraw operation may have failed, but this is expected if the campaign is still active"
        echo "$OUTPUT"
    fi
}

# Detect contract type and run appropriate test
case "$CONTRACT_TYPE" in
    "escrow")
        test_escrow
        ;;
    "token_vesting")
        test_token_vesting
        ;;
    "crowdfunding")
        test_crowdfunding
        ;;
    "")
        # If no contract type specified, try to detect from lib.rs
        LIB_RS="$DEPLOY_DIR/programs/deploy/src/lib.rs"
        if grep -q "pub mod escrow" "$LIB_RS"; then
            info "Detected escrow contract"
            test_escrow
        elif grep -q "pub mod token_vesting" "$LIB_RS"; then
            info "Detected token vesting contract"
            test_token_vesting
        elif grep -q "pub mod crowdfunding" "$LIB_RS"; then
            info "Detected crowdfunding contract"
            test_crowdfunding
        else
            error "Could not detect contract type. Please specify as first argument: escrow, token_vesting, or crowdfunding"
            exit 1
        fi
        ;;
    *)
        error "Unknown contract type: $CONTRACT_TYPE. Use one of: escrow, token_vesting, crowdfunding"
        exit 1
        ;;
esac

info "Testing complete!" 