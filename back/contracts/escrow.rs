use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg");

// Helper function to safely transfer lamports between accounts
fn safe_transfer_lamports(
    from: &AccountInfo,
    to: &AccountInfo, 
    amount: u64
) -> Result<()> {
    // Get the current lamport balances
    let from_lamports = from.lamports();
    let to_lamports = to.lamports();
    
    // Ensure the sender has sufficient funds
    require!(from_lamports >= amount, EscrowError::InsufficientFunds);
    
    // Update the sender's lamports (subtract amount)
    **from.try_borrow_mut_lamports()? = from_lamports.checked_sub(amount)
        .ok_or(EscrowError::ArithmeticError)?;
    
    // Update the recipient's lamports (add amount)
    **to.try_borrow_mut_lamports()? = to_lamports.checked_add(amount)
        .ok_or(EscrowError::ArithmeticError)?;
    
    Ok(())
}

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        release_condition: u64,
        seed: u64,
        bump: u8,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(release_condition > 0, EscrowError::InvalidReleaseCondition);

        let escrow = &mut ctx.accounts.escrow;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
        escrow.seed = seed;
        escrow.bump = bump;
        escrow.is_active = true;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.last_updated_at = escrow.created_at;

        // Transfer lamports from initializer to escrow account
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.initializer.to_account_info(),
            to: ctx.accounts.escrow.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, amount)?;

        msg!("Escrow created successfully with amount {} and release condition {}", amount, release_condition);
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>, condition_value: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );
        
        // Check if the release condition is met
        require!(
            condition_value >= escrow.release_condition,
            EscrowError::ReleaseConditionNotMet
        );

        // Store the amount before marking escrow as inactive
        let amount = escrow.amount;
        
        // Mark the escrow as inactive
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;
        
        // Transfer the escrow amount to the taker
        safe_transfer_lamports(
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.taker.to_account_info(),
            amount
        )?;
        
        msg!("Escrow executed successfully");
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Store the amount before marking escrow as inactive
        let amount = escrow.amount;
        
        // Mark the escrow as inactive
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;
        
        // Return the funds to the initializer
        safe_transfer_lamports(
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.initializer.to_account_info(),
            amount
        )?;
        
        msg!("Escrow cancelled successfully");
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        require!(!escrow.is_active, EscrowError::EscrowStillActive);

        // Transfer remaining lamports (rent) to initializer
        let escrow_info = escrow.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();
        let escrow_lamports = escrow_info.lamports();

        **escrow_info.try_borrow_mut_lamports()? = 0;
        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(escrow_lamports)
            .ok_or(EscrowError::ArithmeticError)?;

        msg!("Escrow closed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, release_condition: u64, seed: u64, bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", initializer.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump = bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    
    /// CHECK: This is the initializer account, not needed as a signer for execute
    pub initializer: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", initializer.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        constraint = escrow.is_active @ EscrowError::EscrowNotActive,
        constraint = escrow.initializer == initializer.key() @ EscrowError::InvalidInitializer
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        constraint = initializer.key() == escrow.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", initializer.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        constraint = escrow.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(
        mut,
        constraint = initializer.key() == escrow.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", initializer.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        close = initializer
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub initializer: Pubkey,
    pub amount: u64,
    pub release_condition: u64,
    pub seed: u64,
    pub bump: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub last_updated_at: i64,
    // Reserve space for future upgrades
    pub reserved: [u8; 64],
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 64;
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Release condition must be greater than zero")]
    InvalidReleaseCondition,
    
    #[msg("Release condition not met")]
    ReleaseConditionNotMet,
    
    #[msg("Escrow is not active")]
    EscrowNotActive,
    
    #[msg("Escrow is still active")]
    EscrowStillActive,
    
    #[msg("Cannot take your own escrow")]
    CannotTakeOwnEscrow,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Arithmetic error occurred")]
    ArithmeticError,
    
    #[msg("Invalid initializer")]
    InvalidInitializer,
}