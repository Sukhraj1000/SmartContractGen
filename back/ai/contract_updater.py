import json
import os
import sys
import re
import subprocess
from pathlib import Path
from ai.ai_client import client, get_ai_client, extract_code_from_ai_response, extract_program_id_from_deployed_contract
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.contract_generator import get_template_for_contract_type, generate_smart_contract

BASE_DIR = os.path.abspath(os.path.dirname(__file__)) 

CONFIG_FILE = os.path.join(BASE_DIR, "../../back/test-config.json")  
CONTRACT_OUTPUT_PATH = os.path.join(BASE_DIR, "../../deploy/programs/deploy/src/lib.rs")
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary placeholder ID

def update_contract(contract_type, contract_code, update_requirements, output_path=None):
    """Update Solana smart contract using AI.
    
    Args:
        contract_type: Type of contract (escrow, crowdfunding)
        contract_code: Existing contract code
        update_requirements: Requirements for the update
        output_path: Path to save the updated contract
        
    Returns:
        Updated contract code
    """
    try:
        # Add parent dir to path to allow local imports
        import sys, os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Find programme ID to use
        program_id = extract_program_id_from_contract(contract_code) or extract_program_id_from_deployed_contract()
        if program_id:
            print(f"Using programme ID: {program_id}")
        else:
            # Default to a placeholder ID if none found
            program_id = "8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg"
            print(f"No programme ID found, using default: {program_id}")
        
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
        
        # Prepare registry integration code if not already present
        registry_interface_code = f"""
// Registry integration code
pub const REGISTRY_PROGRAM_ID: &str = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";
pub const REGISTRY_TRANSACTION_SEED: &str = "transaction_v1";

// Structure for Registry transaction data
#[derive(AnchorSerialize)]
pub struct RegistryTransactionData {{
    pub tx_type: String,
    pub amount: u64, 
    pub initiator: Pubkey,
    pub target_account: Pubkey,
    pub description: String,
}}
        """
        
        # Construct prompt for the AI model
        prompt = f"""
        Update the following Solana smart contract using the Anchor framework with these requirements:
        
        Contract Type: {contract_type}
        Update Requirements: {update_requirements}
        Programme ID to use: {program_id}
        
        # CRITICAL TYPE SAFETY REQUIREMENTS
        1. ALWAYS use checked maths operations (checked_add, checked_sub, etc.)
        2. ALWAYS convert between i64 and u64 using try_into().unwrap() for timestamp comparisons
        3. NEVER use unwrap() on Option/Result types except for try_into() conversions
        4. ALWAYS handle Option/Result using ok_or() with proper error types
        5. Use proper error handling with custom error types
        
        # CRITICAL STACK SIZE REQUIREMENTS
        1. NEVER create large arrays or buffers on the stack
        2. ALWAYS use references instead of moving large data structures
        3. Keep struct sizes minimal with smallest possible types
        4. Split large functions into smaller ones
        5. Use &[u8] instead of Vec<u8> for large byte arrays
        
        # CRITICAL ANCHOR STRUCTURE REQUIREMENTS
        1. NEVER remove or change #[derive(Accounts)] attribute
        2. NEVER remove the #[account] attribute from account structs that store state
        3. ALWAYS maintain SIZE constants for account structs
        4. DO NOT modify instruction parameter passing (#[instruction(...)]) unless requested
        5. PRESERVE 'info lifetime parameters in account validation structs
        6. KEEP using Context<YourStruct> as first parameter in instruction functions
        7. MAINTAIN system_program accounts in contexts that need them
        8. PRESERVE security validation like require!() for input validation
        9. KEEP proper account constraint attributes (#[account(...)])
        10. DO NOT try to directly implement traits like Bumps manually
        11. KEEP using anchor_lang::prelude::* import for Anchor-specific types
        12. Access bumps using ctx.bumps.account_name syntax
        
        # PROGRAMME ID REQUIREMENT
        You MUST keep or update the programme ID to: {program_id}
        Make sure the declare_id! macro is present with this exact ID.
        
        # SECURITY REQUIREMENTS (HIGHEST PRIORITY)
        1. DO NOT remove or weaken any existing security checks
        2. MAINTAIN all access control (signer verification, owner checks, authority validation)
        3. PRESERVE constraint attributes for accounts (has_one, seeds, bump)
        4. KEEP all owner checks for mutable accounts
        5. MAINTAIN checked maths operations to prevent overflows/underflows
        6. PRESERVE secure PDA derivation with seeds and bump
        7. DO NOT remove security validation before state changes or lamport transfers
        8. KEEP explicit bump access using ctx.bumps.account_name pattern
        
        {template_instruction}
        
        {registry_interface_code}
        
        # REGISTRY INTEROPERABILITY REQUIREMENTS - MUST IMPLEMENT
        Your contract MUST interoperate with a pre-deployed Registry programme that tracks transactions.
        The Registry contract has a fixed Programme ID of "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn" which must never change.
        
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
        
        # Ensure programme ID is correctly set
        if program_id not in updated_contract_code:
            print(f"Warning: Programme ID not properly inserted. Adding it now...")
            # Add or replace the programme ID in the contract
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
    """Extract programme ID from contract code.
    
    Args:
        contract_code: Contract code to extract from
        
    Returns:
        Extracted programme ID or None if not found
    """
    try:
        if not contract_code:
            return None
            
        # Look for programme ID in declare_id! macro
        match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', contract_code)
        if match:
            return match.group(1)
            
        return None
    except Exception as e:
        print(f"Error extracting programme ID from contract: {str(e)}")
        return None


def integrate_keys_into_contract(contract_code, contract_type, contract_id=None):
    """Improve contract with programme IDs and security enhancements.
    
    Args:
        contract_code: Solana contract code to update
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
    
    # Read programme ID from config file if it exists
    programme_id = None
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                programme_id = config.get("programId")
        except Exception as e:
            print(f"Error reading config file: {str(e)}")
    
    # Generate a mock programme ID if none exists
    if not programme_id:
        import uuid
        programme_id = "".join(str(uuid.uuid4()).split("-"))[:32]
    
    # Add relevant guidance for AI to improve the contract
    improvement_prompt = f"""
    You are a Solana smart contract expert. I want you to enhance this Anchor-based Solana smart contract by:

    1. Adding or updating the programme ID declaration to use: {programme_id}
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
    """Implement loop between generating code and running anchor build.
    
    Args:
        contract_type: Type of contract (escrow, crowdfunding)
        schema: JSON schema of contract structure
        max_attempts: Maximum build attempts before giving up
        
    Returns:
        Success status and programme ID if successful
    """
    # Force unbuffered output for real-time logs
    import sys, os, subprocess, re, time
    from pathlib import Path
    
    # Add parent dir to path to allow local imports
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    from ai.contract_generator import generate_smart_contract
    
    # Define paths
    root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    deploy_dir = root_dir / "deploy"
    deploy_programs_dir = deploy_dir / "programs" / "deploy" / "src"
    lib_rs_path = deploy_programs_dir / "lib.rs"
    
    # Ensure the target directory exists
    os.makedirs(deploy_programs_dir, exist_ok=True)
    
    # Quietly set up environment
    _setup_build_environment(deploy_dir)
    
    attempt = 0
    programme_id = None
    error_log = ""
    
    print(f"Starting smart contract build loop for {contract_type} contract...")
    
    while attempt < max_attempts:
        attempt += 1
        print(f"\n--- Build Attempt {attempt}/{max_attempts} ---")
        
        # Generate or update contract
        if attempt == 1:
            contract_code = generate_smart_contract(
                contract_type=contract_type,
                schema=schema,
                output_path=str(lib_rs_path)
            )
        else:
            contract_code = _update_contract_with_errors(lib_rs_path, contract_type, attempt, error_log)
        
        if not contract_code:
            print(f"Failed to generate/update contract on attempt {attempt}")
            continue
        
        # Run anchor build (quietly)
        try:
            print("Running anchor build...")
            os.chdir(deploy_dir)
            
            # Clean previous build artifacts silently
            subprocess.run(
                ["cargo", "clean"],
                capture_output=True,
                text=True
            )
            
            # Run the build silently
            build_result = subprocess.run(
                ["anchor", "build"],
                capture_output=True,
                text=True
            )
            
            # Check for build success
            if build_result.returncode == 0:
                print("Build successful!")
                
                # Extract programme ID (quietly)
                programme_id = _extract_program_id(deploy_dir, lib_rs_path)
                if programme_id:
                    print(f"Extracted programme ID: {programme_id}")
                
                return True, programme_id
            
            # If build failed, extract error summary
            error_log = build_result.stderr
            if not error_log:
                error_log = build_result.stdout
            
            # Only show a concise error summary
            error_summary = _extract_error_summary(error_log)
            print(f"Build failed. Error summary:\n{error_summary}")
            
            # Apply automatic fixes for common errors
            _apply_automatic_fixes(lib_rs_path, error_log)
                        
        except Exception as e:
            import traceback
            print(f"Error in build process: {str(e)}")
            error_log = f"Exception occurred: {str(e)}"
        
        finally:
            # Return to original directory
            os.chdir(root_dir)
    
    print(f"Maximum attempts ({max_attempts}) reached without successful build")
    return False, programme_id


def _setup_build_environment(deploy_dir):
    """Set up build environment silently."""
    import os
    
    # Set up Anchor.toml
    anchor_toml_path = deploy_dir / "Anchor.toml"
    if os.path.exists(anchor_toml_path):
        with open(anchor_toml_path, 'r') as f:
            anchor_toml = f.read()
        
        # Check if idl-build feature is missing
        if 'idl-build' not in anchor_toml:
            anchor_toml = anchor_toml.replace(
                "[features]", 
                "[features]\nidl-build = true"
            )
            with open(anchor_toml_path, 'w') as f:
                f.write(anchor_toml)
    
    # Set up Cargo.toml
    cargo_toml_path = deploy_dir / "programs" / "deploy" / "Cargo.toml"
    if os.path.exists(cargo_toml_path):
        with open(cargo_toml_path, 'r') as f:
            cargo_toml = f.read()
        
        # Add necessary features
        if 'idl-build' not in cargo_toml:
            cargo_toml = cargo_toml.replace(
                "[features]",
                "[features]\nidl-build = [\"anchor-lang/idl-build\"]"
            )
        
        if 'init-if-needed' not in cargo_toml:
            cargo_toml = cargo_toml.replace(
                "anchor-lang = { workspace = true }",
                "anchor-lang = { workspace = true, features = [\"init-if-needed\"] }"
            )
        
        # Add optimization settings for stack size if missing
        if '[profile.release]' not in cargo_toml:
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


def _update_contract_with_errors(lib_rs_path, contract_type, attempt, error_log):
    """Update contract based on previous errors."""
    import os, re
    
    if not os.path.exists(lib_rs_path):
        return None
    
    with open(lib_rs_path, 'r') as f:
        contract_code = f.read()
    
    if not contract_code:
        return None
    
    # Extract programme ID if it exists
    extracted_id = extract_program_id_from_contract(contract_code)
    
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
        
    if "cannot use the `?` operator" in error_log or "E0277" in error_log:
        specific_instructions += """
        1. CRITICAL: Remove any usage of the ? operator in methods that don't return Result or Option
        2. Inside #[derive(Accounts)] structs, do not use the ? operator
        3. Replace Clock::get()? with Clock::get().expect("Failed to get clock")
        4. Only use ? operator in functions that return Result<T, E>
        """
    
    if "E0382" in error_log or "borrow of moved value" in error_log:
        specific_instructions += """
        1. Add .clone() to all String values that are used after being moved
        2. Use references (&value) instead of moving values where possible
        3. When assigning a String to a struct field, always clone() it if used later
        """
    
    # Update contract with error messages and specific instructions
    update_req = f"Fix compilation errors from attempt {attempt-1}.\nMain errors: {error_log}"
    if specific_instructions:
        update_req += f"\n\nSpecific fixes needed:\n{specific_instructions}"
    
    print("Attempting to fix compilation errors...")
    
    return update_contract(
        contract_type=contract_type,
        contract_code=contract_code,
        update_requirements=update_req,
        output_path=str(lib_rs_path)
    )


def _extract_program_id(deploy_dir, lib_rs_path):
    """Extract programme ID from keypair silently."""
    import os, subprocess, re
    
    try:
        keypair_path = os.path.join(deploy_dir, "target", "deploy", "deploy-keypair.json")
        if os.path.exists(keypair_path):
            result = subprocess.run(
                ["solana", "address", "-k", keypair_path],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                programme_id = result.stdout.strip()
                
                # Update the contract with the correct programme ID if needed
                if programme_id and os.path.exists(lib_rs_path):
                    with open(lib_rs_path, 'r') as f:
                        current_code = f.read()
                    
                    if f'declare_id!("{programme_id}");' not in current_code:
                        # Replace programme ID in the contract
                        updated_code = re.sub(
                            r'declare_id!\("([^"]*)"\);',
                            f'declare_id!("{programme_id}");',
                            current_code
                        )
                        
                        # If no declare_id! found, add it after imports
                        if "declare_id!" not in updated_code:
                            import_end = updated_code.find(";") + 1
                            updated_code = updated_code[:import_end] + f'\n\ndeclare_id!("{programme_id}");\n\n' + updated_code[import_end:]
                        
                        with open(lib_rs_path, 'w') as f:
                            f.write(updated_code)
                        
                        # Build again with the correct programme ID (silently)
                        subprocess.run(
                            ["anchor", "build"],
                            capture_output=True,
                            text=True
                        )
                
                # Store info in json file
                info_path = os.path.join(deploy_dir, "program-info.json")
                import json, time
                with open(info_path, 'w') as f:
                    json.dump({
                        "programId": programme_id,
                        "contractType": os.path.basename(lib_rs_path).replace(".rs", ""),
                        "buildTime": time.strftime("%Y-%m-%d %H:%M:%S")
                    }, f, indent=2)
                
                return programme_id
    except Exception as e:
        print(f"Error extracting programme ID: {str(e)}")
    
    return None


def _extract_error_summary(error_log):
    """Extract concise summary of errors from build output."""
    import re
    
    error_summary = ""
    
    # Find Rust compiler errors - most critical
    rust_errors = re.findall(r'error\[E\d+\]:.*?(?=warning:|error:|$)', error_log, re.DOTALL)
    if rust_errors:
        error_summary += "Rust compiler errors:\n"
        for error in rust_errors[:3]:  # Only show top 3 errors
            error_summary += error.strip() + "\n"
    
    # Find error messages without showing all build output
    lines = error_log.split('\n')
    error_lines = []
    for i, line in enumerate(lines):
        if 'error:' in line.lower() and '--->' in line:
            # Found an error indicator line
            start = max(0, i-1)
            end = min(len(lines), i+3)
            error_lines.extend(lines[start:end])
    
    if error_lines:
        error_summary += "\nError locations:\n" + "\n".join(error_lines[:6])  # Limit to 6 lines
    
    # Categorize errors for targeted fixes
    error_categories = {
        'stack_size': ['Stack offset', 'exceeded max offset', 'stack usage'],
        'type_safety': ['mismatched types', 'expected `i64`', 'expected `u64`', 'overflow', 'underflow'],
        'borrow_check': ['borrow of moved value', 'E0382'],
        'question_mark': ['E0277', 'cannot use the `?` operator', 'FromResidual'],
        'anchor_issues': ['missing lifetime', 'trait `Bumps`', 'try_accounts', 'no method named `get`']
    }
    
    # Identify error categories present
    detected_categories = []
    for category, patterns in error_categories.items():
        if any(pattern in error_log for pattern in patterns):
            detected_categories.append(category)
    
    if detected_categories:
        error_summary += "\nDetected error categories: " + ", ".join(detected_categories)
    
    return error_summary


def _apply_automatic_fixes(lib_rs_path, error_log):
    """Apply automatic fixes for common errors."""
    import os, re
    
    # Categorize errors
    error_categories = {
        'question_mark': ['E0277', 'cannot use the `?` operator', 'FromResidual'],
        'borrow_check': ['borrow of moved value', 'E0382']
    }
    
    # Check for question mark operator errors
    if any(pattern in error_log for pattern in error_categories['question_mark']):
        print("Attempting to fix ? operator issues...")
        with open(lib_rs_path, 'r') as f:
            contract_code = f.read()
        
        # Replace Clock::get()? with Clock::get().expect(...)
        contract_code = re.sub(
            r'Clock::get\(\)\?',
            r'Clock::get().expect("Failed to get clock")',
            contract_code
        )
        
        with open(lib_rs_path, 'w') as f:
            f.write(contract_code)
    
    # Check for borrow/move errors
    if any(pattern in error_log for pattern in error_categories['borrow_check']):
        print("Attempting to fix string ownership issues...")
        with open(lib_rs_path, 'r') as f:
            contract_code = f.read()
        
        # Find string assignments and add .clone()
        string_assignments = re.findall(r'(\w+)\.(\w+)\s*=\s*(\w+);', contract_code)
        for assignment in string_assignments:
            struct_var, field, value = assignment
            if f'{struct_var}.{field} = {value}.clone();' not in contract_code:
                old_pattern = f'{struct_var}.{field} = {value};'
                new_pattern = f'{struct_var}.{field} = {value}.clone();'
                contract_code = contract_code.replace(old_pattern, new_pattern)
        
        with open(lib_rs_path, 'w') as f:
            f.write(contract_code)


def deploy_contract_from_loop(programme_id, contract_type, network="devnet"):
    """Deploy contract built in the smart_contract_build_loop.
    
    Args:
        programme_id: Programme ID from build loop
        contract_type: Type of contract (escrow, crowdfunding)
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
        
        print(f"Successfully deployed {contract_type} contract with programme ID: {programme_id}")
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