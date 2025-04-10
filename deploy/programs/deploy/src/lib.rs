use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    system_instruction,
};

declare_id!("HiGDqXXHuZ8kzEhS1zhSPU6QQg9RAsgwo7jv2QEY59j9");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        release_condition: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Initialize escrow data
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.recipient = ctx.accounts.recipient.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
        escrow.bump = ctx.bumps.escrow;
        escrow.is_completed = false;
        
        // Transfer funds from initializer to escrow account
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.initializer.key(),
            &ctx.accounts.escrow.to_account_info().key(),
            amount,
        );
        
        invoke(
            &transfer_instruction,
            &[
                ctx.accounts.initializer.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Log transaction for registry
        register_with_registry("initialize", amount, ctx.accounts.initializer.key(), ctx.accounts.recipient.key());
        
        msg!("Escrow initialized with {} SOL", amount);
        Ok(())
    }
    
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Verify escrow is not already completed
        require!(!escrow.is_completed, EscrowError::AlreadyCompleted);
        
        // Verify release condition is met
        require!(
            Clock::get()?.slot >= escrow.release_condition,
            EscrowError::ReleaseConditionNotMet
        );
        
        // Mark escrow as completed
        escrow.is_completed = true;
        
        // Calculate the amount to transfer
        let amount = escrow.amount;
        
        // Transfer funds from escrow to recipient
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .escrow
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::AmountOverflow)?;
            
        **ctx.accounts.recipient.try_borrow_mut_lamports()? = ctx
            .accounts
            .recipient
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;
        
        // Log transaction for registry
        register_with_registry("release", amount, ctx.accounts.escrow.key(), ctx.accounts.recipient.key());
        
        msg!("Escrow released {} SOL to recipient", amount);
        Ok(())
    }
    
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Verify escrow is not already completed
        require!(!escrow.is_completed, EscrowError::AlreadyCompleted);
        
        // Mark escrow as completed
        escrow.is_completed = true;
        
        // Calculate the amount to transfer
        let amount = escrow.amount;
        
        // Transfer funds from escrow back to initializer
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .escrow
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::AmountOverflow)?;
            
        **ctx.accounts.initializer.try_borrow_mut_lamports()? = ctx
            .accounts
            .initializer
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;
        
        // Log transaction for registry
        register_with_registry("cancel", amount, ctx.accounts.escrow.key(), ctx.accounts.initializer.key());
        
        msg!("Escrow cancelled and {} SOL returned to initializer", amount);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, release_condition: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    /// CHECK: This is the recipient of the escrow funds
    pub recipient: AccountInfo<'info>,
    
    #[account(
        init,
        payer = initializer,
        space = 8 + Escrow::SIZE,
        seeds = [
            b"escrow",
            initializer.key().as_ref(),
            recipient.key().as_ref(),
            amount.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: This is the registry program
    #[account(constraint = registry_program.key() == REGISTRY_PROGRAM_ID)]
    pub registry_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// CHECK: This is the recipient of the escrow funds
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [
            b"escrow",
            escrow.initializer.as_ref(),
            escrow.recipient.as_ref(),
            escrow.amount.to_le_bytes().as_ref(),
        ],
        bump = escrow.bump,
        constraint = escrow.recipient == recipient.key() @ EscrowError::InvalidRecipient,
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: This is the registry program
    #[account(constraint = registry_program.key() == REGISTRY_PROGRAM_ID)]
    pub registry_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [
            b"escrow",
            escrow.initializer.as_ref(),
            escrow.recipient.as_ref(),
            escrow.amount.to_le_bytes().as_ref(),
        ],
        bump = escrow.bump,
        constraint = escrow.initializer == initializer.key() @ EscrowError::InvalidInitializer,
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: This is the registry program
    #[account(constraint = registry_program.key() == REGISTRY_PROGRAM_ID)]
    pub registry_program: AccountInfo<'info>,
}

#[account]
pub struct Escrow {
    pub initializer: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub release_condition: u64,
    pub is_completed: bool,
    pub bump: u8,
}

impl Escrow {
    pub const SIZE: usize = 32 + // initializer
                            32 + // recipient
                            8 +  // amount
                            8 +  // release_condition
                            1 +  // is_completed
                            1;   // bump
}

#[error_code]
pub enum EscrowError {
    #[msg("Escrow has already been completed")]
    AlreadyCompleted,
    
    #[msg("Release condition has not been met")]
    ReleaseConditionNotMet,
    
    #[msg("Invalid recipient")]
    InvalidRecipient,
    
    #[msg("Invalid initializer")]
    InvalidInitializer,
    
    #[msg("Amount overflow")]
    AmountOverflow,
}

// Registry program ID
pub const REGISTRY_PROGRAM_ID: Pubkey = pubkey!("BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn");

// Helper function to log registry transactions
fn register_with_registry(tx_type: &str, amount: u64, initiator: Pubkey, target_account: Pubkey) {
    msg!(
        "Registry Transaction: type={}, amount={}, initiator={}, target={}",
        tx_type,
        amount,
        initiator,
        target_account
    );
}