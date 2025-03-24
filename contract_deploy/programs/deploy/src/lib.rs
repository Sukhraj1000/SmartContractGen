use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8NcdCu6P8WJHHG8bQkVwuJCZatUeRK6EEgTCDUmF5UJP");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        seed: u64,
    ) -> Result<()> {
        // Validate input parameters
        require!(amount > 0, EscrowError::InvalidAmount);

        // Initialize escrow account data
        let escrow = &mut ctx.accounts.escrow_account;
        let bump = ctx.bumps.escrow_account;
        
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.seed = seed;
        escrow.bump = bump;
        escrow.is_active = true;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.last_updated_at = escrow.created_at;

        // Transfer SOL from initializer to escrow account
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.initializer.to_account_info(),
            to: ctx.accounts.escrow_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, amount)?;

        msg!("Escrow created successfully with amount {} SOL", amount);
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Calculate the amount to transfer (all funds except rent)
        let amount = escrow.amount;

        // Mark escrow as inactive before transfer to prevent reentrancy
        let mut escrow_mut = ctx.accounts.escrow_account.to_account_mutable();
        escrow_mut.is_active = false;
        escrow_mut.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL from escrow to taker
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let taker_info = ctx.accounts.taker.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully, {} SOL transferred to taker", amount);
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Calculate the amount to transfer (all funds except rent)
        let amount = escrow.amount;
        
        // Mark escrow as inactive before transfer to prevent reentrancy
        let mut escrow_mut = ctx.accounts.escrow_account.to_account_mutable();
        escrow_mut.is_active = false;
        escrow_mut.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL back to initializer
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow cancelled successfully, {} SOL returned to initializer", amount);
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        // Validate escrow state - must be inactive to close
        require!(!ctx.accounts.escrow_account.is_active, EscrowError::EscrowStillActive);

        // Account will be closed and rent returned to initializer via close constraint
        msg!("Escrow account closed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, seed: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", initializer.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        close = initializer
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub initializer: Pubkey,    // 32 bytes - The account that created the escrow
    pub amount: u64,            // 8 bytes - Amount of SOL locked in escrow
    pub seed: u64,              // 8 bytes - Unique seed for PDA derivation
    pub bump: u8,               // 1 byte - PDA bump for verification
    pub is_active: bool,        // 1 byte - Flag to track if escrow is active
    pub created_at: i64,        // 8 bytes - Timestamp when escrow was created
    pub last_updated_at: i64,   // 8 bytes - Timestamp of last update
    pub reserved: [u8; 32],     // 32 bytes - Reserved for future upgrades
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 8 + 8 + 32;
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Escrow is not active")]
    EscrowNotActive,
    
    #[msg("Escrow is still active and cannot be closed")]
    EscrowStillActive,
    
    #[msg("Cannot take your own escrow")]
    CannotTakeOwnEscrow,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Insufficient funds in escrow account")]
    InsufficientFunds,
    
    #[msg("Amount calculation resulted in overflow")]
    AmountOverflow,
}