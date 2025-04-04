use anchor_lang::prelude::*;

// Fixed Program ID for the Registry contract - this is the actual deployed ID
// This should never change once deployed
declare_id!("BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn");

#[program]
pub mod registry {
    use super::*;
    
    pub fn register_transaction(
        ctx: Context<RegisterTransaction>,
        tx_type: String,
        amount: u64,
        initiator: Pubkey,
        target_account: Pubkey,
        description: String,
    ) -> Result<()> {
        let transaction_record = &mut ctx.accounts.transaction_record;
        
        // Store transaction data
        transaction_record.tx_type = tx_type;
        transaction_record.amount = amount;
        transaction_record.initiator = initiator;
        transaction_record.target_account = target_account;
        transaction_record.caller_program_id = ctx.accounts.caller_program_id.key();
        transaction_record.description = description;
        transaction_record.timestamp = Clock::get()?.unix_timestamp;
        
        msg!("Transaction registered: {} SOL", amount as f64 / 1_000_000_000.0);
        
        Ok(())
    }
    
    pub fn verify_transaction(
        ctx: Context<VerifyTransaction>,
        expected_amount: u64,
    ) -> Result<()> {
        let transaction_record = &ctx.accounts.transaction_record;
        
        // Simple verification - check that transaction exists and amount matches
        require!(
            transaction_record.amount == expected_amount,
            RegistryError::InvalidAmount
        );
        
        msg!("Transaction verified successfully");
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(tx_type: String, amount: u64)]
pub struct RegisterTransaction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// CHECK: This account is not written to and just used for verification
    pub caller_program_id: AccountInfo<'info>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + TransactionRecord::SIZE,
        seeds = [
            b"transaction_v1",
            payer.key().as_ref(),
            tx_type.as_bytes(),
            &amount.to_le_bytes()
        ],
        bump
    )]
    pub transaction_record: Account<'info, TransactionRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyTransaction<'info> {
    pub requester: Signer<'info>,
    
    pub transaction_record: Account<'info, TransactionRecord>,
}

#[account]
pub struct TransactionRecord {
    pub tx_type: String,        // Max 50 chars: 50 * 4 = 200
    pub amount: u64,            // 8 bytes
    pub initiator: Pubkey,      // 32 bytes
    pub target_account: Pubkey, // 32 bytes
    pub caller_program_id: Pubkey, // 32 bytes
    pub description: String,    // Max 100 chars: 100 * 4 = 400
    pub timestamp: i64,         // 8 bytes
}

// Calculate total size
impl TransactionRecord {
    pub const SIZE: usize = 200 + 8 + 32 + 32 + 32 + 400 + 8;
}

#[error_code]
pub enum RegistryError {
    #[msg("Transaction amount does not match expected amount")]
    InvalidAmount,
}
