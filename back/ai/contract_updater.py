import json
import os
import sys
import re
import subprocess
from pathlib import Path
from ai.ai_client import client
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.contract_generator import extract_code_from_ai_response, get_ai_client, get_template_for_contract_type, generate_smart_contract

BASE_DIR = os.path.abspath(os.path.dirname(__file__)) 

CONFIG_FILE = os.path.join(BASE_DIR, "../../back/test-config.json")  
CONTRACT_OUTPUT_PATH = os.path.join(BASE_DIR, "../../deploy/programs/deploy/src/lib.rs")
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary placeholder ID


def get_ai_client():
    """Get the AI client."""
    return client


def extract_code_from_ai_response(response):
    """Extract code from the AI response."""
    if not response or not response.content or not isinstance(response.content, list):
        print("AI Response error: No valid content received")
        return None
        
    contract_code = response.content[0].text.strip()
    
    # Remove code block markers if present
    contract_code = contract_code.replace("```rust", "").replace("```", "").strip()
    
    if not contract_code:
        print("AI contract update failed: Empty contract received")
        return None
        
    return contract_code


def update_contract(contract_type, contract_code, update_requirements, output_path=None):
    """
    Update an existing Solana smart contract using AI.
    
    Args:
        contract_type: Type of contract (escrow, token_vesting, crowdfunding)
        contract_code: The existing contract code
        update_requirements: Requirements for the update
        output_path: Path to save the updated contract
        
    Returns:
        The updated contract code
    """
    try:
        # Add parent dir to path to allow local imports
        import sys, os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Try to find a program ID to use (or extract from provided contract)
        program_id = extract_program_id_from_contract(contract_code) or extract_program_id_from_deployed_contract()
        if program_id:
            print(f"Using program ID: {program_id}")
        else:
            # Default to a placeholder ID if none found
            program_id = "8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg"
            print(f"No program ID found, using default: {program_id}")
        
        # Get a reference template for the contract type
        template_code = get_template_for_contract_type(contract_type)
        template_instruction = ""
        
        if template_code:
            template_instruction = f"""
            # REFERENCE TEMPLATE
            Below is a reference template for a {contract_type} contract with proper Anchor structure.
            Your implementation should follow this pattern when making updates:
            
            ```rust
            {template_code}
            ```
            """
        
        # Construct prompt for the AI model
        prompt = f"""
        Update the following Solana smart contract using the Anchor framework with these requirements:
        
        Contract Type: {contract_type}
        Update Requirements: {update_requirements}
        Program ID to use: {program_id}
        
        # EXISTING CONTRACT CODE
        ```rust
        {contract_code}
        ```
        
        # CRITICAL ANCHOR STRUCTURE REQUIREMENTS - PRESERVE THESE
        1. NEVER remove or change the #[derive(Accounts)] attribute from account validation structs
        2. NEVER remove the #[account] attribute from data account structs that store state
        3. ALWAYS maintain SIZE constants for account structs to calculate space requirements
        4. DO NOT modify instruction parameter passing (#[instruction(...)]) unless specifically requested
        5. PRESERVE 'info lifetime parameters (e.g., 'info) in all account validation structs
        6. KEEP using Context<YourStruct> as the first parameter in instruction functions
        7. MAINTAIN system_program accounts in contexts that need them
        8. PRESERVE security validation functions like require!() for input validation
        9. KEEP proper account constraint attributes (#[account(...)])
        10. DO NOT try to directly implement traits like Bumps manually 
        11. KEEP using anchor_lang::prelude::* import for Anchor-specific types
        
        # PROGRAM ID REQUIREMENT
        You MUST keep or update the program ID in the contract to: {program_id}
        Make sure the declare_id! macro is present with this exact ID.
        
        # COMMON ERRORS TO AVOID - DO NOT INTRODUCE THESE
        1. Error "the trait Bumps is not implemented": This would happen if you remove #[derive(Accounts)] macro
        2. Error "no function or associated item named try_accounts": This would happen if #[derive(Accounts)] is missing
        3. Error "missing lifetime specifier": Account validation structs must keep the 'info lifetime parameter
        4. Error "bump targets should not be provided with init": Use `bump` instead of `bump = bump` in init constraints
        5. Never use `bump = bump` in account constraints. Use just `bump` instead.
        
        {template_instruction}
        
        # SECURITY REQUIREMENTS (HIGHEST PRIORITY)
        1. DO NOT remove or weaken any existing security checks
        2. MAINTAIN all access control - signer verification, owner checks, and authority validation
        3. PRESERVE constraint attributes for all accounts (has_one, seeds, bump)
        4. KEEP all owner checks for mutable accounts
        5. MAINTAIN checked math operations to prevent overflows/underflows
        6. PRESERVE secure PDA derivation with seeds and bump
        7. DO NOT remove security validation before state changes or lamport transfers
        8. KEEP explicit bump access using ctx.bumps.account_name pattern

        Return ONLY the complete updated Rust contract code without explanations outside the code.
        """
        
        # Call the AI client to update the contract
        print(f"Updating {contract_type} contract...")
        ai_client = get_ai_client()
        response = ai_client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract the updated contract code
        updated_contract_code = extract_code_from_ai_response(response)
        
        # Ensure program ID is correctly set
        if program_id not in updated_contract_code:
            print(f"Warning: Program ID was not properly inserted. Adding it now...")
            # Add or replace the program ID in the contract
            if "declare_id!" in updated_contract_code:
                import re
                updated_contract_code = re.sub(
                    r'declare_id!\("([^"]*)"\);',
                    f'declare_id!("{program_id}");',
                    updated_contract_code
                )
            else:
                # Add it after the imports
                import_end = updated_contract_code.find(";") + 1
                updated_contract_code = updated_contract_code[:import_end] + f"\n\ndeclare_id!(\"{program_id}\");\n\n" + updated_contract_code[import_end:]
        
        # Always set default output path to the standard Anchor lib.rs location
        default_output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                              "deploy", "programs", "deploy", "src", "lib.rs")
        
        # Use provided output path or default to Anchor location
        final_output_path = output_path or default_output_path
        os.makedirs(os.path.dirname(final_output_path), exist_ok=True)
        
        # Save the updated contract code to a file
        with open(final_output_path, "w") as f:
            f.write(updated_contract_code)
        
        print(f"Updated contract saved to {final_output_path}")
        
        # Always make sure the lib.rs is updated in the standard location
        if final_output_path != default_output_path:
            os.makedirs(os.path.dirname(default_output_path), exist_ok=True)
            with open(default_output_path, "w") as f:
                f.write(updated_contract_code)
            print(f"Updated contract also saved to standard deploy path: {default_output_path}")
        
        return updated_contract_code
        
    except Exception as e:
        import traceback
        print(f"Error updating contract: {str(e)}")
        print(traceback.format_exc())
        return None


def extract_program_id_from_contract(contract_code):
    """
    Extract the program ID from the contract code if it exists.
    
    Args:
        contract_code: The contract code to extract from
        
    Returns:
        The extracted program ID or None if not found
    """
    try:
        if not contract_code:
            return None
            
        # Look for program ID in declare_id! macro
        match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', contract_code)
        if match:
            return match.group(1)
            
        return None
    except Exception as e:
        print(f"Error extracting program ID from contract: {str(e)}")
        return None


def extract_program_id_from_deployed_contract():
    """
    Extract the program ID from a deployed contract by reading Solana CLI output
    or deployment files.
    
    Returns:
        The program ID as a string, or None if not found
    """
    try:
        # Method 1: Try to read from program-info.json
        program_info_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                  "deploy", "program-info.json")
        if os.path.exists(program_info_file):
            with open(program_info_file, "r") as f:
                program_info = json.load(f)
                if "programId" in program_info:
                    return program_info["programId"]
        
        # Method 2: Try to extract from the declare_id! in the lib.rs file
        deploy_lib_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                "deploy", "programs", "deploy", "src", "lib.rs")
        if os.path.exists(deploy_lib_path):
            with open(deploy_lib_path, "r") as f:
                content = f.read()
                match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', content)
                if match:
                    return match.group(1)
        
        # Method 3: Try to find the keypair file and get the pubkey
        keypair_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                              "deploy", "target", "deploy", "deploy-keypair.json")
        if os.path.exists(keypair_path):
            try:
                # Use solana-keygen to derive pubkey from keypair
                from subprocess import check_output
                output = check_output(["solana-keygen", "pubkey", keypair_path], text=True)
                return output.strip()
            except Exception as e:
                print(f"Error getting pubkey from keypair: {str(e)}")
        
        print("No existing program ID found, will use default")
        return None
    except Exception as e:
        print(f"Error extracting program ID: {str(e)}")
        return None


def integrate_keys_into_contract(contract_code, contract_type, contract_id=None):
    """
    Improves the contract by incorporating program IDs and security improvements.
    
    Args:
        contract_code: The Solana contract code to update
        contract_type: Type of contract (escrow, etc.)
        contract_id: Optional identifier for the contract
        
    Returns:
        Updated contract code
    """
    import os  # Add missing import at the function level
    import json  # Add missing import for JSON handling
    
    if not contract_code:
        print("Error: No contract code provided")
        return None
    
    # Read program ID from config file if it exists
    program_id = None
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                program_id = config.get("programId")
        except Exception as e:
            print(f"Error reading config file: {str(e)}")
    
    # Generate a mock program ID if none exists
    if not program_id:
        import uuid
        program_id = "".join(str(uuid.uuid4()).split("-"))[:32]
    
    # Add relevant guidance for AI to improve the contract
    improvement_prompt = f"""
    You are a Solana smart contract expert. I want you to enhance this Anchor-based Solana smart contract by:

    1. Adding or updating the program ID declaration to use: {program_id}
    2. Improving security by adding proper validation checks
    3. Adding better error handling 
    4. Making any other improvements that make it production-ready
    5. Leave all the core functionality intact
    
    Contract type: {contract_type}
    
    Here's the contract to improve:
    
    ```rust
    {contract_code}
    ```
    
    Return just the improved contract code, without any explanation or markdown formatting.
    """
    
    try:
        # Add parent dir to path to allow local imports
        import sys, os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Create temp directory for output if needed
        if contract_id:
            output_dir = os.path.join(os.path.dirname(BASE_DIR), "..", "contracts", contract_id)
            os.makedirs(output_dir, exist_ok=True)
        
        # Get AI response
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.3,
            messages=[{"role": "user", "content": improvement_prompt}]
        )
        
        if not response or not response.content or not isinstance(response.content, list):
            print("AI Response error: No valid content received")
            return None
            
        improved_contract = response.content[0].text.strip()
        
        # Clean up the response - remove markdown code blocks if present
        improved_contract = improved_contract.replace("```rust", "").replace("```", "").strip()
        
        # Save the improved contract if contract_id provided
        if contract_id and improved_contract:
            output_dir = os.path.join(os.path.dirname(BASE_DIR), "..", "contracts", contract_id)
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "updated_contract.rs")
            with open(output_file, "w") as f:
                f.write(improved_contract)
            print(f"Updated contract saved to {output_file}")
        
        return improved_contract
    
    except Exception as e:
        import traceback
        print(f"Error updating contract: {str(e)}")
        print(traceback.format_exc())
        return None


def smart_contract_build_loop(contract_type, schema, max_attempts=5):
    """
    Implements a loop between generating smart contract code and running anchor build 
    until a successful build is achieved.
    
    Args:
        contract_type: Type of contract (escrow, token_vesting, crowdfunding)
        schema: JSON schema of the contract structure
        max_attempts: Maximum number of build attempts before giving up
        
    Returns:
        Tuple of (success status, program_id)
    """
    # Add parent dir to path to allow local imports
    import sys, os, subprocess, re
    from pathlib import Path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    from ai.contract_generator import generate_smart_contract
    
    # Define paths
    root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    deploy_dir = root_dir / "deploy"
    deploy_programs_dir = deploy_dir / "programs" / "deploy" / "src"
    lib_rs_path = deploy_programs_dir / "lib.rs"
    
    # Ensure the target directory exists
    os.makedirs(deploy_programs_dir, exist_ok=True)
    
    # Pre-process: Ensure Anchor.toml has required features
    anchor_toml_path = deploy_dir / "Anchor.toml"
    if os.path.exists(anchor_toml_path):
        with open(anchor_toml_path, 'r') as f:
            anchor_toml = f.read()
        
        # Check if idl-build feature is missing
        if 'idl-build' not in anchor_toml:
            print("Adding idl-build feature to Anchor.toml")
            anchor_toml = anchor_toml.replace(
                "[features]", 
                "[features]\nidl-build = true"
            )
            with open(anchor_toml_path, 'w') as f:
                f.write(anchor_toml)
    
    # Pre-process: Ensure Cargo.toml has required features
    cargo_toml_path = deploy_dir / "programs" / "deploy" / "Cargo.toml"
    if os.path.exists(cargo_toml_path):
        with open(cargo_toml_path, 'r') as f:
            cargo_toml = f.read()
        
        # Add idl-build feature if missing
        if 'idl-build' not in cargo_toml:
            print("Adding idl-build feature to Cargo.toml")
            cargo_toml = cargo_toml.replace(
                "[features]",
                "[features]\nidl-build = [\"anchor-lang/idl-build\"]"
            )
        
        # Ensure anchor-lang has init-if-needed feature
        if 'init-if-needed' not in cargo_toml:
            print("Adding init-if-needed feature to anchor-lang")
            cargo_toml = cargo_toml.replace(
                "anchor-lang = { workspace = true }",
                "anchor-lang = { workspace = true, features = [\"init-if-needed\"] }"
            )
        
        # Add optimization settings for stack size if missing
        if '[profile.release]' not in cargo_toml:
            print("Adding stack size optimization to Cargo.toml")
            cargo_toml += """
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
"""
        with open(cargo_toml_path, 'w') as f:
            f.write(cargo_toml)
    
    attempt = 0
    program_id = None
    error_log = ""
    
    print(f"Starting smart contract build loop for {contract_type} contract...")
    
    while attempt < max_attempts:
        attempt += 1
        print(f"\n--- Build Attempt {attempt}/{max_attempts} ---")
        
        # 1. Generate or update contract
        if attempt == 1:
            # First attempt - generate a new contract
            contract_code = generate_smart_contract(
                contract_type=contract_type,
                schema=schema,
                output_path=str(lib_rs_path)
            )
        else:
            # Subsequent attempts - update based on error logs
            contract_code = None
            if os.path.exists(lib_rs_path):
                with open(lib_rs_path, 'r') as f:
                    contract_code = f.read()
                
                if contract_code:
                    # Extract program ID if it exists
                    extracted_id = extract_program_id_from_contract(contract_code)
                    if extracted_id:
                        program_id = extracted_id
                    
                    # Add specific error handling instructions based on previous errors
                    specific_instructions = ""
                    if "Stack offset" in error_log or "exceeded max offset" in error_log:
                        specific_instructions += """
                        1. Minimize large stack variables in all functions
                        2. Split large structs into smaller components
                        3. Remove any unnecessary large arrays or buffers
                        4. Use references instead of copying large data structures
                        """
                    
                    if "idl-build" in error_log:
                        specific_instructions += """
                        Ensure all features are properly defined and imported.
                        """
                    
                    # Update contract with error messages and specific instructions
                    update_req = f"Fix compilation errors from attempt {attempt-1}: {error_log}"
                    if specific_instructions:
                        update_req += f"\n\nSpecific fixes needed:\n{specific_instructions}"
                    
                    contract_code = update_contract(
                        contract_type=contract_type,
                        contract_code=contract_code,
                        update_requirements=update_req,
                        output_path=str(lib_rs_path)
                    )
        
        if not contract_code:
            print(f"Failed to generate/update contract on attempt {attempt}")
            continue
        
        # 2. Run anchor build
        try:
            print("Running anchor build...")
            os.chdir(deploy_dir)
            
            # Clean previous build artifacts first
            clean_result = subprocess.run(
                ["cargo", "clean"],
                capture_output=True,
                text=True
            )
            
            # Run the build
            build_result = subprocess.run(
                ["anchor", "build"],
                capture_output=True,
                text=True
            )
            
            # 3. Check for build success
            if build_result.returncode == 0:
                print("Build successful!")
                
                # 4. Extract program ID from keypair
                try:
                    keypair_path = os.path.join(deploy_dir, "target", "deploy", "deploy-keypair.json")
                    if os.path.exists(keypair_path):
                        result = subprocess.run(
                            ["solana", "address", "-k", keypair_path],
                            capture_output=True,
                            text=True
                        )
                        if result.returncode == 0:
                            program_id = result.stdout.strip()
                            print(f"Extracted program ID: {program_id}")
                            
                            # Update the contract with the correct program ID if needed
                            if program_id and os.path.exists(lib_rs_path):
                                with open(lib_rs_path, 'r') as f:
                                    current_code = f.read()
                                
                                if f'declare_id!("{program_id}");' not in current_code:
                                    # Replace program ID in the contract
                                    updated_code = re.sub(
                                        r'declare_id!\("([^"]*)"\);',
                                        f'declare_id!("{program_id}");',
                                        current_code
                                    )
                                    
                                    # If no declare_id! found, add it after imports
                                    if "declare_id!" not in updated_code:
                                        import_end = updated_code.find(";") + 1
                                        updated_code = updated_code[:import_end] + f'\n\ndeclare_id!("{program_id}");\n\n' + updated_code[import_end:]
                                    
                                    with open(lib_rs_path, 'w') as f:
                                        f.write(updated_code)
                                    
                                    print(f"Updated contract with correct program ID: {program_id}")
                                    
                                    # Build again with the correct program ID
                                    build_result = subprocess.run(
                                        ["anchor", "build"],
                                        capture_output=True,
                                        text=True
                                    )
                                    
                                    if build_result.returncode != 0:
                                        print("Failed to build after updating program ID. Using previous build.")
                except Exception as e:
                    print(f"Error extracting or updating program ID: {str(e)}")
                    # Continue with the existing program ID if extraction fails
                
                # Store basic program info in a JSON file for reference
                if program_id:
                    info_path = os.path.join(deploy_dir, "program-info.json")
                    with open(info_path, 'w') as f:
                        json.dump({
                            "programId": program_id,
                            "contractType": contract_type,
                            "buildTime": time.strftime("%Y-%m-%d %H:%M:%S")
                        }, f, indent=2)
                
                return True, program_id
            
            # 5. Extract error logs for next attempt
            error_log = build_result.stderr
            if not error_log:
                error_log = build_result.stdout
            
            # Filter to include only relevant error messages
            error_lines = []
            for line in error_log.split('\n'):
                if "error" in line.lower() and not "warning" in line.lower():
                    error_lines.append(line.strip())
            
            error_log = "\n".join(error_lines[-10:])  # Only use the last 10 errors to avoid overwhelming
            print(f"Build failed with errors:\n{error_log}")
            
            # 6. Apply quick fixes for known error types
            if "Stack offset" in error_log or "exceeded max offset" in error_log:
                print("Detected stack size issue, applying quick fixes...")
                with open(lib_rs_path, 'r') as f:
                    contract_code = f.read()
                
                # Add special stack size attributes to structs
                contract_code = re.sub(
                    r'#\[account\](\s+)pub struct ([A-Za-z0-9_]+)',
                    r'#[account]\n#[derive(Default)]\1pub struct \2',
                    contract_code
                )
                
                with open(lib_rs_path, 'w') as f:
                    f.write(contract_code)
            
            if "idl-build feature is missing" in error_log:
                print("Detected missing IDL feature, applying quick fixes...")
                # This was handled in pre-processing but ensure Anchor.toml is updated
                with open(anchor_toml_path, 'r') as f:
                    anchor_toml = f.read()
                
                if 'idl-build = true' not in anchor_toml:
                    anchor_toml = anchor_toml.replace(
                        "[features]", 
                        "[features]\nidl-build = true"
                    )
                    with open(anchor_toml_path, 'w') as f:
                        f.write(anchor_toml)
            
        except Exception as e:
            import traceback
            print(f"Error in build process: {str(e)}")
            print(traceback.format_exc())
            error_log = f"Exception occurred: {str(e)}"
        
        finally:
            # Return to original directory
            os.chdir(root_dir)
    
    print(f"Maximum attempts ({max_attempts}) reached without successful build")
    return False, program_id


def deploy_contract_from_loop(program_id, contract_type, network="devnet"):
    """
    Deploy a contract that was successfully built in the smart_contract_build_loop.
    
    Args:
        program_id: Program ID from the build loop
        contract_type: Type of contract (escrow, token_vesting, crowdfunding)
        network: Network to deploy to (local, devnet, mainnet)
        
    Returns:
        Success status (True/False)
    """
    try:
        # Add parent dir to path to allow local imports
        import sys, os, subprocess
        from pathlib import Path
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Define paths
        root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        deploy_dir = root_dir / "deploy"
        
        # Ensure deploy script is executable
        deploy_script = deploy_dir / "scripts" / "deploy.sh"
        if not os.path.exists(deploy_script):
            print(f"Error: Deploy script not found at {deploy_script}")
            return False
        
        os.chmod(deploy_script, 0o755)
        
        # Run the deploy script with the specified network
        print(f"Deploying {contract_type} contract to {network}...")
        os.chdir(deploy_dir)
        
        # Prepare the command based on network
        if network == "local":
            cmd = ["./scripts/deploy.sh", "--local"]
        elif network == "devnet":
            cmd = ["./scripts/deploy.sh", "--devnet"]
        elif network == "mainnet":
            cmd = ["./scripts/deploy.sh", "--mainnet"]
        else:
            cmd = ["./scripts/deploy.sh", "--devnet"]  # Default to devnet
        
        # Run the deployment
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        
        if result.returncode != 0:
            print(f"Deployment failed: {result.stderr}")
            return False
        
        print(f"Successfully deployed {contract_type} contract with program ID: {program_id}")
        return True
        
    except Exception as e:
        import traceback
        print(f"Error during deployment: {str(e)}")
        print(traceback.format_exc())
        return False
    finally:
        # Return to original directory
        os.chdir(root_dir)

# Command line interface
if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description="Update a Solana smart contract using AI")
    parser.add_argument("contract_path", help="Path to the existing contract file")
    parser.add_argument("contract_type", help="Type of contract (escrow, token_vesting, crowdfunding)")
    parser.add_argument("update_requirements", help="Requirements for the update")
    parser.add_argument("--output", "-o", help="Path to save the updated contract")
    
    args = parser.parse_args()
    
    # Read the existing contract
    with open(args.contract_path, "r") as f:
        contract_code = f.read()
    
    # Update the contract
    updated_contract = update_contract(
        args.contract_type,
        contract_code,
        args.update_requirements,
        args.output
    )
    
    if updated_contract:
        print("Contract update completed successfully")
        sys.exit(0)
    else:
        print("Contract update failed")
        sys.exit(1)