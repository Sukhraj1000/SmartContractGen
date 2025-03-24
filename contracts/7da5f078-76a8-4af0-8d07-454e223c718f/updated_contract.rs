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
        // Validate inputs
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(release_condition > 0, EscrowError::InvalidReleaseCondition);
        
        // Ensure release condition is in the future
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            release_condition as i64 > current_time,
            EscrowError::ReleaseConditionInPast
        );

        // Check that initializer has enough funds
        let initializer_balance = ctx.accounts.initializer.lamports();
        require!(
            initializer_balance >= amount + Rent::get()?.minimum_balance(EscrowAccount::SIZE + 8),
            EscrowError::InsufficientFunds
        );

        // Initialize escrow account data
        let escrow = &mut ctx.accounts.escrow_account;
        let initializer = &ctx.accounts.initializer;
        
        escrow.initializer = initializer.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
        escrow.bump = *ctx.bumps.get("escrow_account").ok_or(EscrowError::BumpSeedNotFound)?;
        escrow.is_active = true;
        escrow.created_at = current_time;
        escrow.last_updated_at = current_time;

        // Transfer SOL from initializer to escrow account
        let transfer_ix = system_program::Transfer {
            from: initializer.to_account_info(),
            to: ctx.accounts.escrow_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, amount)?;

        msg!("Escrow created successfully with {} SOL", amount);
        emit!(EscrowCreatedEvent {
            escrow_address: escrow.key(),
            initializer: initializer.key(),
            amount,
            release_condition,
        });
        
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        let taker = &ctx.accounts.taker;
        
        // Validate escrow state
        require!(escrow_account.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow_account.initializer != taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Validate release condition
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= escrow_account.release_condition as i64,
            EscrowError::ReleaseConditionNotMet
        );

        // Mark escrow as inactive before transfer
        escrow_account.is_active = false;
        escrow_account.last_updated_at = current_time;

        // Transfer SOL from escrow to taker
        let escrow_info = escrow_account.to_account_info();
        let taker_info = taker.to_account_info();

        // Calculate amount to transfer (ensuring we don't transfer rent)
        let amount = escrow_account.amount;
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(EscrowAccount::SIZE + 8);
        
        // Ensure escrow has enough funds
        require!(
            escrow_info.lamports() >= amount + min_rent,
            EscrowError::InsufficientFunds
        );

        // Safe transfer with checked math
        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully, transferred {} SOL to taker", amount);
        emit!(EscrowExecutedEvent {
            escrow_address: escrow_account.key(),
            taker: taker.key(),
            amount,
        });
        
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        let initializer = &ctx.accounts.initializer;
        
        // Validate escrow state
        require!(escrow_account.is_active, EscrowError::EscrowNotActive);
        
        // Verify initializer is the original creator
        require!(
            escrow_account.initializer == initializer.key(),
            EscrowError::Unauthorized
        );
        
        // Mark escrow as inactive before transfer
        escrow_account.is_active = false;
        escrow_account.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer SOL back to initializer
        let escrow_info = escrow_account.to_account_info();
        let initializer_info = initializer.to_account_info();

        // Calculate amount to transfer
        let amount = escrow_account.amount;
        
        // Ensure escrow has enough funds
        require!(
            escrow_info.lamports() >= amount,
            EscrowError::InsufficientFunds
        );

        // Safe transfer with checked math
        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow cancelled successfully, returned {} SOL to initializer", amount);
        emit!(EscrowCancelledEvent {
            escrow_address: escrow_account.key(),
            initializer: initializer.key(),
            amount,
        });
        
        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        // Validate escrow state
        require!(!ctx.accounts.escrow_account.is_active, EscrowError::EscrowStillActive);
        
        // Verify initializer is the original creator
        require!(
            ctx.accounts.escrow_account.initializer == ctx.accounts.initializer.key(),
            EscrowError::Unauthorized
        );

        // Transfer remaining lamports (rent) to initializer
        let escrow_info = ctx.accounts.escrow_account.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();
        let escrow_lamports = escrow_info.lamports();

        // Safe transfer with checked math
        **escrow_info.try_borrow_mut_lamports()? = 0;
        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(escrow_lamports)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow account closed successfully");
        emit!(EscrowClosedEvent {
            escrow_address: ctx.accounts.escrow_account.key(),
            initializer: ctx.accounts.initializer.key(),
            remaining_lamports: escrow_lamports,
        });
        
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
    
    // Rent sysvar for checking rent-exempt status
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    // Taker must sign the transaction
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
    
    // Rent sysvar for checking rent-exempt status
    pub rent: Sysvar<'info, Rent>,
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
    // Only the initializer can close the escrow
    #[account(
        mut,
        constraint = initializer.key() == escrow_account.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,
    
    // Escrow account must match the expected PDA and will be closed
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
    pub initializer: Pubkey,           // 32 bytes - Address of the escrow creator
    pub amount: u64,                   // 8 bytes - Amount of SOL locked in escrow
    pub release_condition: u64,        // 8 bytes - Timestamp or other condition for release
    pub bump: u8,                      // 1 byte - PDA bump seed for verification
    pub is_active: bool,               // 1 byte - Whether the escrow is still active
    pub created_at: i64,               // 8 bytes - Creation timestamp
    pub last_updated_at: i64,          // 8 bytes - Last update timestamp
    pub reserved: [u8; 64],            // 64 bytes - Reserved for future use
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 8 + 8 + 64;
}

#[event]
pub struct EscrowCreatedEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub amount: u64,
    pub release_condition: u64,
}

#[event]
pub struct EscrowExecutedEvent {
    pub escrow_address: Pubkey,
    pub taker: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCancelledEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowClosedEvent {
    pub escrow_address: Pubkey,
    pub initializer: Pubkey,
    pub remaining_lamports: u64,
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
    
    #[msg("Release condition has not been met yet")]
    ReleaseConditionNotMet,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
    
    #[msg("Amount calculation overflow")]
    AmountOverflow,
    
    #[msg("Bump seed not found")]
    BumpSeedNotFound,
    
    #[msg("Invalid account provided")]
    InvalidAccount,
}