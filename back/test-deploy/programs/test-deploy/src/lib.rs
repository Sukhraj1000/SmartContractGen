
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod ddd {
    use super::*;

    /// Initialize a new escrow account
    /// This creates the escrow and transfers the specified amount of tokens from the initializer to the escrow account
    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        release_condition: String,
    ) -> Result<()> {
        // Validate inputs
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(!release_condition.is_empty(), EscrowError::InvalidReleaseCondition);

        // Initialize escrow state
        let escrow = &mut ctx.accounts.escrow;
        escrow.initializer = ctx.accounts.initializer.key();
        escrow.initializer_deposit_token_account = ctx.accounts.initializer_deposit_token_account.key();
        escrow.receiver = ctx.accounts.receiver.key();
        escrow.receiver_token_account = ctx.accounts.receiver_token_account.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.release_condition = release_condition;
        escrow.is_active = true;
        escrow.bump = *ctx.bumps.get("escrow").unwrap();

        // Transfer tokens from initializer to escrow token account
        let transfer_instruction = Transfer {
            from: ctx.accounts.initializer_deposit_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        );

        token::transfer(cpi_ctx, amount)?;

        emit!(EscrowCreatedEvent {
            escrow: escrow.key(),
            initializer: escrow.initializer,
            receiver: escrow.receiver,
            amount,
        });

        Ok(())
    }

    /// Release funds from escrow to the receiver
    /// Can only be called by the initializer
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        // Verify escrow is active
        require!(escrow.is_active, EscrowError::EscrowNotActive);

        // Transfer tokens from escrow to receiver
        let seeds = &[
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_instruction = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.receiver_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer,
        );

        token::transfer(cpi_ctx, escrow.amount)?;

        // Mark escrow as inactive
        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.is_active = false;

        emit!(EscrowReleasedEvent {
            escrow: escrow.key(),
            initializer: escrow.initializer,
            receiver: escrow.receiver,
            amount: escrow.amount,
        });

        Ok(())
    }

    /// Cancel the escrow and return funds to the initializer
    /// Can only be called by the initializer
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        
        // Verify escrow is active
        require!(escrow.is_active, EscrowError::EscrowNotActive);

        // Transfer tokens from escrow back to initializer
        let seeds = &[
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_instruction = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.initializer_deposit_token_account.to_account_info(),
            authority: ctx.accounts.escrow_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer,
        );

        token::transfer(cpi_ctx, escrow.amount)?;

        // Mark escrow as inactive
        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.is_active = false;

        emit!(EscrowCancelledEvent {
            escrow: escrow.key(),
            initializer: escrow.initializer,
            receiver: escrow.receiver,
            amount: escrow.amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, release_condition: String)]
pub struct Initialize<'info> {
    /// The user initializing the escrow
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// The token account that will fund the escrow
    #[account(
        mut,
        constraint = initializer_deposit_token_account.owner == initializer.key() @ EscrowError::InvalidOwner,
        constraint = initializer_deposit_token_account.mint == mint.key() @ EscrowError::InvalidMint,
        constraint = initializer_deposit_token_account.amount >= amount @ EscrowError::InsufficientFunds,
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    /// The intended receiver of the escrowed tokens
    /// CHECK: This is not a signer and doesn't need to be a valid account at initialization
    pub receiver: UncheckedAccount<'info>,

    /// The token account that will receive the tokens when released
    #[account(
        constraint = receiver_token_account.owner == receiver.key() @ EscrowError::InvalidOwner,
        constraint = receiver_token_account.mint == mint.key() @ EscrowError::InvalidMint,
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,

    /// The token mint
    pub mint: Account<'info, token::Mint>,

    /// The escrow account that will hold the state
    #[account(
        init,
        payer = initializer,
        space = Escrow::LEN,
        seeds = [
            b"escrow".as_ref(),
            initializer.key().as_ref(),
            receiver.key().as_ref(),
        ],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// The token account owned by the escrow PDA, which will hold the escrowed tokens
    #[account(
        init,
        payer = initializer,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// System program for creating accounts
    pub system_program: Program<'info, System>,
    
    /// Token program for token operations
    pub token_program: Program<'info, Token>,
    
    /// Rent sysvar for rent exemption
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// The initializer of the escrow, who must sign to release funds
    #[account(
        mut,
        constraint = initializer.key() == escrow.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,

    /// The receiver of the escrowed tokens
    /// CHECK: We're just reading this account, not writing to it
    #[account(
        constraint = receiver.key() == escrow.receiver @ EscrowError::InvalidReceiver
    )]
    pub receiver: UncheckedAccount<'info>,

    /// The token account that will receive the tokens
    #[account(
        mut,
        constraint = receiver_token_account.key() == escrow.receiver_token_account @ EscrowError::InvalidTokenAccount,
        constraint = receiver_token_account.owner == receiver.key() @ EscrowError::InvalidOwner,
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,

    /// The escrow account holding the state
    #[account(
        mut,
        seeds = [
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
        ],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// The escrow account itself, used as a signer for the PDA
    /// CHECK: This is the PDA that owns the escrow token account
    #[account(
        seeds = [
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
        ],
        bump = escrow.bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    /// The token account owned by the escrow PDA, which holds the escrowed tokens
    #[account(
        mut,
        constraint = escrow_token_account.mint == escrow.mint @ EscrowError::InvalidMint,
        constraint = escrow_token_account.owner == escrow.key() @ EscrowError::InvalidOwner,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Token program for token operations
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    /// The initializer of the escrow, who must sign to cancel
    #[account(
        mut,
        constraint = initializer.key() == escrow.initializer @ EscrowError::Unauthorized
    )]
    pub initializer: Signer<'info>,

    /// The token account that will receive the returned tokens
    #[account(
        mut,
        constraint = initializer_deposit_token_account.key() == escrow.initializer_deposit_token_account @ EscrowError::InvalidTokenAccount,
        constraint = initializer_deposit_token_account.owner == initializer.key() @ EscrowError::InvalidOwner,
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    /// The escrow account holding the state
    #[account(
        mut,
        seeds = [
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
        ],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// The escrow account itself, used as a signer for the PDA
    /// CHECK: This is the PDA that owns the escrow token account
    #[account(
        seeds = [
            b"escrow".as_ref(),
            escrow.initializer.as_ref(),
            escrow.receiver.as_ref(),
        ],
        bump = escrow.bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    /// The token account owned by the escrow PDA, which holds the escrowed tokens
    #[account(
        mut,
        constraint = escrow_token_account.mint == escrow.mint @ EscrowError::InvalidMint,
        constraint = escrow_token_account.owner == escrow.key() @ EscrowError::InvalidOwner,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Token program for token operations
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Escrow {
    /// The account that initialized the escrow
    pub initializer: Pubkey,
    
    /// The token account of the initializer that funded the escrow
    pub initializer_deposit_token_account: Pubkey,
    
    /// The account that will receive the tokens when released
    pub receiver: Pubkey,
    
    /// The token account of the receiver that will receive the tokens
    pub receiver_token_account: Pubkey,
    
    /// The mint of the token being escrowed
    pub mint: Pubkey,
    
    /// The amount of tokens being escrowed
    pub amount: u64,
    
    /// The condition that must be met for release
    pub release_condition: String,
    
    /// Whether the escrow is active or has been completed/cancelled
    pub is_active: bool,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl Escrow {
    // Space calculation for the account
    pub const LEN: usize = 8 + // discriminator
        32 + // initializer
        32 + // initializer_deposit_token_account
        32 + // receiver
        32 + // receiver_token_account
        32 + // mint
        8 +  // amount
        4 + 256 + // release_condition (String with max 256 chars)
        1 +  // is_active
        1;   // bump
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid amount specified")]
    InvalidAmount,
    
    #[msg("Invalid release condition")]
    InvalidReleaseCondition,
    
    #[msg("Insufficient funds in token account")]
    InsufficientFunds,
    
    #[msg("Invalid token account owner")]
    InvalidOwner,
    
    #[msg("Invalid mint")]
    InvalidMint,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Invalid receiver")]
    InvalidReceiver,
    
    #[msg("Escrow is not active")]
    EscrowNotActive,
    
    #[msg("Unauthorized operation")]
    Unauthorized,
}

// Events
#[event]
pub struct EscrowCreatedEvent {
    pub escrow: Pubkey,
    pub initializer: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowReleasedEvent {
    pub escrow: Pubkey,
    pub initializer: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCancelledEvent {
    pub escrow: Pubkey,
    pub initializer: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
}

