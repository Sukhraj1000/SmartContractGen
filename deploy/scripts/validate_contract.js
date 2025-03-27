#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Validating smart contract...');

const librsPath = path.join(__dirname, '..', 'programs', 'deploy', 'src', 'lib.rs');

// Check if lib.rs exists
if (!fs.existsSync(librsPath)) {
  console.error('Error: lib.rs not found!');
  process.exit(1);
}

// Read the contract
const contract = fs.readFileSync(librsPath, 'utf8');

// Validate required components
const requiredComponents = [
  { pattern: /#\[program\]/g, name: 'program attribute' },
  { pattern: /declare_id!\(/g, name: 'declare_id!' },
  { pattern: /#\[derive\(Accounts\)\]/g, name: 'Accounts derive macro' },
  { pattern: /#\[account\]/g, name: 'account attribute' },
  { pattern: /pub struct [A-Za-z]+<'info>/g, name: "account struct with 'info lifetime" },
  { pattern: /bump =/g, name: 'bump seed assignment' }
];

const errors = [];
const warnings = [];

// Check each required component
requiredComponents.forEach(({ pattern, name }) => {
  if (!pattern.test(contract)) {
    errors.push(`Missing ${name} in contract`);
  }
});

// Check for potential stack size issues
if (contract.length > 100000) {
  warnings.push('Contract is very large and may have stack size issues. Consider splitting functionality.');
}

// Check for unchecked arithmetic that might cause overflows
const arithmeticOps = contract.match(/\w+\s*[\+\-\*\/]=\s*\w+/g) || [];
const uncheckedMath = arithmeticOps.filter(op => !op.includes('checked_'));
if (uncheckedMath.length > 0) {
  warnings.push(`Found ${uncheckedMath.length} potentially unchecked arithmetic operations. Consider using checked_add, checked_sub, etc.`);
}

// Check for PDA validation
if (!contract.includes('seeds =') || !contract.includes('bump =')) {
  warnings.push('PDA validation might be incomplete. Ensure proper seeds and bump validation.');
}

// Check string size limitations
const stringSizes = contract.match(/String,.*\/\/.*\d+\s*bytes/g) || [];
if (stringSizes.length === 0) {
  warnings.push('String fields should have size comments for clarity (e.g., // max 50 bytes).');
}

// Check for missing error handlers
if (!contract.includes('#[error_code]')) {
  errors.push('Missing error codes enum. Use #[error_code] to define custom errors.');
}

// Run cargo check for additional validation
try {
  console.log('Running cargo check...');
  execSync('cd .. && cargo check', { stdio: 'inherit' });
} catch (error) {
  errors.push('Cargo check failed. See output above for details.');
}

// Display results
if (errors.length > 0) {
  console.error('\nValidation failed with errors:');
  errors.forEach(error => console.error(`  - ${error}`));
}

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  warnings.forEach(warning => console.warn(`  - ${warning}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\nContract validation completed successfully! No issues found.');
} else if (errors.length === 0) {
  console.log('\nContract validation completed with warnings only. Can proceed with caution.');
} else {
  console.error('\nPlease fix the errors before proceeding.');
  process.exit(1);
}

// Detect contract type
console.log('\nDetecting contract type...');
if (contract.includes('pub mod escrow')) {
  console.log('Contract type detected: escrow');
} else if (contract.includes('pub mod token_vesting')) {
  console.log('Contract type detected: token_vesting');
} else if (contract.includes('pub mod crowdfunding')) {
  console.log('Contract type detected: crowdfunding');
} else {
  console.log('Contract type: custom');
} 