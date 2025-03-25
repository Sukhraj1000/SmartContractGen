use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8a76RhBfP78tuN2WtZaP11ESgeCStcfb9E78Pf9wz4Yg");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        name: String,
        description: String,
        target_amount: u64,
        end_time: i64,
        seed: u64,
        bump: u8,
    ) -> Result<()> {
        require!(target_amount > 0, CampaignError::InvalidAmount);
        require!(
            end_time > Clock::get()?.unix_timestamp,
            CampaignError::InvalidEndTime
        );
        require!(name.len() <= 50, CampaignError::NameTooLong);
        require!(description.len() <= 255, CampaignError::DescriptionTooLong);

        let campaign = &mut ctx.accounts.campaign;
        campaign.creator = ctx.accounts.creator.key();
        campaign.name = name;
        campaign.description = description;
        campaign.target_amount = target_amount;
        campaign.raised_amount = 0;
        campaign.end_time = end_time;
        campaign.is_active = true;
        campaign.is_successful = false;
        campaign.seed = seed;
        campaign.bump = bump;
        campaign.created_at = Clock::get()?.unix_timestamp;
        campaign.last_updated_at = campaign.created_at;
        
        msg!("Campaign created successfully");
        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let contributor = &ctx.accounts.contributor;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if campaign is still active
        require!(campaign.is_active, CampaignError::CampaignNotActive);
        
        // Check if campaign hasn't ended
        require!(
            current_time <= campaign.end_time,
            CampaignError::CampaignEnded
        );
        
        // Check contribution amount
        require!(amount > 0, CampaignError::InvalidAmount);
        
        // Update campaign state
        campaign.raised_amount = campaign.raised_amount
            .checked_add(amount)
            .ok_or(CampaignError::AmountOverflow)?;
        
        campaign.last_updated_at = current_time;
        
        // Check if target has been reached
        if campaign.raised_amount >= campaign.target_amount {
            campaign.is_successful = true;
        }
        
        // Transfer lamports from contributor to campaign account
        let transfer_ix = system_program::Transfer {
            from: contributor.to_account_info(),
            to: campaign.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix,
        );
        
        system_program::transfer(cpi_ctx, amount)?;
        
        msg!("Contributed {} lamports to campaign", amount);
        Ok(())
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let creator = &ctx.accounts.creator;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if creator is authorized
        require!(
            creator.key() == campaign.creator,
            CampaignError::Unauthorized
        );
        
        // Check if campaign is successful or ended without success
        if !campaign.is_successful {
            require!(
                current_time > campaign.end_time,
                CampaignError::CampaignNotEnded
            );
        }
        
        if campaign.is_successful {
            // If campaign is successful, transfer all funds to creator
            let amount = campaign.raised_amount;
            
            // Transfer lamports from campaign to creator
            let campaign_info = campaign.to_account_info();
            let creator_info = creator.to_account_info();
            
            **campaign_info.try_borrow_mut_lamports()? = campaign_info
                .lamports()
                .checked_sub(amount)
                .ok_or(CampaignError::InsufficientFunds)?;
            
            **creator_info.try_borrow_mut_lamports()? = creator_info
                .lamports()
                .checked_add(amount)
                .ok_or(CampaignError::AmountOverflow)?;
            
            campaign.raised_amount = 0;
            
            msg!("Successful campaign: withdrew {} lamports", amount);
        } else {
            // If campaign failed, refunds will be processed separately
            // This will mark the campaign as not active
            msg!("Campaign did not meet target");
        }
        
        campaign.is_active = false;
        campaign.last_updated_at = current_time;
        
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let contributor = &ctx.accounts.contributor;
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if campaign has ended and was not successful
        require!(!campaign.is_active, CampaignError::CampaignStillActive);
        require!(!campaign.is_successful, CampaignError::CampaignSuccessful);
        require!(
            current_time > campaign.end_time,
            CampaignError::CampaignNotEnded
        );
        
        // Check refund amount
        require!(amount > 0, CampaignError::InvalidAmount);
        require!(
            amount <= campaign.raised_amount,
            CampaignError::InsufficientFunds
        );
        
        // Update campaign state
        campaign.raised_amount = campaign.raised_amount
            .checked_sub(amount)
            .ok_or(CampaignError::AmountOverflow)?;
        
        campaign.last_updated_at = current_time;
        
        // Transfer lamports from campaign to contributor
        let campaign_info = campaign.to_account_info();
        let contributor_info = contributor.to_account_info();
        
        **campaign_info.try_borrow_mut_lamports()? = campaign_info
            .lamports()
            .checked_sub(amount)
            .ok_or(CampaignError::InsufficientFunds)?;
        
        **contributor_info.try_borrow_mut_lamports()? = contributor_info
            .lamports()
            .checked_add(amount)
            .ok_or(CampaignError::AmountOverflow)?;
        
        msg!("Refunded {} lamports to contributor", amount);
        Ok(())
    }
    
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        
        // Check if creator is authorized
        require!(
            ctx.accounts.creator.key() == campaign.creator,
            CampaignError::Unauthorized
        );
        
        // Check if campaign is inactive
        require!(!campaign.is_active, CampaignError::CampaignStillActive);
        
        // Check if all funds have been withdrawn or refunded
        require!(
            campaign.raised_amount == 0,
            CampaignError::FundsRemaining
        );
        
        // Transfer rent exemption back to creator
        // (close = creator attribute handles this automatically)
        
        msg!("Campaign account closed");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String, target_amount: u64, end_time: i64, seed: u64, bump: u8)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + CampaignAccount::SIZE,
        seeds = [b"campaign", seed.to_le_bytes().as_ref()],
        bump = bump
    )]
    pub campaign: Account<'info, CampaignAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.seed.to_le_bytes().as_ref()],
        bump = campaign.bump,
        constraint = campaign.is_active @ CampaignError::CampaignNotActive
    )]
    pub campaign: Account<'info, CampaignAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ CampaignError::Unauthorized
    )]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.seed.to_le_bytes().as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, CampaignAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.seed.to_le_bytes().as_ref()],
        bump = campaign.bump,
        constraint = !campaign.is_active @ CampaignError::CampaignStillActive,
        constraint = !campaign.is_successful @ CampaignError::CampaignSuccessful
    )]
    pub campaign: Account<'info, CampaignAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ CampaignError::Unauthorized
    )]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.seed.to_le_bytes().as_ref()],
        bump = campaign.bump,
        constraint = !campaign.is_active @ CampaignError::CampaignStillActive,
        constraint = campaign.raised_amount == 0 @ CampaignError::FundsRemaining,
        close = creator
    )]
    pub campaign: Account<'info, CampaignAccount>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CampaignAccount {
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub target_amount: u64,
    pub raised_amount: u64,
    pub end_time: i64,
    pub is_active: bool,
    pub is_successful: bool,
    pub seed: u64,
    pub bump: u8,
    pub created_at: i64,
    pub last_updated_at: i64,
}

impl CampaignAccount {
    // Size calculation:
    // Pubkey (32) + String (4+50) + String (4+255) + u64 (8) + u64 (8) + i64 (8) + 
    // bool (1) + bool (1) + u64 (8) + u8 (1) + i64 (8) + i64 (8)
    pub const SIZE: usize = 32 + 4 + 50 + 4 + 255 + 8 + 8 + 8 + 1 + 1 + 8 + 1 + 8 + 8;
}

#[error_code]
pub enum CampaignError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    
    #[msg("End time must be in the future")]
    InvalidEndTime,
    
    #[msg("Campaign name too long (max 50 chars)")]
    NameTooLong,
    
    #[msg("Campaign description too long (max 255 chars)")]
    DescriptionTooLong,
    
    #[msg("Campaign is not active")]
    CampaignNotActive,
    
    #[msg("Campaign is still active")]
    CampaignStillActive,
    
    #[msg("Campaign has already ended")]
    CampaignEnded,
    
    #[msg("Campaign has not ended yet")]
    CampaignNotEnded,
    
    #[msg("Campaign was successful, no refunds available")]
    CampaignSuccessful,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Math overflow error")]
    AmountOverflow,
    
    #[msg("All funds must be withdrawn or refunded before closing")]
    FundsRemaining,
} 