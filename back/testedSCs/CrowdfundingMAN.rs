use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J");

#[program]
pub mod crowdfunding {
    use super::*;

    /// Creates a new crowdfunding campaign
    pub fn initialize(
        ctx: Context<Initialize>,
        name: String, 
        description: String,
        target_amount: u64,
        deadline: i64
    ) -> Result<()> {
        if deadline < Clock::get().unwrap().unix_timestamp {
            return Err(CampaignError::DeadlineShouldBeInFuture.into());
        }

        let campaign = &mut ctx.accounts.campaign;
        campaign.admin = ctx.accounts.admin.key();
        campaign.name = name;
        campaign.description = description;
        campaign.target_amount = target_amount;
        campaign.deadline = deadline;
        campaign.amount_raised = 0;
        campaign.closed = false;
        
        Ok(())
    }

    /// Processes a donation to the campaign
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let donator = &ctx.accounts.donator;
        
        if campaign.closed {
            return Err(CampaignError::CampaignNotActive.into());
        }
        
        if Clock::get().unwrap().unix_timestamp >= campaign.deadline {
            return Err(CampaignError::CampaignEnded.into());
        }

        invoke(
            &system_instruction::transfer(
                &donator.key(),
                &campaign.key(),
                amount
            ),
            &[
                donator.to_account_info(),
                campaign.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        campaign.amount_raised += amount;

        Ok(())
    }

    /// Allows admin to withdraw funds after deadline
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let admin = &ctx.accounts.admin;

        if Clock::get().unwrap().unix_timestamp < campaign.deadline {
            return Err(CampaignError::DeadlineNotReached.into());
        }

        if campaign.closed {
            return Err(CampaignError::CampaignNotActive.into());
        }

        let campaign_key = campaign.key();
        **campaign.to_account_info().try_borrow_mut_lamports()? = 0;
        **admin.to_account_info().try_borrow_mut_lamports()? += campaign.to_account_info().lamports();

        campaign.closed = true;

        Ok(())
    }

    /// Allows admin to cancel campaign before deadline
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        if Clock::get().unwrap().unix_timestamp >= campaign.deadline {
            return Err(CampaignError::DeadlineReached.into());
        }

        if campaign.closed {
            return Err(CampaignError::CampaignNotActive.into());
        }

        campaign.closed = true;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String, target_amount: u64, deadline: i64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 4 + name.len() + 4 + description.len() + 8 + 8 + 8 + 1,
        seeds = [b"campaign", admin.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donator: Signer<'info>,
    
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.admin.as_ref(), campaign.name.as_bytes()],
        bump,

    )]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"campaign", campaign.admin.as_ref(), campaign.name.as_bytes()],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Campaign {
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
    pub target_amount: u64,
    pub amount_raised: u64,
    pub deadline: i64,
    pub closed: bool,
}

// Error handling
#[error_code]
pub enum CampaignError {
    #[msg("Deadline should be in the future")]
    DeadlineShouldBeInFuture,
    
    #[msg("Campaign is closed")]
    CampaignClosed,
    
    #[msg("Deadline not reached")]
    DeadlineNotReached,
    
}
