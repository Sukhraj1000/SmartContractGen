use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg");

#[program]
pub mod token_vesting {
    use super::*;

    pub fn create_vesting_schedule(
        ctx: Context<CreateVestingSchedule>,
        total_amount: u64,
        release_time: i64,
        cliff_time: i64,
        seed: u64,
        bump: u8,
    ) -> Result<()> {
        // Validate inputs
        require!(total_amount > 0, VestingError::InvalidAmount);
        require!(
            release_time > Clock::get()?.unix_timestamp,
            VestingError::InvalidReleaseTime
        );
        require!(
            cliff_time <= release_time,
            VestingError::InvalidCliffTime
        );

        let vesting = &mut ctx.accounts.vesting;
        vesting.admin = ctx.accounts.admin.key();
        vesting.beneficiary = ctx.accounts.beneficiary.key();
        vesting.total_amount = total_amount;
        vesting.release_time = release_time;
        vesting.cliff_time = cliff_time;
        vesting.released_amount = 0;
        vesting.seed = seed;
        vesting.bump = bump;
        vesting.is_active = true;
        vesting.created_at = Clock::get()?.unix_timestamp;
        vesting.last_updated_at = vesting.created_at;

        // Transfer lamports from admin to vesting account
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.admin.to_account_info(),
            to: vesting.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );

        system_program::transfer(cpi_ctx, total_amount)?;

        msg!("Vesting schedule created successfully");
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if vesting schedule is active
        require!(vesting.is_active, VestingError::VestingNotActive);
        
        // Check if beneficiary is the one withdrawing
        require!(
            ctx.accounts.beneficiary.key() == vesting.beneficiary,
            VestingError::Unauthorized
        );
        
        // Check if cliff time has been reached
        require!(
            current_time >= vesting.cliff_time,
            VestingError::CliffNotReached
        );
        
        // Calculate available amount
        let available_amount = if current_time >= vesting.release_time {
            // Full amount available
            vesting.total_amount.checked_sub(vesting.released_amount)
                .ok_or(VestingError::AmountOverflow)?
        } else {
            // Linear vesting between cliff and release time
            let total_vesting_time = vesting.release_time.checked_sub(vesting.cliff_time)
                .ok_or(VestingError::InvalidSchedule)?;
            let time_since_cliff = current_time.checked_sub(vesting.cliff_time)
                .ok_or(VestingError::InvalidTime)?;
            
            let vested_percentage = (time_since_cliff as u64)
                .checked_mul(100)
                .ok_or(VestingError::AmountOverflow)?
                .checked_div(total_vesting_time as u64)
                .ok_or(VestingError::DivisionError)?;
            
            let vested_amount = vesting.total_amount
                .checked_mul(vested_percentage)
                .ok_or(VestingError::AmountOverflow)?
                .checked_div(100)
                .ok_or(VestingError::DivisionError)?;
            
            vested_amount.checked_sub(vesting.released_amount)
                .ok_or(VestingError::InsufficientFunds)?
        };
        
        // Verify requested amount is available
        require!(
            amount <= available_amount,
            VestingError::InsufficientFunds
        );
        
        // Update released amount
        vesting.released_amount = vesting.released_amount
            .checked_add(amount)
            .ok_or(VestingError::AmountOverflow)?;
        
        vesting.last_updated_at = current_time;
        
        // If all funds are withdrawn, mark as inactive
        if vesting.released_amount == vesting.total_amount {
            vesting.is_active = false;
        }
        
        // Transfer lamports from vesting to beneficiary
        let vesting_info = vesting.to_account_info();
        let beneficiary_info = ctx.accounts.beneficiary.to_account_info();
        
        **vesting_info.try_borrow_mut_lamports()? = vesting_info
            .lamports()
            .checked_sub(amount)
            .ok_or(VestingError::InsufficientFunds)?;
        
        **beneficiary_info.try_borrow_mut_lamports()? = beneficiary_info
            .lamports()
            .checked_add(amount)
            .ok_or(VestingError::AmountOverflow)?;
        
        msg!("Withdrawn {} lamports", amount);
        Ok(())
    }
    
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting;
        
        // Only admin can cancel
        require!(
            ctx.accounts.admin.key() == vesting.admin,
            VestingError::Unauthorized
        );
        
        // Vesting must be active
        require!(vesting.is_active, VestingError::VestingNotActive);
        
        // Calculate remaining amount
        let remaining_amount = vesting.total_amount
            .checked_sub(vesting.released_amount)
            .ok_or(VestingError::AmountOverflow)?;
        
        vesting.is_active = false;
        vesting.last_updated_at = Clock::get()?.unix_timestamp;
        
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
            .ok_or(VestingError::AmountOverflow)?;
        
        msg!("Vesting schedule cancelled");
        Ok(())
    }
    
    pub fn close(ctx: Context<Close>) -> Result<()> {
        let vesting = &ctx.accounts.vesting;
        
        // Only admin can close
        require!(
            ctx.accounts.admin.key() == vesting.admin,
            VestingError::Unauthorized
        );
        
        // Vesting must be inactive
        require!(!vesting.is_active, VestingError::VestingStillActive);
        
        // Ensure all funds have been released
        require!(
            vesting.released_amount == vesting.total_amount,
            VestingError::FundsRemaining
        );
        
        // Transfer rent exemption back to admin
        // (close = admin attribute will handle this automatically)
        
        msg!("Vesting account closed");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(total_amount: u64, release_time: i64, cliff_time: i64, seed: u64, bump: u8)]
pub struct CreateVestingSchedule<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: Only storing public key
    pub beneficiary: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + VestingAccount::SIZE,
        seeds = [b"vesting", seed.to_le_bytes().as_ref()],
        bump = bump
    )]
    pub vesting: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", vesting.seed.to_le_bytes().as_ref()],
        bump = vesting.bump,
        constraint = vesting.beneficiary == beneficiary.key() @ VestingError::Unauthorized,
        constraint = vesting.is_active @ VestingError::VestingNotActive
    )]
    pub vesting: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", vesting.seed.to_le_bytes().as_ref()],
        bump = vesting.bump,
        constraint = vesting.admin == admin.key() @ VestingError::Unauthorized,
        constraint = vesting.is_active @ VestingError::VestingNotActive
    )]
    pub vesting: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vesting", vesting.seed.to_le_bytes().as_ref()],
        bump = vesting.bump,
        constraint = vesting.admin == admin.key() @ VestingError::Unauthorized,
        constraint = !vesting.is_active @ VestingError::VestingStillActive,
        close = admin
    )]
    pub vesting: Account<'info, VestingAccount>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct VestingAccount {
    pub admin: Pubkey,
    pub beneficiary: Pubkey,
    pub total_amount: u64,
    pub release_time: i64,
    pub cliff_time: i64,
    pub released_amount: u64,
    pub seed: u64,
    pub bump: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub last_updated_at: i64,
}

impl VestingAccount {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8;
}

#[error_code]
pub enum VestingError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("Release time must be in the future")]
    InvalidReleaseTime,
    
    #[msg("Cliff time must be before or equal to release time")]
    InvalidCliffTime,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Vesting schedule is not active")]
    VestingNotActive,
    
    #[msg("Vesting schedule is still active")]
    VestingStillActive,
    
    #[msg("Cliff time not reached yet")]
    CliffNotReached,
    
    #[msg("Insufficient funds available")]
    InsufficientFunds,
    
    #[msg("Math overflow error")]
    AmountOverflow,
    
    #[msg("Division error")]
    DivisionError,
    
    #[msg("Invalid vesting schedule")]
    InvalidSchedule,
    
    #[msg("Invalid time calculation")]
    InvalidTime,
    
    #[msg("All funds must be released before closing")]
    FundsRemaining,
} 