import json
import sys
import os
from ai.ai_client import client

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTRACT_OUTPUT_PATH = "../deploy/programs/deploy/src/lib.rs"
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary program ID
REGISTRY_PROGRAM_ID = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn"  # Fixed Registry Program ID


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
        contract_type: Type of contract (escrow, crowdfunding)
        
    Returns:
        The template contract code or None if not found
    """
    template_paths = {
        "escrow": "templates/escrow_template.rs",
        "crowdfunding": "templates/crowdfunding_template.rs",
        "registry_interface": "templates/registry_interface.rs"
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
    Generate a smart contract based on the specified type and schema.
    
    Args:
        contract_type (str): Type of contract to generate (e.g., 'escrow', 'crowdfunding')
        schema (dict): Schema defining the contract structure
        output_path (str, optional): Path to save the generated contract
        
    Returns:
        str: The generated smart contract code
    """
    output_path = output_path or CONTRACT_OUTPUT_PATH
    
    # Convert schema to string format
    schema_str = json.dumps(schema, indent=2)
    
    # Get program ID from previous deployment
    program_id = extract_program_id_from_deployed_contract()
    print(f"Using program ID: {program_id}")
    
    # Prepare IDL naming pattern instructions
    idl_naming_patterns = """
    # IDL NAMING CONVENTIONS - CRITICAL
    To ensure compatibility with JavaScript tests:
    1. Use camelCase for all instruction parameters (e.g., userReceives not user_receives)
    2. Use camelCase for struct fields in Account types that will be accessed via JavaScript
    3. HOWEVER, use snake_case for internal Rust function names and variables
    4. For account structs, ensure ALL fields have proper types that match JavaScript expectations
    5. Carefully calculate account SIZE constants to match EXACTLY the bytes needed
    """
    
    # Prepare bump handling instructions
    bump_handling = """
    # CORRECT BUMP HANDLING
    When accessing PDAs:
    1. In #[derive(Accounts)] structs, use the 'bump' constraint (not seeds_with_nonce)
    2. Access the bump using ctx.bumps.account_name (e.g., ctx.bumps.data_account)
    3. Store this bump in the account data for later verification
    4. When validating in later instructions, use account.bump for verification
    """
    
    # Prepare registry integration instructions
    registry_interop_instructions = f"""
    # REGISTRY INTEROPERABILITY REQUIREMENTS
    Your contract MUST interoperate with a pre-deployed Registry program that tracks transactions.
    The Registry contract has a fixed Program ID of {REGISTRY_PROGRAM_ID} which must never change.
    
    SIMPLIFIED APPROACH: Rather than making actual CPI calls, which can cause type conflicts,
    implement a function that LOGS transactions with this format:
            
            ```rust
    // Registry Interface Code
    pub const REGISTRY_PROGRAM_ID: &str = "{REGISTRY_PROGRAM_ID}";
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

    // Helper function to register a transaction with the Registry
    pub fn register_with_registry<'info>(
        tx_type: String,
        amount: u64,
        initiator: Pubkey,
        target_account: Pubkey,
        description: String,
        payer: AccountInfo<'info>,
        system_program: AccountInfo<'info>,
    ) -> Result<()> {{
        // Just log the transaction instead of making a CPI call
        msg!(
            "Registry Transaction: type={{}}, amount={{}}, initiator={{}}, target={{}}",
            tx_type,
            amount,
            initiator,
            target_account
        );
        
        Ok(())
    }}
    
    // Helper function for each specific contract type
    pub fn register_transaction_action<'info>(
        action_type: &str,
        amount: u64,
        initializer: &Pubkey,
        target: &Pubkey,
        payer: &AccountInfo<'info>,
        system_program: &AccountInfo<'info>,
    ) -> Result<()> {{
        register_with_registry(
            action_type.to_string(),
            amount,
            *initializer,
            *target,
            format!("{{}} {{}}: {{}} SOL", contract_type, action_type, amount as f64 / 1_000_000_000.0),
            payer.clone(),
            system_program.clone(),
        )
    }}
    ```
    
    Call register_transaction_action() after any funds transfer or major state change.
    """
    
    # Generate prompt for AI
        prompt = f"""
        Generate a secure and deployable Solana smart contract using the Anchor framework with the following specification:
        
        Contract Type: {contract_type}
        Schema: {schema_str}
        Program ID to use: {program_id}
        
    ## CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY

    1. IDL COMPATIBILITY:
    {idl_naming_patterns}

    2. REGISTRY INTEGRATION:
    - Use Registry Program ID: {REGISTRY_PROGRAM_ID} (do not modify)
    - Implement register_with_registry function that LOGS transactions rather than making CPI calls
    - Format: msg!("Registry Transaction: type={{}}, amount={{}}, initiator={{}}, target={{}}", tx_type, amount, initiator, target_account)

    3. CORRECT BUMP HANDLING:
    {bump_handling}

    4. AVOID TYPE CONFLICTS:
    - Use anchor_lang::solana_program instead of direct solana_program imports
    - When working with PDAs, derive using proper Buffer conversions for all types
    - For u64/BN values, use .to_le_bytes() in Rust

    5. ERROR HANDLING:
    - Define clear error enum with descriptive messages
    - Use require!() with custom errors instead of unwrap()
    - Handle all arithmetic with checked operations

    6. EXACT ACCOUNT VALIDATION:
    - Include proper constraints in #[derive(Accounts)] structs
    - For PDA validation, ensure seeds match EXACTLY between initialization and subsequent uses
    
    {registry_interop_instructions}

    Return ONLY the complete Rust contract code without explanations outside the code.
    """
    
    # Call OpenAI API to generate contract
    print(f"Generating {contract_type} contract...")
    
    # Actually integrate with OpenAI API here
    contract_code = generate_contract_with_ai(prompt)
    
    # Save contract to file
    with open(output_path, "w") as f:
        f.write(contract_code)
    
    print(f"Contract saved to {os.path.abspath(output_path)}")
    
    return contract_code

def generate_contract_with_ai(prompt):
    """
    Generate a smart contract using AI by calling the API client
    
    Args:
        prompt (str): The prompt for the AI
        
    Returns:
        str: Generated contract code
    """
    try:
        # Call AI client
        ai_client = get_ai_client()
        response = ai_client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract the code from response
        return extract_code_from_ai_response(response)
    except Exception as e:
        print(f"Error generating contract with AI: {str(e)}")
        # Return a minimal contract as fallback
        return """
        use anchor_lang::prelude::*;
        
        declare_id!("CxEvoPT1kHshLT8GoDVS1mKJqeYNGiNzN4puGei9tXKq");
        
        #[program]
        pub mod deploy {
            use super::*;
            
            pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
                Ok(())
            }
        }
        
        #[derive(Accounts)]
        pub struct Initialize<'info> {
            #[account(mut)]
            pub signer: Signer<'info>,
            pub system_program: Program<'info, System>,
        }
        """

def extract_program_id_from_deployed_contract():
    """
    Try to extract program ID from a previously deployed contract's program-info.json file.
    
    Returns:
        The program ID string or None if not found.
    """
    try:
        program_info_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                  "deploy", "program-info.json")
        
        if os.path.exists(program_info_path):
            with open(program_info_path, 'r') as f:
                program_info = json.load(f)
                if "programId" in program_info:
                    return program_info["programId"]
    except Exception as e:
        print(f"Error extracting program ID: {str(e)}")
        
        return None
