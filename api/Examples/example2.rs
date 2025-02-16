use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

// 1. Automated Legal Agreements
#[program]
pub mod legal_agreement {
    use super::*;

    // Initialize contract with type and details
    pub fn initialize(ctx: Context<Initialize>, contract_type: String, details: String) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement_state;
        agreement.contract_type = contract_type;
        agreement.details = details;
        agreement.completed = false;
        agreement.signers = Vec::new();
        Ok(())
    }

    // Signing contract by a party
    pub fn sign_contract(ctx: Context<SignContract>) -> Result<()> {
        let agreement = &mut ctx.accounts.agreement_state;
        let signer = ctx.accounts.user.key();

        // Ensure contract is not already completed
        require!(!agreement.completed, AgreementError::AlreadySigned);

        // Check if the signer has already signed
        require!(
            !agreement.signers.contains(&signer),
            AgreementError::AlreadySignedByUser
        );

        // Append signer
        agreement.signers.push(signer);

        // If at least 2 signers exist, mark contract as completed
        if agreement.signers.len() >= MIN_SIGNERS {
            agreement.completed = true;
        }
        Ok(())
    }
}

// Constants
const MIN_SIGNERS: usize = 2; // Minimum number of signers required

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct AgreementState {
    pub contract_type: String, // Type of contract
    pub details: String,       // Contract details
    pub signers: Vec<Pubkey>,  // List of signer public keys
    pub completed: bool,       // Completion status
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 64 + 512 + (4 + 32 * 5) + 1)]
    pub agreement_state: Account<'info, AgreementState>, // Contract state
    #[account(mut)]
    pub user: Signer<'info>, // Contract creator
    pub system_program: Program<'info, System>, // System program reference
}

#[derive(Accounts)]
pub struct SignContract<'info> {
    #[account(mut)]
    pub agreement_state: Account<'info, AgreementState>, // Contract state
    #[account(signer)]
    pub user: Signer<'info>, // Signing user
}

#[error_code]
pub enum AgreementError {
    #[msg("Contract has already been signed by all required parties.")]
    AlreadySigned,
    #[msg("You have already signed this contract.")]
    AlreadySignedByUser,
}
