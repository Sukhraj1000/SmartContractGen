use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg");

#[program]
pub mod token_vesting {
    use super::*;

    pub fn initialize_vesting(
        ctx: Context<InitializeVesting>,
        total_tokens: u64,
        vesting_period: i64,
        cliff_period: i64,
        seed: u64,
        bump: u8,
    ) -> Result<()> {
        // Validate inputs
        require!(total_tokens > 0, VestingError::InvalidAmount);
        require!(vesting_period > 0, VestingError::InvalidVestingPeriod);
        require!(cliff_period >= 0, VestingError::InvalidCliffPeriod);
        require!(cliff_period <= vesting_period, VestingError::CliffExceedsVesting);

        let current_time = Clock::get()?.unix_timestamp;
        let vesting = &mut ctx.accounts.vesting_account;
        
        // Initialize vesting account
        vesting.admin = ctx.accounts.admin.key();
        vesting.beneficiary = ctx.accounts.beneficiary.key();
        vesting.total_amount = total_tokens;
        vesting.released_amount = 0;
        vesting.start_time = current_time;
        vesting.cliff_time = current_time.checked_add(cliff_period).ok_or(VestingError::TimeCalculationError)?;
        vesting.end_time = current_time.checked_add(vesting_period).ok_or(VestingError::TimeCalculationError)?;
        vesting.seed = seed;
        vesting.bump = bump;
        vesting.is_active = true;
        vesting.created_at = current_time;
        vesting.last_updated_at = current_time;

        // Transfer tokens from admin to vesting account
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.admin.to_account_info(),
            to: ctx.accounts.vesting_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, total_tokens)?;

        msg!("Vesting initialized for {} lamports", total_tokens);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_account;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if vesting is active
        require!(vesting.is_active, VestingError::VestingNotActive);
        
        // Check if cliff has been reached
        require!(current_time >= vesting.cliff_time, VestingError::CliffNotReached);
        
        // Calculate available amount
        let available_amount = if current_time >= vesting.end_time {
            // Full vesting period completed
            vesting.total_amount.checked_sub(vesting.released_amount)
                .ok_or(VestingError::CalculationError)?
        } else {
            // Linear vesting between cliff and end time
            let total_vesting_duration = vesting.end_time.checked_sub(vesting.start_time)
                .ok_or(VestingError::CalculationError)?;
            
            let time_since_start = current_time.checked_sub(vesting.start_time)
                .ok_or(VestingError::CalculationError)?;
            
            let vested_percentage = (time_since_start as u64)
                .checked_mul(10000) // Use basis points for precision
                .ok_or(VestingError::CalculationError)?
                .checked_div(total_vesting_duration as u64)
                .ok_or(VestingError::CalculationError)?;
            
            let vested_amount = vesting.total_amount
                .checked_mul(vested_percentage)
                .ok_or(VestingError::CalculationError)?
                .checked_div(10000)
                .ok_or(VestingError::CalculationError)?;
            
            vested_amount.checked_sub(vesting.released_amount)
                .ok_or(VestingError::InsufficientVestedAmount)?
        };
        
        // Verify requested amount is available
        require!(amount > 0, VestingError::InvalidAmount);
        require!(amount <= available_amount, VestingError::InsufficientVestedAmount);
        
        // Update released amount
        vesting.released_amount = vesting.released_amount
            .checked_add(amount)
            .ok_or(VestingError::CalculationError)?;
        
        vesting.last_updated_at = current_time;
        
        // Check if all tokens have been released
        if vesting.released_amount == vesting.total_amount {
            vesting.is_active = false;
        }
        
        // Transfer lamports from vesting account to beneficiary
        let vesting_info = vesting.to_account_info();
        let beneficiary_info = ctx.accounts.beneficiary.to_account_info();
        
        **vesting_info.try_borrow_mut_lamports()? = vesting_info
            .lamports()
            .checked_sub(amount)
            .ok_or(VestingError::InsufficientFunds)?;
        
        **beneficiary_info.try_borrow_mut_lamports()? = beneficiary_info
            .lamports()
            .checked_add(amount)
            .ok_or(VestingError::CalculationError)?;
        
        msg!("Withdrawn {} lamports", amount);
        Ok(())
    }
    
    pub fn cancel_vesting(ctx: Context<CancelVesting>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_account;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Ensure vesting is still active
        require!(vesting.is_active, VestingError::VestingNotActive);
        
        // Calculate remaining amount
        let remaining_amount = vesting.total_amount
            .checked_sub(vesting.released_amount)
            .ok_or(VestingError::CalculationError)?;
        
        // Mark vesting as inactive
        vesting.is_active = false;
        vesting.last_updated_at = current_time;
        
        // Transfer remaining lamports back to admin
        let vesting_info = vesting.to_account_info();
        let admin_info = ctx.accounts.admin.to_account_info();
        
        **vesting_info.try_borrow_mut_lamports()? = vesting_info
            .lamports()
            .checked_sub(remaining_amount)
            .ok_or(VestingError::InsufficientFunds)?;
        
        **admin_info.try_borrow_mut_lamports()? = admin_info
            .lamports()
            .checked_add(remaining_amount)
            .ok_or(VestingError::CalculationError)?;
        
        msg!("Vesting cancelled, {} lamports returned to admin", remaining_amount);
        Ok(())
    }
    
    pub fn close_vesting_account(ctx: Context<CloseVestingAccount>) -> Result<()> {
        let vesting = &ctx.accounts.vesting_account;
        
        // Ensure vesting is inactive
        require!(!vesting.is_active, VestingError::VestingStillActive);
        
        // Ensure all tokens have been released
        require!(
            vesting.released_amount == vesting.total_amount,
            VestingError::FundsRemaining
        );
        
        // The close constraint in the account validation will handle returning the rent
        
        msg!("Vesting account closed");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(total_tokens: u64, vesting_period: i64, cliff_period: i64, seed: u64, bump: u8)]
pub struct InitializeVesting<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: This account is only used to store the beneficiary's public key
    pub beneficiary: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + VestingAccount::SIZE,
        seeds = [b"vesting", admin.key().as_ref(), beneficiary.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump = bump
    )]
    pub vesting_account: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", vesting_account.admin.as_ref(), beneficiary.key().as_ref(), vesting_account.seed.to_le_bytes().as_ref()],
        bump = vesting_account.bump,
        constraint = vesting_account.beneficiary == beneficiary.key() @ VestingError::Unauthorized
    )]
    pub vesting_account: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelVesting<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", admin.key().as_ref(), vesting_account.beneficiary.as_ref(), vesting_account.seed.to_le_bytes().as_ref()],
        bump = vesting_account.bump,
        constraint = vesting_account.admin == admin.key() @ VestingError::Unauthorized
    )]
    pub vesting_account: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseVestingAccount<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", admin.key().as_ref(), vesting_account.beneficiary.as_ref(), vesting_account.seed.to_le_bytes().as_ref()],
        bump = vesting_account.bump,
        constraint = vesting_account.admin == admin.key() @ VestingError::Unauthorized,
        close = admin
    )]
    pub vesting_account: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VestingAccount {
    pub admin: Pubkey,
    pub beneficiary: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_time: i64,
    pub cliff_time: i64,
    pub end_time: i64,
    pub seed: u64,
    pub bump: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub last_updated_at: i64,
    // Reserved for future upgrades
    pub reserved: [u8; 64],
}

impl VestingAccount {
    pub const SIZE: usize = 32 + // admin
                            32 + // beneficiary
                            8 +  // total_amount
                            8 +  // released_amount
                            8 +  // start_time
                            8 +  // cliff_time
                            8 +  // end_time
                            8 +  // seed
                            1 +  // bump
                            1 +  // is_active
                            8 +  // created_at
                            8 +  // last_updated_at
                            64;  // reserved
}

#[error_code]
pub enum VestingError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Vesting period must be greater than zero")]
    InvalidVestingPeriod,
    
    #[msg("Cliff period must be non-negative")]
    InvalidCliffPeriod,
    
    #[msg("Cliff period cannot exceed vesting period")]
    CliffExceedsVesting,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Vesting schedule is not active")]
    VestingNotActive,
    
    #[msg("Vesting schedule is still active")]
    VestingStillActive,
    
    #[msg("Cliff time not reached yet")]
    CliffNotReached,
    
    #[msg("Insufficient vested amount available")]
    InsufficientVestedAmount,
    
    #[msg("Insufficient funds in the vesting account")]
    InsufficientFunds,
    
    #[msg("Calculation error")]
    CalculationError,
    
    #[msg("Time calculation error")]
    TimeCalculationError,
    
    #[msg("All funds must be released before closing")]
    FundsRemaining,
}