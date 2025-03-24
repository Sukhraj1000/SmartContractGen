use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::ops::Deref;

declare_id!("DjnhicViRThy9waQKPuMch25kuKKLCMyoZDfo2cgsH33");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        seed: u64,
    ) -> Result<()> {
        // Validate the amount is greater than zero
        require!(amount > 0, EscrowError::InvalidAmount);
        
        // Ensure initializer has enough SOL for the escrow
        require!(
            ctx.accounts.initializer.lamports() >= amount + Rent::get()?.minimum_balance(EscrowAccount::SIZE + 8),
            EscrowError::InsufficientFunds
        );

        // Initialize the escrow account with the required data
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.seed = seed;
        escrow.bump = *ctx.bumps.get("escrow_account").ok_or(EscrowError::BumpNotFound)?;
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

        msg!("Escrow created successfully with {} SOL", amount);
        emit!(EscrowCreatedEvent {
            escrow_address: ctx.accounts.escrow_account.key(),
            initializer: ctx.accounts.initializer.key(),
            amount,
            seed,
            timestamp: escrow.created_at,
        });
        
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Verify the escrow is still active
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Prevent initializer from taking their own escrow
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Store amount for event emission
        let amount = escrow.amount;
        
        // Mark escrow as inactive before transfer to prevent reentrancy
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL from escrow to taker
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let taker_info = ctx.accounts.taker.to_account_info();

        // Calculate escrow's minimum required balance for rent exemption
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        
        // Ensure escrow has enough lamports to cover both the amount and rent
        let escrow_lamports = escrow_info.lamports();
        require!(
            escrow_lamports >= amount.checked_add(min_rent).ok_or(EscrowError::AmountOverflow)?,
            EscrowError::InsufficientFunds
        );

        // Use checked math to prevent overflows/underflows
        **escrow_info.try_borrow_mut_lamports()? = escrow_lamports
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully, {} SOL transferred to taker", amount);
        emit!(EscrowExecutedEvent {
            escrow_address: ctx.accounts.escrow_account.key(),
            initializer: escrow.initializer,
            taker: ctx.accounts.taker.key(),
            amount,
            timestamp: escrow.last_updated_at,
        });
        
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Verify the escrow is still active
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Store amount for event emission
        let amount = escrow.amount;
        
        // Mark escrow as inactive before transfer to prevent reentrancy
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL back to initializer
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();

        // Calculate escrow's minimum required balance for rent exemption
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        
        // Ensure escrow has enough lamports to cover both the amount and rent
        let escrow_lamports = escrow_info.lamports();
        require!(
            escrow_lamports >= amount.checked_add(min_rent).ok_or(EscrowError::AmountOverflow)?,
            EscrowError::InsufficientFunds
        );

        // Use checked math to prevent overflows/underflows
        **escrow_info.try_borrow_mut_lamports()? = escrow_lamports
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow cancelled successfully, {} SOL returned to initializer", amount);
        emit!(EscrowCancelledEvent {
            escrow_address: ctx.accounts.escrow_account.key(),
            initializer: ctx.accounts.initializer.key(),
            amount,
            timestamp: escrow.last_updated_at,
        });
        
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        // Verify the escrow is no longer active
        require!(!ctx.accounts.escrow_account.is_active, EscrowError::EscrowStillActive);

        // Additional security check to ensure no funds remain (other than rent)
        let escrow = ctx.accounts.escrow_account.deref();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        
        // Allow a small buffer for calculation differences
        require!(
            ctx.accounts.escrow_account.to_account_info().lamports() <= min_rent.saturating_add(100),
            EscrowError::EscrowNotEmpty
        );

        // The close constraint in the Close struct will handle returning the rent to the initializer
        msg!("Escrow account closed successfully");
        emit!(EscrowClosedEvent {
            escrow_address: ctx.accounts.escrow_account.key(),
            initializer: ctx.accounts.initializer.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, seed: u64)]
pub struct Initialize<'info> {
    // The user initializing the escrow and paying for account creation
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    // The escrow account that will hold the funds
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", initializer.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // Required for system instructions like account creation and transfers
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    // The user who will receive the funds from the escrow
    #[account(mut)]
    pub taker: Signer<'info>,
    
    // The escrow account holding the funds
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive,
        has_one = system_program @ EscrowError::InvalidSystemProgram
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // Required for system transfers
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    // Only the initializer can cancel the escrow
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    // The escrow account holding the funds
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive,
        has_one = system_program @ EscrowError::InvalidSystemProgram
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // Required for system transfers
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    // Only the initializer can close the escrow account
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    // The escrow account to be closed
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.initializer.as_ref(), escrow_account.seed.to_le_bytes().as_ref()],
        bump = escrow_account.bump,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized,
        constraint = !escrow_account.is_active @ EscrowError::EscrowStillActive,
        close = initializer
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // Required for system operations
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Debug)]
pub struct EscrowAccount {
    pub initializer: Pubkey,      // 32 bytes - The creator of the escrow
    pub amount: u64,              // 8 bytes - The amount of SOL in escrow
    pub seed: u64,                // 8 bytes - Unique seed for PDA derivation
    pub bump: u8,                 // 1 byte - PDA bump for verification
    pub is_active: bool,          // 1 byte - Whether the escrow is still active
    pub created_at: i64,          // 8 bytes - Timestamp when escrow was created
    pub last_updated_at: i64,     // 8 bytes - Timestamp of last update
    pub system_program: Pubkey,   // 32 bytes - System program ID for security checks
    pub reserved: [u8; 32],       // 32 bytes - Reserved for future upgrades
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 8 + 8 + 32 + 32;
}

#[event]
pub struct EscrowCreatedEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub amount: u64,
    pub seed: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowExecutedEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub taker: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowCancelledEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowClosedEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Escrow is not active")]
    EscrowNotActive,
    
    #[msg("Escrow is still active")]
    EscrowStillActive,
    
    #[msg("Cannot take your own escrow")]
    CannotTakeOwnEscrow,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
    
    #[msg("Amount overflow during calculation")]
    AmountOverflow,
    
    #[msg("Bump not found in context")]
    BumpNotFound,
    
    #[msg("Escrow account still contains funds")]
    EscrowNotEmpty,
    
    #[msg("Invalid system program provided")]
    InvalidSystemProgram,
    
    #[msg("Escrow operation timeout")]
    Timeout,
}