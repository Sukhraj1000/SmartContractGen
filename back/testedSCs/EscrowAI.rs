use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use std::str::FromStr;

declare_id!("6bxjHnAj8m5Fs6hve9xeLcKyN4b2gGonCnBDsv59DNXQ");

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
pub mod deploy {
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
    
    /// CHECK: This is safe because we only read the key
    pub receiver: AccountInfo<'info>,
    
    /// CHECK: This is the escrow authority who can release funds
    pub escrow_authority: AccountInfo<'info>,
    
    #[account(
        init,
        payer = sender,
        space = 8 + EscrowAccount::SIZE
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: This is the registry program
    pub registry_program: AccountInfo<'info>,
    
    /// CHECK: This is the registry transaction account
    #[account(mut)]
    pub registry_transaction: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// CHECK: This is the receiver who will receive the funds
    #[account(mut)]
    pub receiver: AccountInfo<'info>,
    
    /// CHECK: This is the escrow authority who controls the release
    #[account(mut, signer)]
    pub escrow_authority: AccountInfo<'info>,
    
    #[account(mut)]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: This is the registry program
    pub registry_program: AccountInfo<'info>,
    
    /// CHECK: This is the registry transaction account
    #[account(mut)]
    pub registry_transaction: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RegisterTransaction<'info> {
    /// CHECK: This is the registry program
    pub registry_program: AccountInfo<'info>,
    
    /// CHECK: This is the registry transaction account
    #[account(mut)]
    pub registry_transaction: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct EscrowAccount {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub escrow_authority: Pubkey,
    pub amount: u64,
    pub release_condition: String,
    pub is_completed: bool,
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + // sender
                             32 + // receiver
                             32 + // escrow_authority
                             8 +  // amount
                             4 + 100 + // release_condition (max 100 chars)
                             1;   // is_completed
}

#[error_code]
pub enum EscrowError {
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Escrow is already completed")]
    AlreadyCompleted,
    #[msg("Math overflow error")]
    MathOverflow,
    #[msg("Serialization error")]
    SerializationError,
    #[msg("Registry program error")]
    RegistryError,
}