use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};
use std::collections::BTreeMap;

// 4. Decentralized Voting & Governance
#[program]
pub mod voting_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, proposal: String) -> Result<()> {
        let vote = &mut ctx.accounts.vote_state;
        vote.proposal = proposal;
        vote.yes_votes = 0;
        vote.no_votes = 0;
        vote.voters = BTreeMap::new(); // Initialize voter tracking
        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, vote: bool) -> Result<()> {
        let vote_state = &mut ctx.accounts.vote_state;
        let voter = ctx.accounts.user.key();

        // Prevent double voting
        require!(
            !vote_state.voters.contains_key(&voter),
            VoteError::AlreadyVoted
        );

        // Record the vote
        vote_state.voters.insert(voter, vote);

        // Update vote counts
        if vote {
            vote_state.yes_votes += 1;
        } else {
            vote_state.no_votes += 1;
        }

        Ok(())
    }
}

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct VoteState {
    pub proposal: String,                  // The proposal being voted on
    pub yes_votes: u64,                     // Number of 'yes' votes
    pub no_votes: u64,                      // Number of 'no' votes
    pub voters: BTreeMap<Pubkey, bool>,     // Tracks voters and their choices
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 200 + 8 + 8 + (4 + 32 * 50))]
    pub vote_state: Account<'info, VoteState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub vote_state: Account<'info, VoteState>,
    #[account(signer)]
    pub user: Signer<'info>,
}

#[error_code]
pub enum VoteError {
    #[msg("You have already voted.")]
    AlreadyVoted,
}
