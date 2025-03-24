use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::cmp::min;

declare_id!("DjnhicViRThy9waQKPuMch25kuKKLCMyoZDfo2cgsH33");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        release_condition: u64,
    ) -> Result<()> {
        // Validate input parameters
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(release_condition > 0, EscrowError::InvalidReleaseCondition);

        let current_time = Clock::get()?.unix_timestamp as u64;
        require!(
            release_condition > current_time,
            EscrowError::ReleaseConditionInPast
        );

        // Check that amount is not too small (must cover rent)
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        require!(
            amount >= min_rent,
            EscrowError::InsufficientFundsForRent
        );

        // Initialize escrow account data
        let escrow = &mut ctx.accounts.escrow_account;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
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
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Verify release condition is met
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= escrow.release_condition as i64,
            EscrowError::ReleaseConditionNotMet
        );

        // Mark escrow as inactive before transfer
        escrow.is_active = false;
        escrow.last_updated_at = current_time;

        // Transfer SOL from escrow to taker
        let escrow_info = escrow.to_account_info();
        let taker_info = ctx.accounts.taker.to_account_info();

        // Calculate amount to transfer (ensuring we don't transfer rent)
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        let escrow_balance = escrow_info.lamports();
        
        // Ensure we're not transferring below the minimum rent
        let amount_to_transfer = min(escrow.amount, escrow_balance.saturating_sub(min_rent));
        require!(amount_to_transfer > 0, EscrowError::InsufficientFunds);

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount_to_transfer)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(amount_to_transfer)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully, {} SOL transferred to taker", amount_to_transfer);
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Validate escrow state
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer == ctx.accounts.initializer.key(),
            EscrowError::Unauthorized
        );
        
        // Mark escrow as inactive before transfer
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL back to initializer
        let escrow_info = escrow.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();

        // Calculate amount to transfer
        let escrow_balance = escrow_info.lamports();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        
        // Ensure we're not transferring below the minimum rent
        let amount_to_transfer = min(escrow.amount, escrow_balance.saturating_sub(min_rent));
        require!(amount_to_transfer > 0, EscrowError::InsufficientFunds);

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount_to_transfer)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(amount_to_transfer)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow cancelled successfully, {} SOL returned to initializer", amount_to_transfer);
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        // Validate escrow state
        require!(!ctx.accounts.escrow_account.is_active, EscrowError::EscrowStillActive);
        require!(
            ctx.accounts.escrow_account.initializer == ctx.accounts.initializer.key(),
            EscrowError::Unauthorized
        );

        // Check if enough time has passed since the escrow was deactivated
        let current_time = Clock::get()?.unix_timestamp;
        let cooldown_period = 60; // 1 minute cooldown
        require!(
            current_time >= ctx.accounts.escrow_account.last_updated_at + cooldown_period,
            EscrowError::CloseEscrowTooEarly
        );

        // Transfer remaining lamports (rent) to initializer
        // This is handled automatically by the close constraint in the Close struct
        
        msg!("Escrow account closed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, release_condition: u64)]
pub struct Initialize<'info> {
    // Initializer must sign and pay for the transaction
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    // Escrow account is a PDA derived from initializer and release condition
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [
            b"escrow", 
            initializer.key().as_ref(), 
            release_condition.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // System program is required for creating accounts and transferring SOL
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    // Taker must sign the transaction and will receive the funds
    #[account(mut)]
    pub taker: Signer<'info>,
    
    // Escrow account must be active and match the expected PDA
    #[account(
        mut,
        seeds = [
            b"escrow", 
            escrow_account.initializer.as_ref(), 
            escrow_account.release_condition.to_le_bytes().as_ref()
        ],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // System program is required for transferring SOL
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
    
    // Escrow account must be active and match the expected PDA
    #[account(
        mut,
        seeds = [
            b"escrow", 
            escrow_account.initializer.as_ref(), 
            escrow_account.release_condition.to_le_bytes().as_ref()
        ],
        bump = escrow_account.bump,
        constraint = escrow_account.is_active @ EscrowError::EscrowNotActive
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // System program is required for transferring SOL
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    // Only the initializer can close the escrow account
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    // Escrow account must be inactive and match the expected PDA
    // close = initializer will close the account and send remaining lamports to initializer
    #[account(
        mut,
        seeds = [
            b"escrow", 
            escrow_account.initializer.as_ref(), 
            escrow_account.release_condition.to_le_bytes().as_ref()
        ],
        bump = escrow_account.bump,
        constraint = !escrow_account.is_active @ EscrowError::EscrowStillActive,
        close = initializer
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    // System program is required for closing accounts
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Debug)]
pub struct EscrowAccount {
    pub initializer: Pubkey,        // 32 bytes - The account that created the escrow
    pub amount: u64,                // 8 bytes - Amount of SOL in escrow
    pub release_condition: u64,     // 8 bytes - Unix timestamp when funds can be released
    pub bump: u8,                   // 1 byte - PDA bump seed for verification
    pub is_active: bool,            // 1 byte - Whether the escrow is active
    pub created_at: i64,            // 8 bytes - Creation timestamp
    pub last_updated_at: i64,       // 8 bytes - Last update timestamp
    pub reserved: [u8; 64],         // 64 bytes - Reserved for future upgrades
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 8 + 8 + 64;
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Release condition must be greater than zero")]
    InvalidReleaseCondition,
    
    #[msg("Release condition must be in the future")]
    ReleaseConditionInPast,
    
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
    
    #[msg("Amount overflow")]
    AmountOverflow,
    
    #[msg("Release condition not yet met")]
    ReleaseConditionNotMet,
    
    #[msg("Bump not found")]
    BumpNotFound,
    
    #[msg("Insufficient funds to cover rent")]
    InsufficientFundsForRent,
    
    #[msg("Must wait for cooldown period before closing escrow")]
    CloseEscrowTooEarly,
}