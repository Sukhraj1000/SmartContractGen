use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};
use std::collections::BTreeMap;

// 5. Supply Chain & Logistics
#[program]
pub mod supply_chain_contract {
    use super::*;

    pub fn register_product(ctx: Context<RegisterProduct>, product_id: String, origin: String) -> Result<()> {
        let product = &mut ctx.accounts.product_state;

        // Ensure the product is not already registered
        require!(
            !product.registered_products.contains_key(&product_id),
            ProductError::AlreadyRegistered
        );

        product.product_id = product_id.clone();
        product.origin = origin;
        product.status = ProductStatus::Registered.to_string();

        // Track the product registration
        product.registered_products.insert(product_id, product.origin.clone());

        Ok(())
    }

    pub fn update_status(ctx: Context<UpdateStatus>, new_status: ProductStatus) -> Result<()> {
        let product = &mut ctx.accounts.product_state;
        product.status = new_status.to_string();
        Ok(())
    }
}

#[account]
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ProductState {
    pub product_id: String,                      // Unique product identifier
    pub origin: String,                          // Product origin details
    pub status: String,                          // Current product status
    pub registered_products: BTreeMap<String, String>, // Map of registered products
}

// Enum for different product statuses
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub enum ProductStatus {
    Registered,
    InTransit,
    Delivered,
    Returned,
}

impl ToString for ProductStatus {
    fn to_string(&self) -> String {
        match self {
            ProductStatus::Registered => "Registered".to_string(),
            ProductStatus::InTransit => "In Transit".to_string(),
            ProductStatus::Delivered => "Delivered".to_string(),
            ProductStatus::Returned => "Returned".to_string(),
        }
    }
}

#[derive(Accounts)]
pub struct RegisterProduct<'info> {
    #[account(init, payer = user, space = 8 + 100 + 100 + 50 + (4 + 100 * 50))]
    pub product_state: Account<'info, ProductState>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    #[account(mut)]
    pub product_state: Account<'info, ProductState>,
    #[account(signer)]
    pub user: Signer<'info>,
}

#[error_code]
pub enum ProductError {
    #[msg("Product is already registered.")]
    AlreadyRegistered,
}
