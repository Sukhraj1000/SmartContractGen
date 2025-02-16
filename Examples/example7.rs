use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount, Mint};
use borsh::{BorshDeserialize, BorshSerialize};

// 6. Crowdfunding & Fundraising
#[program]
pub mod crowdfunding_contract {
    use super::*;

    pub fn start_campaign(ctx: Context<StartCampaign>, goal: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign_state;
        campaign.goal = goal;
        campaign.raised = 0;
        campaign.creator = *ctx.accounts.user.key;
        campaign.completed = false;
        Ok(())
    }
    
    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign_state;
        let user_account = &ctx.accounts.user_token_account;
        let campaign_account = &ctx.accounts.campaign_token_account;
        let token_program = &ctx.accounts.token_program;

        // Ensure campaign is not already funded
        require!(!campaign.completed, CampaignError::AlreadyFunded);

        // Ensure contribution does not exceed the goal
        require!(campaign.raised + amount <= campaign.goal, CampaignError::ExceedsGoal);

        // Transfer tokens from user to campaign pool
        let cpi_accounts = Transfer {
            from: user_account.to_account_info(),
            to: campaign_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        token::transfer(
            CpiContext::new(token_program.to_account_info(), cpi_accounts),
            amount,
        )?;

        // Update raised amount
        campaign.raised += amount;

        // Mark campaign as completed if goal is reached
        if campaign.raised >= campaign.goal {
            campaign.completed = true;
        }

        Ok(())
    }
}

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct CampaignState {
    pub goal: u64,       // Fundraising goal
    pub raised: u64,     // Total amount raised
    pub creator: Pubkey, // Creator of the campaign
    pub completed: bool, // Whether the goal has been reached
}

#[derive(Accounts)]
pub struct StartCampaign<'info> {
    #[account(init, payer = user, space = 8 + 8 + 8 + 32 + 1)]
    pub campaign_state: Account<'info, CampaignState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub campaign_state: Account<'info, CampaignState>,
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Token Accounts
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>, // Contributor's token account
    #[account(mut)]
    pub campaign_token_account: Account<'info, TokenAccount>, // Campaign's token account

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum CampaignError {
    #[msg("Campaign goal has already been met.")]
    AlreadyFunded,
    #[msg("Contribution exceeds campaign goal.")]
    ExceedsGoal,
}
