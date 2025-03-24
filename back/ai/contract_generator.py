import json
import sys
import os
from ai.ai_client import client

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTRACT_OUTPUT_PATH = "../deploy/programs/deploy/src/lib.rs"
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary program ID


def get_ai_client():
    """Get the AI client."""
    from ai.ai_client import client
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
        print("AI contract generation failed: Empty contract received")
        return None
        
    return contract_code

def get_template_for_contract_type(contract_type):
    """
    Get a template file for the specified contract type to use as a reference.
    
    Args:
        contract_type: Type of contract (escrow, token_vesting, crowdfunding)
        
    Returns:
        The template contract code or None if not found
    """
    template_paths = {
        "escrow": "templates/escrow_template.rs",
        "token_vesting": "templates/token_vesting_template.rs",
        "crowdfunding": "templates/crowdfunding_template.rs"
    }
    
    if contract_type not in template_paths:
        print(f"No template found for contract type: {contract_type}")
        return None
    
    template_path = os.path.join(os.path.dirname(__file__), "..", template_paths[contract_type])
    
    try:
        with open(template_path, "r") as f:
            return f.read()
    except Exception as e:
        print(f"Error reading template file: {str(e)}")
        return None

def generate_smart_contract(contract_type, schema, output_path=None):
    """
    Generate a Solana smart contract using the Anchor framework.
    
    Args:
        contract_type: Type of contract to generate (escrow, token_vesting, crowdfunding, etc.)
        schema: JSON schema of the contract structure
        output_path: Path to save the generated contract
        
    Returns:
        The generated contract code
    """
    try:
        # Add parent dir to path to allow local imports
        import sys, os, json
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Get a reference template for the contract type
        template_code = get_template_for_contract_type(contract_type)
        template_instruction = ""
        
        if template_code:
            template_instruction = f"""
            # REFERENCE TEMPLATE
            Below is a reference template for a {contract_type} contract with proper Anchor structure.
            Your implementation should follow this pattern but include enhancements based on the requirements:
            
            ```rust
            {template_code}
            ```
            """
        
        # Try to find a program ID to use
        program_id = extract_program_id_from_deployed_contract() or "8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg"
        print(f"Using program ID: {program_id}")
        
        # Convert schema to string
        schema_str = json.dumps(schema, indent=2)
        
        # Get contract-specific requirements
        contract_specific_requirements = {
            "escrow": """
                # ESCROW-SPECIFIC IMPLEMENTATION PATTERNS
                1. Use lamport transfers for handling SOL (using try_borrow_mut_lamports and transfer CPI)
                2. Structure Accounts with initializer, taker, escrow_authority PDA
                3. Support two-phase transactions: initialize and execute/cancel
                4. Store bumps in account data for verification
                5. Include proper release condition validation
            """,
            "token_vesting": """
                # TOKEN_VESTING-SPECIFIC IMPLEMENTATION PATTERNS
                1. Use native SOL for vesting (lamports) instead of SPL tokens
                2. Implement time-locked releases using Solana's Clock sysvar
                3. Include multiple vesting schedules: cliff, linear, or staged
                4. Store vesting schedules and release timestamps in account data
                5. Create separate withdrawal function with proper time validation
                6. Support emergency configurations for admin intervention
            """,
            "crowdfunding": """
                # CROWDFUNDING-SPECIFIC IMPLEMENTATION PATTERNS
                1. Use native SOL contributions instead of tokens
                2. Implement time-bound funding period with target amount
                3. Support refunds if funding goal not met
                4. Include PDA for holding funds securely
                5. Create initialize, contribute, withdraw, and claim functions
                6. Track contributors and contribution amounts
                7. Add proper threshold checks for funding goals
            """
        }
        
        # Get the specific requirements for the requested contract type
        specific_reqs = contract_specific_requirements.get(
            contract_type, 
            "# CONTRACT-SPECIFIC REQUIREMENTS\n1. Implement appropriate security patterns for this contract type"
        )
        
        # Construct prompt for the AI model
        prompt = f"""
        Generate a secure and deployable Solana smart contract using the Anchor framework with the following specification:
        
        Contract Type: {contract_type}
        Schema: {schema_str}
        Program ID to use: {program_id}
        
        # CRITICAL DEPLOYMENT REQUIREMENTS
        This contract will be deployed to Solana Devnet and must be production-ready without errors.
        The structure must follow the pattern of a SOL-based contract that handles native SOL (not SPL tokens).
        You MUST use the exact program ID provided: {program_id} in the declare_id!() macro.
        
        # CRITICAL ANCHOR STRUCTURE REQUIREMENTS - FOLLOW EXACTLY
        1. ALWAYS use the #[derive(Accounts)] attribute for account validation structs
        2. ALWAYS implement #[account] for data account structs that store state
        3. ALWAYS define SIZE constants for account structs to calculate space requirements
        4. ALWAYS include proper instruction parameter passing in the validation struct using #[instruction(...)]
        5. NEVER forget to include 'info lifetime parameters (e.g., 'info) in account validation structs
        6. ALWAYS use Context<YourStruct> as the first parameter in instruction functions
        7. ALWAYS include the system_program account in contexts that need it
        8. ALWAYS include validate functions like require!() for input validation
        9. ALWAYS use proper account constraint attributes (#[account(...)])
        10. NEVER use traits like Bumps directly - Anchor derives these automatically
        11. ALWAYS use anchor_lang::prelude::* import for Anchor-specific types
        
        # COMMON ERRORS TO AVOID
        1. Error "the trait Bumps is not implemented": This means your account struct is missing the proper #[derive(Accounts)] macro
        2. Error "no function or associated item named try_accounts": This indicates your account validation struct is missing the #[derive(Accounts)] attribute
        3. Error "missing lifetime specifier": Account validation structs must include the 'info lifetime parameter (e.g., Initialize<'info>)
        4. Error "expected identifier": Check for missing commas between struct fields or invalid syntax
        5. Error "unknown attribute macro_rules": Ensure you're using the correct attribute syntax (#[...])
        
        # SECURITY REQUIREMENTS (HIGHEST PRIORITY)
        1. Include comprehensive error handling with proper Result types and custom error enums
        2. Implement strong access control - verify signers, owners, and authorities in EVERY operation
        3. Use explicit constraint attributes for all accounts in the Accounts structs (has_one, seeds, bump)
        4. Include proper owner checks for all mutable accounts
        5. Use checked math operations or require! macros for arithmetic to prevent overflows/underflows
        6. Implement secure PDA derivation with seeds and bump
        7. Add thorough security validation before any state changes or lamport transfers
        8. Include comprehensive comments for each validation check to explain its purpose
        9. Use the Anchor constraints system to validate accounts (has_one, constraint, signer, etc.)
        10. Verify PDAs are derived correctly before use
        
        {specific_reqs}
        
        # PROVEN IMPLEMENTATION PATTERNS 
        1. Use lamport transfers for handling SOL (using try_borrow_mut_lamports and transfer CPI)
        2. Include explicit active state tracking with is_active flag
        3. Store bump in the account data for later verification
        4. Use seed-based PDAs for secure fund storage
        5. Set reserved space in account structs for future upgrades
        6. Include proper LEN constant calculation to ensure correct space allocation
        
        # ACCOUNT VALIDATION STRUCTURE EXAMPLE - FOLLOW THIS PATTERN
        ```rust
        #[derive(Accounts)]
        #[instruction(amount: u64, seed: u64)]
        pub struct Initialize<'info> {{
            #[account(mut)]
            pub initializer: Signer<'info>,
            
            #[account(
                init,
                payer = initializer,
                space = 8 + AccountStruct::SIZE,
                seeds = [b"seed_prefix", seed.to_le_bytes().as_ref()],
                bump
            )]
            pub data_account: Account<'info, AccountStruct>,
            
            pub system_program: Program<'info, System>,
        }}
        
        #[account]
        pub struct AccountStruct {{
            pub owner: Pubkey,
            pub amount: u64,
            pub seed: u64,
            pub bump: u8,
            pub is_active: bool,
        }}
        
        impl AccountStruct {{
            pub const SIZE: usize = 32 + 8 + 8 + 1 + 1;
        }}
        ```
        
        {template_instruction}
        
        # PROGRAM ID REQUIREMENT
        You MUST include this exact program ID in your contract:
        ```rust
        declare_id!("{program_id}");
        ```
        
        # INTEROPERABILITY & SCALABILITY
        1. Optimize instruction count to reduce compute units usage
        2. Document the account structure for integration with other programs
        3. Use Anchor account constraints for validation to improve security and reduce code size
        
        The contract MUST:
        - Have comprehensive error handling for all edge cases
        - Include complete account validation and security checks
        - Use the proper Anchor attribute macros for defining accounts and instructions
        - Be fully deployable to Devnet without code modifications
        - Include thorough comments explaining security considerations
        
        Return ONLY the complete Rust contract code without explanations outside the code.
        """
        
        # Call the AI client to generate the contract
        print(f"Generating {contract_type} contract...")
        ai_client = get_ai_client()
        response = ai_client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract the generated contract code
        contract_code = extract_code_from_ai_response(response)
        
        # Ensure program ID is correctly set
        if program_id not in contract_code:
            print(f"Warning: Program ID was not properly inserted. Adding it now...")
            # Add or replace the program ID in the contract
            if "declare_id!" in contract_code:
                import re
                contract_code = re.sub(
                    r'declare_id!\("([^"]*)"\);',
                    f'declare_id!("{program_id}");',
                    contract_code
                )
            else:
                # Add it after the imports
                import_end = contract_code.find(";") + 1
                contract_code = contract_code[:import_end] + f"\n\ndeclare_id!(\"{program_id}\");\n\n" + contract_code[import_end:]
        
        # Ensure the program ID is correctly set
        if "declare_id!" not in contract_code:
            print("Error: Contract does not include a declare_id! statement")
        
        # Always set default output path to the standard Anchor lib.rs location
        default_output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                  "deploy", "programs", "deploy", "src", "lib.rs")
        
        # Use provided output path or default
        CONTRACT_OUTPUT_PATH = output_path or default_output_path
        os.makedirs(os.path.dirname(CONTRACT_OUTPUT_PATH), exist_ok=True)
        
        # Save the contract code to the file
        with open(CONTRACT_OUTPUT_PATH, "w") as f:
            f.write(contract_code)
        
        print(f"Contract saved to {CONTRACT_OUTPUT_PATH}")
        
        # Always make sure the default lib.rs is updated
        if CONTRACT_OUTPUT_PATH != default_output_path:
            with open(default_output_path, "w") as f:
                f.write(contract_code)
            print(f"Contract also saved to default path: {default_output_path}")
        
        return contract_code
        
    except Exception as e:
        import traceback
        print(f"Error generating contract: {str(e)}")
        print(traceback.format_exc())
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
