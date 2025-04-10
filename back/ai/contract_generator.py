import json
import sys
import os
from ai.ai_client import client, get_ai_client, extract_code_from_ai_response, extract_program_id_from_deployed_contract

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTRACT_OUTPUT_PATH = "../deploy/programs/deploy/src/lib.rs"
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary programme ID
REGISTRY_PROGRAM_ID = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn"  # Fixed Registry Programme ID

def get_template_for_contract_type(contract_type):
    """Get template for the specified contract type.
    
    Args:
        contract_type: Type of contract (escrow, crowdfunding, etc.)
        
    Returns:
        Template code or None if not found
    """
    templates = {
        "escrow": """
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use std::str::FromStr;

declare_id!("11111111111111111111111111111111");

// Registry integration code
pub const REGISTRY_PROGRAM_ID: &str = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";
pub const REGISTRY_TRANSACTION_SEED: &str = "transaction_v1";

// Structure for Registry transaction data
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RegistryTransactionData {
    pub tx_type: String,
    pub amount: u64, 
    pub initiator: Pubkey,
    pub target_account: Pubkey,
    pub description: String,
}

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64, release_condition: String) -> Result<()> {
        // Initialize escrow account
        let escrow = &mut ctx.accounts.escrow_account;
        
        escrow.sender = ctx.accounts.sender.key();
        escrow.receiver = ctx.accounts.receiver.key();
        escrow.escrow_authority = ctx.accounts.escrow_authority.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
        escrow.is_completed = false;
        
        // Transfer funds from sender to escrow account
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.escrow_account.key(),
            amount,
        );
        
        // Clone the account infos before using them to avoid borrow conflicts
        let sender_info = ctx.accounts.sender.to_account_info();
        let escrow_account_info = ctx.accounts.escrow_account.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        
        invoke(
            &transfer_instruction,
            &[
                sender_info,
                escrow_account_info,
                system_program_info,
            ],
        )?;
        
        // Register the transaction with the registry program if provided
        if ctx.accounts.registry_program.key() == Pubkey::from_str(REGISTRY_PROGRAM_ID).unwrap() {
            let registry_data = RegistryTransactionData {
                tx_type: "escrow_initialize".to_string(),
                amount,
                initiator: ctx.accounts.sender.key(),
                target_account: ctx.accounts.receiver.key(),
                description: format!("Escrow initialized with amount {}", amount),
            };
            
            // Register the transaction using the helper function
            register_transaction_helper(
                ctx.accounts.registry_program.to_account_info(),
                ctx.accounts.registry_transaction.to_account_info(),
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                registry_data,
            )?;
        }
        
        Ok(())
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        // Get the escrow account info and balance first
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let escrow_balance = escrow_info.lamports();
        
        // Only the escrow authority can release funds
        require!(
            ctx.accounts.escrow_authority.key() == ctx.accounts.escrow_account.escrow_authority,
            EscrowError::UnauthorizedAccess
        );
        
        // Ensure escrow is not already completed
        require!(!ctx.accounts.escrow_account.is_completed, EscrowError::AlreadyCompleted);
        
        // Get the rent to calculate rent-exempt amount
        let rent = Rent::get()?;
        
        // Calculate the rent-exempt amount first
        let rent_exempt_lamports = rent.minimum_balance(8 + EscrowAccount::SIZE);
        
        // Calculate the amount to transfer (total balance minus rent-exempt amount)
        let transfer_amount = escrow_balance
            .checked_sub(rent_exempt_lamports)
            .ok_or(EscrowError::MathOverflow)?;
        
        // Transfer funds from escrow account to receiver
        **escrow_info.try_borrow_mut_lamports()? = rent_exempt_lamports;
            
        // Clone receiver info to avoid borrow conflicts
        let receiver_info = ctx.accounts.receiver.to_account_info();
        **receiver_info.try_borrow_mut_lamports()? = receiver_info
            .lamports()
            .checked_add(transfer_amount)
            .ok_or(EscrowError::MathOverflow)?;
        
        // Mark escrow as completed
        ctx.accounts.escrow_account.is_completed = true;
        
        // Register the transaction with the registry program if provided
        if ctx.accounts.registry_program.key() == Pubkey::from_str(REGISTRY_PROGRAM_ID).unwrap() {
            let registry_data = RegistryTransactionData {
                tx_type: "escrow_release".to_string(),
                amount: transfer_amount,
                initiator: ctx.accounts.escrow_authority.key(),
                target_account: ctx.accounts.receiver.key(),
                description: format!("Escrow released with amount {}", transfer_amount),
            };
            
            // Register the transaction using the helper function
            register_transaction_helper(
                ctx.accounts.registry_program.to_account_info(),
                ctx.accounts.registry_transaction.to_account_info(),
                ctx.accounts.escrow_authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                registry_data,
            )?;
        }
        
        Ok(())
    }

    pub fn register_transaction(ctx: Context<RegisterTransaction>, data: RegistryTransactionData) -> Result<()> {
        // Register the transaction using the helper function
        register_transaction_helper(
            ctx.accounts.registry_program.to_account_info(),
            ctx.accounts.registry_transaction.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            data,
        )
    }
}

// Helper function to register transactions with the registry program
fn register_transaction_helper<'a>(
    registry_program: AccountInfo<'a>,
    registry_transaction: AccountInfo<'a>,
    payer: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    data: RegistryTransactionData,
) -> Result<()> {
    // Serialize the transaction data
    let mut tx_data = Vec::new();
    data.serialize(&mut tx_data).map_err(|_| EscrowError::SerializationError)?;
    
    // Create cross-program invocation instruction data
    let mut instruction_data = Vec::new();
    instruction_data.push(0); // Instruction index for register_transaction
    instruction_data.extend_from_slice(&tx_data);
    
    // Create the instruction
    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: registry_program.key(),
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(registry_transaction.key(), false),
            anchor_lang::solana_program::instruction::AccountMeta::new(payer.key(), true),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(system_program.key(), false),
        ],
        data: instruction_data,
    };
    
    // Invoke the instruction
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            registry_transaction.clone(),
            payer.clone(),
            system_program.clone(),
        ],
    ).map_err(|_| EscrowError::RegistryError)?;
    
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: Receiver address verification is not critical to contract security
    pub receiver: AccountInfo<'info>,
    /// CHECK: The authorized user who can release funds
    pub escrow_authority: AccountInfo<'info>,
    #[account(
        init,
        payer = sender,
        space = 8 + EscrowAccount::SIZE,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
    /// CHECK: Registry program will verify on its end
    #[account(
        constraint = registry_program.key() == Pubkey::from_str(REGISTRY_PROGRAM_ID).unwrap() @ EscrowError::InvalidRegistryProgram
    )]
    pub registry_program: AccountInfo<'info>,
    /// CHECK: PDA will be handled by the Registry program
    pub registry_transaction: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// CHECK: This is the escrow authority that can release funds
    #[account(mut)]
    pub escrow_authority: Signer<'info>,
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,
    /// CHECK: This is the receiver of the funds
    #[account(
        mut,
        constraint = receiver.key() == escrow_account.receiver @ EscrowError::InvalidReceiver
    )]
    pub receiver: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: Registry program will verify on its end
    #[account(
        constraint = registry_program.key() == Pubkey::from_str(REGISTRY_PROGRAM_ID).unwrap() @ EscrowError::InvalidRegistryProgram
    )]
    pub registry_program: AccountInfo<'info>,
    /// CHECK: PDA will be handled by the Registry program
    pub registry_transaction: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RegisterTransaction<'info> {
    /// CHECK: The registry program to call
    pub registry_program: AccountInfo<'info>,
    /// CHECK: The registry transaction account
    pub registry_transaction: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub escrow_authority: Pubkey,
    pub amount: u64,
    pub release_condition: String,
    pub is_completed: bool,
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + // sender pubkey
                            32 + // receiver pubkey
                            32 + // escrow_authority pubkey
                            8 +  // amount u64
                            4 + 200 + // release_condition String (assuming max 200 chars)
                            1;   // is_completed bool
}

#[error_code]
pub enum EscrowError {
    #[msg("The escrow has already been completed")]
    AlreadyCompleted,
    #[msg("Only the escrow authority can release funds")]
    UnauthorizedAccess,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Serialization error")]
    SerializationError,
    #[msg("Registry program invocation error")]
    RegistryError,
    #[msg("Invalid registry program address")]
    InvalidRegistryProgram,
    #[msg("Invalid receiver")]
    InvalidReceiver,
}
""",
        "crowdfunding": """
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_name: String,
        description: String,
        target_amount: u64,
        end_time: i64,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        // Properly clone string values that will be used later
        campaign.campaign_name = campaign_name.clone();
        campaign.description = description.clone();
        
        campaign.creator = ctx.accounts.creator.key();
        campaign.beneficiary = ctx.accounts.beneficiary.key();
        campaign.target_amount = target_amount;
        campaign.raised_amount = 0;
        campaign.end_time = end_time;
        campaign.is_active = true;
        campaign.is_successful = false;
        
        // Create a seed for PDA derivation - NEVER use ? inside #[derive(Accounts)]
        campaign.seed = ctx.bumps.get("campaign").copied().unwrap();
        campaign.created_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        msg!("Campaign initialized: {}", campaign_name);
        
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let donor = &ctx.accounts.donor;
        
        // Validate campaign state
        require!(campaign.is_active, CampaignError::CampaignInactive);
        require!(
            Clock::get().expect("Failed to get clock").unix_timestamp <= campaign.end_time,
            CampaignError::CampaignEnded
        );
        
        // Build and invoke the system instruction to transfer lamports
        let transfer_instruction = system_instruction::transfer(
            &donor.key(),
            &ctx.accounts.campaign_account.key(),
            amount,
        );
        
        invoke(
            &transfer_instruction,
            &[
                donor.to_account_info(),
                ctx.accounts.campaign_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Update campaign state
        campaign.raised_amount = campaign
            .raised_amount
            .checked_add(amount)
            .ok_or(CampaignError::MathOverflow)?;
            
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        msg!("Donation of {} lamports received", amount);
        
        Ok(())
    }

    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        // Validate campaign state
        require!(campaign.is_active, CampaignError::CampaignInactive);
        require!(
            Clock::get().expect("Failed to get clock").unix_timestamp > campaign.end_time,
            CampaignError::CampaignStillActive
        );
        
        // Set campaign as inactive
        campaign.is_active = false;
        
        // Determine if campaign was successful
        campaign.is_successful = campaign.raised_amount >= campaign.target_amount;
        
        // If successful, transfer funds to beneficiary
        if campaign.is_successful {
            let campaign_lamports = ctx.accounts.campaign_account.lamports();
            
            **ctx.accounts.campaign_account.try_borrow_mut_lamports()? = campaign_lamports
                .checked_sub(campaign.raised_amount)
                .ok_or(CampaignError::MathOverflow)?;
                
            **ctx.accounts.beneficiary.try_borrow_mut_lamports()? = ctx
                .accounts
                .beneficiary
                .lamports()
                .checked_add(campaign.raised_amount)
                .ok_or(CampaignError::MathOverflow)?;
                
            msg!("Campaign successful! Funds transferred to beneficiary");
        } else {
            msg!("Campaign unsuccessful. Funds can be refunded.");
        }
        
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: This is the beneficiary who will receive the funds if campaign is successful
    pub beneficiary: AccountInfo<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + CampaignAccount::SIZE,
        seeds = [b"crowdfunding", creator.key().as_ref()],
        bump
    )]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account will hold the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account will hold the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    #[account(
        constraint = campaign.creator == creator.key() @ CampaignError::UnauthorizedAccess
    )]
    pub creator: Signer<'info>,
    /// CHECK: This is the beneficiary who will receive the funds
    #[account(mut)]
    pub beneficiary: AccountInfo<'info>,
    #[account(mut)]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account holds the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct CampaignAccount {
    pub creator: Pubkey,
    pub beneficiary: Pubkey,
    pub campaign_name: String,
    pub description: String,
    pub target_amount: u64,
    pub raised_amount: u64,
    pub end_time: i64,
    pub is_active: bool,
    pub is_successful: bool,
    pub seed: u8,
    pub created_at: i64,
    pub last_updated_at: i64,
}

impl CampaignAccount {
    // Size calculation breakdown:
    // Pubkey: 32 bytes
    // String size: 4 bytes (length) + max_content_bytes
    pub const SIZE: usize = 32 + // creator
                             32 + // beneficiary
                             4 + 50 + // campaign_name (max 50 chars)
                             4 + 255 + // description (max 255 chars)
                             8 + // target_amount
                             8 + // raised_amount
                             8 + // end_time
                             1 + // is_active
                             1 + // is_successful
                             1 + // seed
                             8 + // created_at
                             8;  // last_updated_at
}

#[error_code]
pub enum CampaignError {
    #[msg("Campaign is inactive")]
    CampaignInactive,
    #[msg("Campaign has already ended")]
    CampaignEnded,
    #[msg("Campaign is still active")]
    CampaignStillActive,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Math overflow error")]
    MathOverflow,
}
"""
    }
    
    return templates.get(contract_type, None)

def generate_smart_contract(contract_type, schema, output_path=None):
    """Generate Solana smart contract using AI.
    
    Args:
        contract_type: Type of contract (escrow, marketplace, dao)
        schema: JSON schema with contract details
        output_path: Path to save generated contract
        
    Returns:
        Generated contract code
    """
    output_path = output_path or CONTRACT_OUTPUT_PATH
    
    # Convert schema to string format
    schema_str = json.dumps(schema, indent=2)
    
    # Get programme ID from previous deployment
    program_id = extract_program_id_from_deployed_contract()
    print(f"Using programme ID: {program_id}")
    
    # Prepare IDL naming pattern instructions
    idl_naming_patterns = """
    # IDL NAMING CONVENTIONS - CRITICAL
    To ensure compatibility with JavaScript tests:
    1. Use camelCase for instruction parameters
    2. Use camelCase for struct fields accessed via JavaScript
    3. Use snake_case for internal Rust functions and variables
    4. Ensure field types match JavaScript expectations
    5. Calculate account SIZE constants precisely
    """
    
    # Prepare bump handling instructions
    bump_handling = """
    # CORRECT BUMP HANDLING
    When accessing PDAs:
    1. Use 'bump' constraint in #[derive(Accounts)] structs
    2. Access bump using ctx.bumps.account_name
    3. Store bump in account data for verification
    4. Use account.bump for verification in later instructions
    """
    
    # Prepare borrow checker instructions
    borrow_checker_instructions = """
    # BORROW CHECKER AND LIFETIME REQUIREMENTS
    1. Get immutable borrows before mutable borrows
    2. Clone account infos before using in invoke calls
    3. Avoid multiple mutable borrows of the same account
    4. Use proper lifetime annotations for helper functions
    5. Prefer direct access over to_account_info() when possible
    6. Calculate rent-exempt amount first for lamport operations
    7. Use checked arithmetic operations
    8. Properly handle account cloning in CPI calls
    """

    # Prepare registry integration instructions
    registry_interop_instructions = f"""
    # REGISTRY INTEROPERABILITY REQUIREMENTS
    Interoperate with Registry programme (ID: {REGISTRY_PROGRAM_ID})
    
    Requirements:
    1. Include registry programme and transaction accounts
    2. Use proper error handling for registry operations
    3. Implement proper serialisation for registry data
    4. Use helper functions to avoid code duplication
    5. Clone account infos before registry operations
    6. Use proper lifetime annotations for registry helpers
    7. Handle registry errors gracefully
    """

    # Prepare account validation instructions
    account_validation_instructions = """
    # ACCOUNT VALIDATION REQUIREMENTS
    For account structs:
    1. Use proper signer and mutability constraints
    2. Include necessary system accounts
    3. Calculate space accurately for account initialisation
    4. Document unchecked accounts properly
    5. Use proper seeds and bump constraints for PDAs
    6. Include clear error messages in constraints
    7. Use appropriate account types (Signer, Account, AccountInfo)
    """

    # Prepare error handling instructions
    error_handling_instructions = """
    # ERROR HANDLING REQUIREMENTS
    1. Define appropriate error types
    2. Include descriptive error messages
    3. Handle all error cases
    4. Use proper error propagation
    5. Document errors clearly
    6. Use appropriate error codes
    7. Handle maths overflow errors
    8. Handle serialisation errors
    """

    # Combine all instructions
    contract_generation_instructions = f"""
    {idl_naming_patterns}
    {bump_handling}
    {borrow_checker_instructions}
    {registry_interop_instructions}
    {account_validation_instructions}
    {error_handling_instructions}
    """
    
    # Generate prompt for AI
    prompt = f"""
        Generate a secure and deployable Solana smart contract using the Anchor framework with the following specification:
        
        Contract Type: {contract_type}
        Schema: {schema_str}
        Programme ID to use: {program_id}
        
    ## CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY

    1. IDL COMPATIBILITY:
    {contract_generation_instructions}

    2. REGISTRY INTEGRATION:
    - Use Registry Programme ID: {REGISTRY_PROGRAM_ID} (do not modify)
    - Implement register_with_registry function that LOGS transactions rather than making CPI calls
    - Format: msg!("Registry Transaction: type={{}}, amount={{}}, initiator={{}}, target={{}}", tx_type, amount, initiator, target_account)

    3. CORRECT BUMP HANDLING:
    {bump_handling}

    4. AVOID TYPE CONFLICTS:
    - Use anchor_lang::solana_program instead of direct imports
    - Derive PDAs using proper Buffer conversions for all types
    - For u64/BN values, use .to_le_bytes() in Rust

    5. ERROR HANDLING:
    - Define clear error enum with descriptive messages
    - Use require!() with custom errors instead of unwrap()
    - Handle all arithmetic with checked operations

    6. EXACT ACCOUNT VALIDATION:
    - Include proper constraints in #[derive(Accounts)] structs
    - Ensure seeds match EXACTLY between initialisation and subsequent uses
    
    {registry_interop_instructions}

    Return ONLY the complete Rust contract code without explanations outside the code.
    """
    
    # Call AI to generate contract
    print(f"Generating {contract_type} contract...")
    
    # Integrate with AI
    contract_code = generate_contract_with_ai(prompt)
    
    # Save contract to file
    with open(output_path, "w") as f:
        f.write(contract_code)
    
    print(f"Contract saved to {os.path.abspath(output_path)}")
    
    return contract_code

def generate_contract_with_ai(prompt):
    """Generate smart contract using AI.
    
    Args:
        prompt: The prompt for the AI
        
    Returns:
        Generated contract code
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

        # Extract code from response
        return extract_code_from_ai_response(response)
    except Exception as e:
        print(f"Error generating contract with AI: {str(e)}")
        # Return minimal fallback contract
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
