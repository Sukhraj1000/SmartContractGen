use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8e4Xi3gmt3cgTymHhzTihUabK9rRixfy7C8MEd7EvxYo");

#[program]
pub mod escrow {
    use super::*;

    /// Initialize a new escrow account
    /// Transfers SOL from initializer to the escrow account
    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        seed: u64,
    ) -> Result<()> {
        // Validate input parameters
        require!(amount > 0, EscrowError::InvalidAmount);

        // Initialize escrow account data
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.seed = seed;
        escrow.bump = ctx.bumps.escrow_account;
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

        msg!("Escrow initialized successfully with {} lamports", amount);
        Ok(())
    }

    /// Execute the escrow by transferring funds to the taker
    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Transfer SOL from escrow to taker
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let taker_info = ctx.accounts.taker.to_account_info();

        // Calculate amount to transfer, ensuring we don't transfer rent
        let amount = escrow.amount;

        // Mark escrow as inactive before transfer
        let mut escrow_account = &mut ctx.accounts.escrow_account;
        escrow_account.is_active = false;
        escrow_account.last_updated_at = Clock::get()?.unix_timestamp;

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully, transferred {} lamports to taker", amount);
        Ok(())
    }

    /// Cancel the escrow and return funds to the initializer
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Transfer SOL back to initializer
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();

        // Calculate amount to transfer, ensuring we don't transfer rent
        let amount = escrow.amount;

        // Mark escrow as inactive before transfer
        let mut escrow_account = &mut ctx.accounts.escrow_account;
        escrow_account.is_active = false;
        escrow_account.last_updated_at = Clock::get()?.unix_timestamp;

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow cancelled successfully, returned {} lamports to initializer", amount);
        Ok(())
    }

    /// Close the escrow account and reclaim rent
    pub fn close(ctx: Context<Close>) -> Result<()> {
        // Validate escrow state
        require!(!ctx.accounts.escrow_account.is_active, EscrowError::EscrowStillActive);

        // Account will be closed and lamports returned to initializer via close constraint
        msg!("Escrow closed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, seed: u64)]
pub struct Initialize<'info> {
    /// The account initializing the escrow and providing the funds
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    /// The escrow account that will hold the funds
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", initializer.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    /// The system program for creating accounts and transferring SOL
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    /// The account that will receive the funds from the escrow
    #[account(mut)]
    pub taker: Signer<'info>,
    
    /// The escrow account holding the funds
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    /// The system program for transferring SOL
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    /// The original initializer of the escrow, must match the stored initializer
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    /// The escrow account holding the funds
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    /// The system program for transferring SOL
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    /// The original initializer of the escrow, must match the stored initializer
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    /// The escrow account to be closed
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized,
        close = initializer
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    /// The system program for closing accounts
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    /// The public key of the account that initialized the escrow
    pub initializer: Pubkey,
    /// The amount of SOL locked in the escrow
    pub amount: u64,
    /// The seed used to derive the PDA
    pub seed: u64,
    /// The bump used to derive the PDA
    pub bump: u8,
    /// Whether the escrow is active or has been executed/cancelled
    pub is_active: bool,
    /// Timestamp when the escrow was created
    pub created_at: i64,
    /// Timestamp when the escrow was last updated
    pub last_updated_at: i64,
    /// Reserved space for future upgrades
    pub reserved: [u8; 32],
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + // initializer
                            8 +  // amount
                            8 +  // seed
                            1 +  // bump
                            1 +  // is_active
                            8 +  // created_at
                            8 +  // last_updated_at
                            32;  // reserved
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
    
    #[msg("Unauthorized access - only the initializer can perform this action")]
    Unauthorized,
    
    #[msg("Insufficient funds in the escrow account")]
    InsufficientFunds,
    
    #[msg("Amount overflow during calculation")]
    AmountOverflow,
}