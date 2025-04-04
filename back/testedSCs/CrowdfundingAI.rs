use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("P5bpdBoUnWyRdHzdmcM9rtrWLiLEVGmtNm5JESZDDPY");

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
pub mod deploy {
    use super::*;

    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        campaign_name: String,
        description: String,
        target_amount: u64,
        end_time: i64,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        // Properly clone string values that will be used later
        campaign.campaign_name = campaign_name.clone();
        campaign.description = description.clone();
        
        campaign.creator = ctx.accounts.creator.key();
        campaign.beneficiary = ctx.accounts.beneficiary.key();
        campaign.target_amount = target_amount;
        campaign.raised_amount = 0;
        campaign.end_time = end_time;
        campaign.is_active = true;
        campaign.is_successful = false;
        
        // Create a seed for PDA derivation
        campaign.seed = ctx.bumps.campaign;
        campaign.created_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        msg!("Campaign initialized: {}", campaign_name);
        
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        // Validate campaign state
        require!(ctx.accounts.campaign.is_active, CampaignError::CampaignInactive);
        require!(
            Clock::get().expect("Failed to get clock").unix_timestamp <= ctx.accounts.campaign.end_time,
            CampaignError::CampaignEnded
        );
        
        // Build and invoke the system instruction to transfer lamports
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.campaign_account.key(),
            amount,
        );
        
        invoke(
            &transfer_instruction,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.campaign_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Update campaign state
        let campaign = &mut ctx.accounts.campaign;
        campaign.raised_amount = campaign
            .raised_amount
            .checked_add(amount)
            .ok_or(CampaignError::MathOverflow)?;
            
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        // Create registry transaction data
        let _registry_tx_data = RegistryTransactionData {
            tx_type: "donation".to_string(),
            amount,
            initiator: ctx.accounts.donor.key(),
            target_account: ctx.accounts.campaign.key(),
            description: format!("Donation to campaign: {}", ctx.accounts.campaign.campaign_name),
        };
        
        msg!("Donation of {} lamports received", amount);
        
        Ok(())
    }

    pub fn finalize_campaign(ctx: Context<FinalizeCampaign>) -> Result<()> {
        // Validate campaign state
        require!(ctx.accounts.campaign.is_active, CampaignError::CampaignInactive);
        require!(
            Clock::get().expect("Failed to get clock").unix_timestamp > ctx.accounts.campaign.end_time,
            CampaignError::CampaignStillActive
        );
        
        // Set campaign as inactive
        let campaign = &mut ctx.accounts.campaign;
        campaign.is_active = false;
        
        // Determine if campaign was successful
        campaign.is_successful = campaign.raised_amount >= campaign.target_amount;
        
        // If successful, transfer funds to beneficiary
        if campaign.is_successful {
            let campaign_lamports = ctx.accounts.campaign_account.lamports();
            let raised_amount = campaign.raised_amount;
            
            **ctx.accounts.campaign_account.try_borrow_mut_lamports()? = campaign_lamports
                .checked_sub(raised_amount)
                .ok_or(CampaignError::MathOverflow)?;
                
            **ctx.accounts.beneficiary.try_borrow_mut_lamports()? = ctx
                .accounts
                .beneficiary
                .lamports()
                .checked_add(raised_amount)
                .ok_or(CampaignError::MathOverflow)?;
                
            // Create registry transaction data
            let _registry_tx_data = RegistryTransactionData {
                tx_type: "campaign_finalized".to_string(),
                amount: raised_amount,
                initiator: ctx.accounts.creator.key(),
                target_account: ctx.accounts.beneficiary.key(),
                description: format!("Campaign finalized: {}", campaign.campaign_name),
            };
            
            msg!("Campaign successful! Funds transferred to beneficiary");
        } else {
            msg!("Campaign unsuccessful. Funds can be refunded.");
        }
        
        campaign.last_updated_at = Clock::get().expect("Failed to get clock").unix_timestamp;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: This is the beneficiary who will receive the funds if campaign is successful
    pub beneficiary: AccountInfo<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + CampaignAccount::SIZE,
        seeds = [b"crowdfunding", creator.key().as_ref()],
        bump
    )]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account will hold the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account will hold the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCampaign<'info> {
    #[account(
        constraint = campaign.creator == creator.key() @ CampaignError::UnauthorizedAccess
    )]
    pub creator: Signer<'info>,
    /// CHECK: This is the beneficiary who will receive the funds
    #[account(mut)]
    pub beneficiary: AccountInfo<'info>,
    #[account(mut)]
    pub campaign: Account<'info, CampaignAccount>,
    /// CHECK: This account holds the campaign funds
    #[account(mut)]
    pub campaign_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct CampaignAccount {
    pub creator: Pubkey,
    pub beneficiary: Pubkey,
    pub campaign_name: String,
    pub description: String,
    pub target_amount: u64,
    pub raised_amount: u64,
    pub end_time: i64,
    pub is_active: bool,
    pub is_successful: bool,
    pub seed: u8,
    pub created_at: i64,
    pub last_updated_at: i64,
}

impl CampaignAccount {
    // Size calculation breakdown:
    // Pubkey: 32 bytes
    // String size: 4 bytes (length) + max_content_bytes
    pub const SIZE: usize = 32 + // creator
                             32 + // beneficiary
                             4 + 50 + // campaign_name (max 50 chars)
                             4 + 255 + // description (max 255 chars)
                             8 + // target_amount
                             8 + // raised_amount
                             8 + // end_time
                             1 + // is_active
                             1 + // is_successful
                             1 + // seed
                             8 + // created_at
                             8;  // last_updated_at
}

#[error_code]
pub enum CampaignError {
    #[msg("Campaign is inactive")]
    CampaignInactive,
    #[msg("Campaign has already ended")]
    CampaignEnded,
    #[msg("Campaign is still active")]
    CampaignStillActive,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Math overflow error")]
    MathOverflow,
}