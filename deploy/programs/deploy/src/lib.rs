use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fy6hNJzz1y8odKtYW7RiDti5aQXPYtYEnqKK3pHfrt9R");

// Registry integration code
pub const REGISTRY_PROGRAM_ID: &str = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";
pub const REGISTRY_TRANSACTION_SEED: &str = "transaction_v1";

// Structure for Registry transaction data
#[derive(AnchorSerialize)]
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

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        seed: u64,
        bump: u8,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);

        let escrow = &mut ctx.accounts.escrow;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.amount = amount;
        escrow.seed = seed;
        escrow.bump = bump;
        escrow.is_active = true;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.last_updated_at = escrow.created_at;

        // Transfer lamports from initializer to escrow account
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.initializer.to_account_info(),
            to: escrow.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, amount)?;

        msg!("Escrow created successfully");
        Ok(())
    }

    pub fn execute(ctx: Context<Execute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        require!(
            escrow.initializer != ctx.accounts.taker.key(),
            EscrowError::CannotTakeOwnEscrow
        );

        // Mark escrow as inactive before transfer
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer lamports from escrow to taker
        let escrow_info = escrow.to_account_info();
        let taker_info = ctx.accounts.taker.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(escrow.amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **taker_info.try_borrow_mut_lamports()? = taker_info
            .lamports()
            .checked_add(escrow.amount)
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow executed successfully");
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(escrow.is_active, EscrowError::EscrowNotActive);
        
        // Mark escrow as inactive before transfer
        escrow.is_active = false;
        escrow.last_updated_at = Clock::get()?.unix_timestamp;

        // Transfer lamports back to initializer
        let escrow_info = escrow.to_account_info();
        let initializer_info = ctx.accounts.initializer.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? = escrow_info
            .lamports()
            .checked_sub(escrow.amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        **initializer_info.try_borrow_mut_lamports()? = initializer_info
            .lamports()
            .checked_add(escrow.amount)
            .ok_or(EscrowError::AmountOverflow)?;

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
            .ok_or(EscrowError::AmountOverflow)?;

        msg!("Escrow closed successfully");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, seed: u64, bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    
    #[account(
        init,
        payer = initializer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", seed.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"escrow", escrow.seed.to_le_bytes().as_ref()],
        bump = escrow.bump,
        constraint = escrow.is_active @ EscrowError::EscrowNotActive
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
        seeds = [b"escrow", escrow.seed.to_le_bytes().as_ref()],
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
        seeds = [b"escrow", escrow.seed.to_le_bytes().as_ref()],
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
    pub seed: u64,
    pub bump: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub last_updated_at: i64,
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 1 + 8 + 8;
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
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Amount overflow")]
    AmountOverflow,
}