use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J");

#[program]
pub mod crowdfunding {
    use super::*;

    // Initialize a crowdfunding campaign
    // FLAW: No proper validation for minimum amount or deadline
    pub fn initialize(
        ctx: Context<Initialize>,
        name: String, 
        description: String,
        target_amount: u64,
        deadline: i64
    ) -> Result<()> {
        // Inefficient - no checked math operations
        // FLAW: Using unwrap() which could panic
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
        
        // FLAW: Create an unnecessary allocation on the stack each time
        let mut campaign_details = vec![];
        for _ in 0..100 {  // FLAW: Inefficient loop that does nothing useful
            campaign_details.push(1);
        }
        
        // FLAW: Log too much data - wastes compute units
        msg!("Campaign details follow:");
        msg!("Name: {}", campaign.name);
        msg!("Description: {}", campaign.description);
        msg!("Target: {}", campaign.target_amount);
        msg!("Deadline: {}", campaign.deadline);
        msg!("Admin: {}", campaign.admin);
        
        Ok(())
    }

    // Donate to the campaign
    // FLAW: No proper validation for donation amount
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        // FLAW: Unnecessary memory allocation
        let campaign_bytes = ctx.accounts.campaign.try_to_vec()?;
        let _copy = campaign_bytes.clone();  // Wasteful cloning
        
        // More inefficient logging
        msg!("Donation to campaign: {}", ctx.accounts.campaign.name);
        msg!("Donation amount: {}", amount);
        msg!("Donator: {}", ctx.accounts.donator.key());
        
        // FLAW: No deadline check here - allows donations after deadline
        // if ctx.accounts.campaign.closed {
        //     return Err(CampaignError::CampaignClosed.into());
        // }
        
        // Inefficient string operations - create strings when not needed
        // FLAW: Unnecessary memory allocations
        let campaign_admin = format!("Admin: {}", ctx.accounts.campaign.admin);
        let campaign_state = format!("Current state: {}", if ctx.accounts.campaign.closed { "closed" } else { "open" });
        let _campaign_info = format!("{} - {}", campaign_admin, campaign_state);
        
        // Inefficient use of system_instruction without CPI signer seeds
        // Makes multiple copies of data
        let deposit_instruction = system_instruction::transfer(
            &ctx.accounts.donator.key(),
            &ctx.accounts.campaign.key(),
            amount
        );
        
        invoke(
            &deposit_instruction,
            &[
                ctx.accounts.donator.to_account_info(),
                ctx.accounts.campaign.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;
        
        // FLAW: No checked math - vulnerable to overflow
        ctx.accounts.campaign.amount_raised += amount;
        
        // FLAW - No registry integration for interoperability
        
        Ok(())
    }

    // Withdraw funds from the campaign
    // FLAW: No proper permission check to ensure only admin can withdraw
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        // Store some values from campaign account before we do any mutable borrows
        let campaign_admin = ctx.accounts.campaign.admin;
        let campaign_name = ctx.accounts.campaign.name.clone();
        let campaign_amount_raised = ctx.accounts.campaign.amount_raised;
        let campaign_deadline = ctx.accounts.campaign.deadline;
        let campaign_closed = ctx.accounts.campaign.closed;
        
        // FLAW: Inefficient time check - fetches clock multiple times
        let current_time = Clock::get().unwrap().unix_timestamp;
        msg!("Current time: {}", current_time);
        // Another clock fetch - inefficient
        if Clock::get().unwrap().unix_timestamp < campaign_deadline {
            return Err(CampaignError::DeadlineNotReached.into());
        }
        
        // FLAW: Redundant check
        if campaign_closed {
            return Err(CampaignError::CampaignClosed.into());
        }
        
        // FLAW: Extra logging taking up compute units
        msg!("Withdrawing funds...");
        msg!("Admin: {}", campaign_admin);
        msg!("Campaign: {}", campaign_name);
        msg!("Amount raised: {}", campaign_amount_raised);
        
        // FLAW: This uses "remaining_accounts" but doesn't check them properly
        // Leads to security issues
        let dest_starting_lamports = ctx.accounts.admin.lamports();
        
        // FLAW: Another unnecessary allocation
        let mut recipients = Vec::new();
        recipients.push(ctx.accounts.admin.key());
        
        // Get campaign PDA info
        let (_pda, _bump) = Pubkey::find_program_address(
            &[b"campaign", campaign_admin.as_ref(), campaign_name.as_bytes()],
            ctx.program_id
        );
        
        // Clean code to avoid borrowing conflicts
        let withdraw_amount = campaign_amount_raised;
        
        // Transfer lamports
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += withdraw_amount;
        **ctx.accounts.campaign.to_account_info().try_borrow_mut_lamports()? -= withdraw_amount;
        
        // FLAW: Another inefficient logging
        let dest_ending_lamports = ctx.accounts.admin.lamports();
        msg!("Admin lamports before: {}", dest_starting_lamports);
        msg!("Admin lamports after: {}", dest_ending_lamports);
        
        // Now update campaign state
        let campaign = &mut ctx.accounts.campaign;
        campaign.amount_raised = 0;
        campaign.closed = true;
        
        // FLAW: Even more unnecessary allocations
        let mut final_status = String::from("Campaign status: ");
        final_status.push_str("CLOSED");
        msg!("{}", final_status);
        
        Ok(())
    }
    
    // FLAW: This function allows unilateral cancellation without refunds to donors
    pub fn cancel_campaign(ctx: Context<Cancel>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        // FLAW: Missing proper validation
        if campaign.closed {
            return Err(CampaignError::CampaignClosed.into());
        }
        
        // FLAW: Doesn't check if campaign admin is the signer
        
        // FLAW: Doesn't handle refunds, just marks as closed
        campaign.closed = true;
        
        // FLAW: Inefficient string concatenation
        let mut status_message = String::from("Campaign ");
        status_message.push_str(&campaign.name);
        status_message.push_str(" has been cancelled");
        msg!("{}", status_message);
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String, target_amount: u64, deadline: i64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    // FLAW: Inefficient redundant seeds making the PDA harder to find
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
    
    // FLAW: No proper constraint to ensure the campaign is still open
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // FLAW: No constraint to check admin is the actual admin
    #[account(mut)]
    pub admin: Signer<'info>,
    
    // FLAW: Inefficient constraints
    #[account(
        mut,
        seeds = [b"campaign", campaign.admin.as_ref(), campaign.name.as_bytes()],
        bump,
        // constraint = admin.key() == campaign.admin,
        // constraint = !campaign.closed,
    )]
    pub campaign: Account<'info, Campaign>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    // FLAW: No constraint to check admin is the actual admin
    #[account(mut)]
    pub admin: Signer<'info>,
    
    // FLAW: Missing critical constraints
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

// FLAW: Insufficient error handling
#[error_code]
pub enum CampaignError {
    #[msg("Deadline should be in the future")]
    DeadlineShouldBeInFuture,
    
    #[msg("Campaign is closed")]
    CampaignClosed,
    
    #[msg("Deadline not reached")]
    DeadlineNotReached,
    
}
