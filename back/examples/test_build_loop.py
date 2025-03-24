#!/usr/bin/env python3
"""
Test script for the smart contract build loop functionality.
This demonstrates how to use the smart_contract_build_loop to generate,
automatically fix, and build a smart contract.
"""

import sys
import os
import argparse
import json
from pathlib import Path

# Add parent directory to path to import the module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the smart_contract_build_loop function
from ai.contract_updater import smart_contract_build_loop

def main():
    parser = argparse.ArgumentParser(description="Test the smart contract build loop functionality")
    parser.add_argument("contract_type", choices=["escrow", "token_vesting", "crowdfunding"], 
                        help="Type of contract to generate")
    parser.add_argument("--schema", "-s", help="Path to JSON schema file (optional)")
    parser.add_argument("--max-attempts", type=int, default=3, 
                        help="Maximum build attempts (default: 3)")
    
    args = parser.parse_args()
    
    print(f"Starting smart contract build loop for {args.contract_type} contract...")
    
    # Load schema if provided, or use default empty schema
    schema = {}
    if args.schema:
        try:
            with open(args.schema, 'r') as f:
                schema = json.load(f)
            print(f"Loaded schema from {args.schema}")
        except Exception as e:
            print(f"Error loading schema: {e}")
            return 1
    
    # Run the build loop
    success, program_id = smart_contract_build_loop(
        contract_type=args.contract_type,
        schema=schema,
        max_attempts=args.max_attempts
    )
    
    if not success:
        print("Build loop failed to produce a working contract")
        return 1
    
    # Get the path to the lib.rs file
    root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    lib_rs_path = root_dir / "deploy" / "programs" / "deploy" / "src" / "lib.rs"
    
    print(f"Build loop completed successfully!")
    print(f"Program ID: {program_id}")
    print(f"Contract written to: {lib_rs_path}")
    print("")
    print("To manually deploy the contract, use:")
    print("  cd deploy")
    print("  anchor deploy")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 