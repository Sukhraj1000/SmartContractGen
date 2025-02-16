use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

// 3. Subscription & Membership Services
#[program]
pub mod subscription_contract {
    use super::*;

    pub fn subscribe(ctx: Context<Subscribe>, duration_days: u64) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription_state;

        // Ensure user is not already subscribed
        require!(!subscription.active, SubscriptionError::AlreadySubscribed);

        // Activate subscription and set expiry
        subscription.active = true;
        subscription.subscriber = *ctx.accounts.user.key;
        subscription.valid_until = Clock::get()?.unix_timestamp + (duration_days as i64) * 86400; // Convert days to seconds

        Ok(())
    }

    pub fn unsubscribe(ctx: Context<Unsubscribe>) -> Result<()> {
        let subscription = &mut ctx.accounts.subscription_state;

        // Ensure user is subscribed
        require!(subscription.active, SubscriptionError::NotSubscribed);

        // Deactivate subscription
        subscription.active = false;

        Ok(())
    }
}

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct SubscriptionState {
    pub active: bool,       // Subscription status
    pub subscriber: Pubkey, // User's public key
    pub valid_until: i64,   // Expiration timestamp (Unix time)
}

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(init, payer = user, space = 8 + 1 + 32 + 8)]
    pub subscription_state: Account<'info, SubscriptionState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unsubscribe<'info> {
    #[account(mut, has_one = subscriber)]
    pub subscription_state: Account<'info, SubscriptionState>,
    #[account(signer)]
    pub subscriber: Signer<'info>,
}

#[error_code]
pub enum SubscriptionError {
    #[msg("User is already subscribed.")]
    AlreadySubscribed,
    #[msg("User is not subscribed.")]
    NotSubscribed,
}
