#!/usr/bin/env python3
"""
Automation script for smart contract generation, building, and deployment.
This script ties together the various components of the system to provide a smooth
end-to-end experience for smart contract development.

The script supports:
1. Generating new contracts from templates
2. Updating existing contracts
3. Running the full automation pipeline
4. Running the build loop for intelligent generation and fixing
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import local modules
from ai.automation import ContractAutomation
from ai.contract_generator import generate_smart_contract
from ai.contract_updater import update_contract, smart_contract_build_loop

def main():
    """Main function to handle CLI commands.
    
    This function:
    1. Parses command line arguments
    2. Executes the requested command
    3. Returns appropriate exit codes
    
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    parser = argparse.ArgumentParser(
        description="Smart Contract Automation Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Generate a new contract:
    python automate_contract.py generate escrow --schema schema.json
    
  Update an existing contract:
    python automate_contract.py update deploy/programs/deploy/src/lib.rs token_vesting "Add withdrawal fee functionality"
    
  Run the full automation pipeline:
    python automate_contract.py automate escrow --schema schema.json --deploy
    
  Run the build loop for intelligent generation and fixing:
    python automate_contract.py buildloop escrow --schema schema.json --deploy --network devnet
"""
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate a new smart contract")
    gen_parser.add_argument("contract_type", help="Type of contract (escrow, token_vesting, crowdfunding)")
    gen_parser.add_argument("--schema", "-s", help="Path to JSON schema file (optional)")
    gen_parser.add_argument("--output", "-o", help="Output path for the generated contract")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Update an existing smart contract")
    update_parser.add_argument("contract_path", help="Path to the existing contract file")
    update_parser.add_argument("contract_type", help="Type of contract (escrow, token_vesting, crowdfunding)")
    update_parser.add_argument("requirements", help="Requirements for the update")
    update_parser.add_argument("--output", "-o", help="Output path for the updated contract")
    
    # Automate command (full pipeline)
    auto_parser = subparsers.add_parser("automate", help="Run the full automation pipeline")
    auto_parser.add_argument("contract_type", help="Type of contract (escrow, token_vesting, crowdfunding)")
    auto_parser.add_argument("--schema", "-s", help="Path to JSON schema file (optional)")
    auto_parser.add_argument("--deploy", action="store_true", help="Deploy automatically after generation")
    
    # Build loop command (intelligent generation and fixing)
    buildloop_parser = subparsers.add_parser("buildloop", help="Run the smart contract build loop with intelligent fixing")
    buildloop_parser.add_argument("contract_type", help="Type of contract (escrow, token_vesting, crowdfunding)")
    buildloop_parser.add_argument("--schema", "-s", help="Path to JSON schema file (optional)")
    buildloop_parser.add_argument("--max-attempts", type=int, default=5, help="Maximum number of build attempts")
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Handle generate command
    if args.command == "generate":
        schema = {}
        if args.schema:
            with open(args.schema, 'r') as f:
                schema = json.load(f)
        
        contract_code = generate_smart_contract(
            contract_type=args.contract_type,
            schema=schema,
            output_path=args.output
        )
        
        if contract_code:
            print("Contract generation completed successfully")
            return 0
        else:
            print("Contract generation failed")
            return 1
    
    # Handle update command
    elif args.command == "update":
        with open(args.contract_path, 'r') as f:
            contract_code = f.read()
        
        updated_code = update_contract(
            contract_type=args.contract_type,
            contract_code=contract_code,
            update_requirements=args.requirements,
            output_path=args.output
        )
        
        if updated_code:
            print("Contract update completed successfully")
            return 0
        else:
            print("Contract update failed")
            return 1
    
    # Handle automate command (full pipeline)
    elif args.command == "automate":
        schema = {}
        if args.schema:
            with open(args.schema, 'r') as f:
                schema = json.load(f)
        
        automation = ContractAutomation()
        success = automation.run_automation(args.contract_type, schema)
        
        if success:
            print("Automation completed successfully")
            return 0
        else:
            print("Automation failed")
            return 1
            
    # Handle buildloop command (intelligent generation and fixing)
    elif args.command == "buildloop":
        schema = {}
        if args.schema:
            with open(args.schema, 'r') as f:
                schema = json.load(f)
        
        print(f"Starting smart contract build loop for {args.contract_type}...")
        success, program_id = smart_contract_build_loop(
            contract_type=args.contract_type,
            schema=schema,
            max_attempts=args.max_attempts
        )
        
        if success and program_id:
            # Get the path to the lib.rs file
            root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            lib_rs_path = root_dir / "deploy" / "programs" / "deploy" / "src" / "lib.rs"
            
            print(f"Build loop completed successfully with program ID: {program_id}")
            print(f"Contract written to: {lib_rs_path}")
            print("\nTo manually deploy the contract, use:")
            print("  cd deploy")
            print("  anchor deploy")
            return 0
        else:
            print("Build loop failed to produce a working contract")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 