use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

// Define the program module
#[program]
pub mod contract_generator {
    use super::*;

    // Initialize process for contract generation
    pub fn initialize(ctx: Context<Initialize>, doc_hash: String) -> Result<()> {
        let process = &mut ctx.accounts.process_state;
        process.current_step = 0; // Start at step 0
        process.completed = false; // Process is not completed
        process.doc_hash = doc_hash; // Store document hash for tracking
        process.user_input = None; // No user input at initialization
        Ok(())
    }

    // Move to the next step in contract validation
    pub fn next_step(ctx: Context<NextStep>, user_input: String) -> Result<()> {
        let process = &mut ctx.accounts.process_state;

        // Ensure the process is not already completed
        require!(!process.completed, ProcessError::AlreadyCompleted);
        
        // Store user input for further verification
        process.user_input = Some(user_input);
        process.current_step += 1;
        
        // Validate step completion
        if (process.current_step as usize) >= TOTAL_STEPS {
            process.completed = true;
        }
        Ok(())
    }
}

// Define constants for total steps
const TOTAL_STEPS: usize = 5;

// Account structure to store contract state
#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ProcessState {
    pub current_step: u8, // The current step in the process
    pub completed: bool,  // Whether the process is finished
    pub doc_hash: String, // Hash of the legal document for reference
    pub user_input: Option<String>, // Additional user-provided information
}

// Context for initializing the process
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 1 + 1 + 100 + 4 + 200)]
    pub process_state: Account<'info, ProcessState>, // Store contract state
    #[account(mut)]
    pub user: Signer<'info>, // User initializing the contract process
    pub system_program: Program<'info, System>, // Required system program
}

// Context for moving to the next step
#[derive(Accounts)]
pub struct NextStep<'info> {
    #[account(mut)]
    pub process_state: Account<'info, ProcessState>, // Modify contract state
    pub user: Signer<'info>, // User must sign to proceed
}

// Define custom errors for contract processing
#[error_code]
pub enum ProcessError {
    #[msg("The process has already been completed.")]
    AlreadyCompleted,
}
