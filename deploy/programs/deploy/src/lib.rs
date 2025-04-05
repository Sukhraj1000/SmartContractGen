use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};

declare_id!("4cxUnCwFNdjbg33t8Di6DwA18c55oXkvtXWXC3sdMUdo");

#[program]
pub mod escrow {
    use super::*;

    // Initialize an escrow transaction
    pub fn initialize(ctx: Context<Initialize>, amount: u64, release_date: i64) -> Result<()> {
        // Prepare the data first
        let seller_key = ctx.accounts.seller.key();
        let buyer_key = ctx.accounts.buyer.key();
        let escrow_key = ctx.accounts.escrow_account.key();
        
        // Set up escrow account
        let escrow_account = &mut ctx.accounts.escrow_account;
        escrow_account.seller = seller_key;
        escrow_account.buyer = buyer_key;
        escrow_account.amount = amount;
        escrow_account.release_date = release_date;
        escrow_account.is_completed = false;
        escrow_account.is_cancelled = false;

        // Transfer funds from seller to the escrow account
        let transfer_instruction = system_instruction::transfer(
            &seller_key,
            &escrow_key,
            amount,
        );

        invoke_signed(
            &transfer_instruction,
            &[
                ctx.accounts.seller.to_account_info(),
                ctx.accounts.escrow_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;

        emit!(EscrowCreated {
            escrow_id: escrow_key,
            seller: seller_key,
            buyer: buyer_key,
            amount,
            release_date,
        });

        Ok(())
    }

    // Complete the escrow and release funds to the buyer
    pub fn complete(ctx: Context<Complete>) -> Result<()> {
        // Get necessary keys first to avoid borrowing conflicts
        let escrow_key = ctx.accounts.escrow_account.key();
        
        let escrow_account = &mut ctx.accounts.escrow_account;
        let buyer_key = escrow_account.buyer;
        let seller_key = escrow_account.seller;
        let amount = escrow_account.amount;

        // Check if escrow is already completed or cancelled
        require!(!escrow_account.is_completed, EscrowError::AlreadyCompleted);
        require!(!escrow_account.is_cancelled, EscrowError::AlreadyCancelled);

        // Check if caller is the seller
        require!(
            ctx.accounts.seller.key() == seller_key,
            EscrowError::Unauthorized
        );

        // Mark escrow as completed
        escrow_account.is_completed = true;

        // Transfer funds from escrow account to buyer
        let transfer_instruction = system_instruction::transfer(
            &escrow_key,
            &buyer_key,
            amount,
        );

        // Get PDA seeds for signing
        let (_pda, bump) = Pubkey::find_program_address(
            &[
                b"escrow",
                seller_key.as_ref(),
                buyer_key.as_ref(),
            ],
            ctx.program_id,
        );
        let seeds = &[
            b"escrow",
            seller_key.as_ref(),
            buyer_key.as_ref(),
            &[bump],
        ];

        invoke_signed(
            &transfer_instruction,
            &[
                ctx.accounts.escrow_account.to_account_info(),
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&seeds[..]],
        )?;

        emit!(EscrowCompleted {
            escrow_id: escrow_key,
            seller: seller_key,
            buyer: buyer_key,
            amount,
        });

        Ok(())
    }

    // Cancel the escrow and return funds to the seller
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        // Get necessary keys first to avoid borrowing conflicts
        let escrow_key = ctx.accounts.escrow_account.key();
        
        let escrow_account = &mut ctx.accounts.escrow_account;
        let buyer_key = escrow_account.buyer;
        let seller_key = escrow_account.seller;
        let amount = escrow_account.amount;

        // Check if escrow is already completed or cancelled
        require!(!escrow_account.is_completed, EscrowError::AlreadyCompleted);
        require!(!escrow_account.is_cancelled, EscrowError::AlreadyCancelled);

        // Check if the caller is the seller
        require!(
            ctx.accounts.seller.key() == seller_key,
            EscrowError::Unauthorized
        );

        // Mark escrow as cancelled
        escrow_account.is_cancelled = true;

        // Transfer funds back to seller from escrow account
        let transfer_instruction = system_instruction::transfer(
            &escrow_key,
            &seller_key,
            amount,
        );

        // Get PDA seeds for signing
        let (_pda, bump) = Pubkey::find_program_address(
            &[
                b"escrow",
                seller_key.as_ref(),
                buyer_key.as_ref(),
            ],
            ctx.program_id,
        );
        let seeds = &[
            b"escrow",
            seller_key.as_ref(),
            buyer_key.as_ref(),
            &[bump],
        ];

        invoke_signed(
            &transfer_instruction,
            &[
                ctx.accounts.escrow_account.to_account_info(),
                ctx.accounts.seller.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&seeds[..]],
        )?;

        emit!(EscrowCancelled {
            escrow_id: escrow_key,
            seller: seller_key,
            buyer: buyer_key,
            amount,
        });

        Ok(())
    }

    // Release funds to buyer if the release date has passed
    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        // Get necessary keys first to avoid borrowing conflicts
        let escrow_key = ctx.accounts.escrow_account.key();
        
        let escrow_account = &mut ctx.accounts.escrow_account;
        let buyer_key = escrow_account.buyer;
        let seller_key = escrow_account.seller;
        let amount = escrow_account.amount;
        let release_date = escrow_account.release_date;

        // Check if escrow is already completed or cancelled
        require!(!escrow_account.is_completed, EscrowError::AlreadyCompleted);
        require!(!escrow_account.is_cancelled, EscrowError::AlreadyCancelled);

        // Check if release date has passed
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= release_date,
            EscrowError::ReleaseTimeNotReached
        );

        // Mark escrow as completed
        escrow_account.is_completed = true;

        // Transfer funds from escrow account to buyer
        let transfer_instruction = system_instruction::transfer(
            &escrow_key,
            &buyer_key,
            amount,
        );

        // Get PDA seeds for signing
        let (_pda, bump) = Pubkey::find_program_address(
            &[
                b"escrow",
                seller_key.as_ref(),
                buyer_key.as_ref(),
            ],
            ctx.program_id,
        );
        let seeds = &[
            b"escrow",
            seller_key.as_ref(),
            buyer_key.as_ref(),
            &[bump],
        ];

        invoke_signed(
            &transfer_instruction,
            &[
                ctx.accounts.escrow_account.to_account_info(),
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&seeds[..]],
        )?;

        emit!(EscrowCompleted {
            escrow_id: escrow_key,
            seller: seller_key,
            buyer: buyer_key,
            amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    /// CHECK: This is the buyer's address
    pub buyer: AccountInfo<'info>,
    #[account(
        init,
        payer = seller,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", seller.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Complete<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    /// CHECK: This is the buyer's address
    #[account(mut)]
    pub buyer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"escrow", seller.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", seller.key().as_ref(), escrow_account.buyer.as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    /// CHECK: This can be any signer to trigger release after the date
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: This is the buyer's address
    #[account(mut)]
    pub buyer: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"escrow", escrow_account.seller.as_ref(), buyer.key().as_ref()],
        bump,
        constraint = buyer.key() == escrow_account.buyer
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub release_date: i64,
    pub is_completed: bool,
    pub is_cancelled: bool,
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + // seller pubkey
                            32 + // buyer pubkey
                            8 +  // amount u64
                            8 +  // release_date i64
                            1 +  // is_completed bool
                            1; // is_cancelled bool
}

#[error_code]
pub enum EscrowError {
    #[msg("Escrow has already been completed")]
    AlreadyCompleted,
    #[msg("Escrow has already been cancelled")]
    AlreadyCancelled,
    #[msg("Unauthorized access to escrow")]
    Unauthorized,
    #[msg("Release time has not been reached yet")]
    ReleaseTimeNotReached,
}

// Events
#[event]
pub struct EscrowCreated {
    pub escrow_id: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub release_date: i64,
}

#[event]
pub struct EscrowCompleted {
    pub escrow_id: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCancelled {
    pub escrow_id: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

