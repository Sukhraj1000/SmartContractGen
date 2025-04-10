use anchor_lang::prelude::*;
use std::str::FromStr;

// Registry Interface Code for Anchor Programs
// This interface allows any Anchor program to register transactions with
// the central Registry program on Solana devnet for tracking purposes

pub const REGISTRY_PROGRAM_ID: &str = "BhETt1LhzVYpK5DTcRuNZdKyb3QTz8HktUoXQJQapmvn";
pub const REGISTRY_TRANSACTION_SEED: &str = "transaction_v1";

// Rest of file unchanged... 