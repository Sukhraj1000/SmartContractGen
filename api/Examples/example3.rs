use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};
use std::collections::BTreeMap;

// 2. Tokenized Assets & Ownership
#[program]
pub mod tokenized_asset {
    use super::*;

    // Initialize asset with a total supply
    pub fn initialize(ctx: Context<Initialize>, asset_name: String, total_supply: u64) -> Result<()> {
        let asset = &mut ctx.accounts.asset_state;
        asset.asset_name = asset_name;
        asset.total_supply = total_supply;
        asset.owner = *ctx.accounts.user.key;
        asset.balances.insert(asset.owner, total_supply);
        Ok(())
    }

    // Transfer asset ownership
    pub fn transfer(ctx: Context<TransferAsset>, recipient: Pubkey, amount: u64) -> Result<()> {
        let asset = &mut ctx.accounts.asset_state;
        let sender = ctx.accounts.owner.key();

        // Ensure sender has enough balance
        let sender_balance = asset.balances.get(&sender).copied().unwrap_or(0);
        require!(sender_balance >= amount, AssetError::InsufficientBalance);

        // Deduct from sender
        asset.balances.insert(sender, sender_balance - amount);

        // Add to recipient
        let recipient_balance = asset.balances.get(&recipient).copied().unwrap_or(0);
        asset.balances.insert(recipient, recipient_balance + amount);

        Ok(())
    }
}

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct AssetState {
    pub asset_name: String,          // Name of the asset
    pub total_supply: u64,           // Total supply
    pub owner: Pubkey,               // Asset creator
    pub balances: BTreeMap<Pubkey, u64>, // Token balances per user
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 64 + 8 + 32 + 200)]
    pub asset_state: Account<'info, AssetState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferAsset<'info> {
    #[account(mut, has_one = owner)]
    pub asset_state: Account<'info, AssetState>,
    #[account(signer)]
    pub owner: Signer<'info>,
}

#[error_code]
pub enum AssetError {
    #[msg("Insufficient asset balance.")]
    InsufficientBalance,
}
