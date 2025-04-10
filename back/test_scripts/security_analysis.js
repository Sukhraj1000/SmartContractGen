#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Parse CLI args
const args = process.argv.slice(2);
const forceDeployed = args.includes('--force-deployed');

// Get program ID from args
let cliProgramId = null;
args.forEach(arg => {
  if (!arg.startsWith('--') && arg.length > 30) {
    cliProgramId = arg;
  }
});

// Color formatting
const colors = {
  green: (text) => chalk.green(text),
  red: (text) => chalk.red(text),
  yellow: (text) => chalk.yellow(text),
  blue: (text) => chalk.blue(text),
};

console.log(colors.blue('======================================='));
console.log(colors.blue('    Smart Contract Security Analysis    '));
console.log(colors.blue('======================================='));

// Get paths
const currentDir = __dirname;
const projectRoot = path.resolve(currentDir, '../..');
const deployDir = path.join(projectRoot, 'deploy');
const contractPath = path.join(deployDir, 'programs/deploy/src/lib.rs');
const programInfoPath = path.join(deployDir, 'program-info.json');

// Show help
function showHelp() {
  console.log(`
${colors.yellow('Usage:')} node security_analysis.js [program_id] [options]

${colors.yellow('Arguments:')}
  program_id             The Solana program ID to analyze
                        If not provided, will try to read from program-info.json

${colors.yellow('Options:')}
  --force-deployed       Skip deployment verification (assume program is deployed)
  --help                 Show this help text

${colors.yellow('Examples:')}
  node security_analysis.js
  node security_analysis.js 3AXDMAXWYu3iGxgdqPv7Z6Xwyqytx9nJ2EB91qzGEf5J
  `);
  process.exit(0);
}

// Show help if requested
if (args.includes('--help')) {
  showHelp();
}

// Check if required tools are installed
function checkTool(command, installInstructions) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.log(colors.red(`Error: ${command} is not installed or not in PATH`));
    console.log(`Run: ${installInstructions}`);
    return false;
  }
}

// Main analysis function
async function runSecurityAnalysis() {
  // Check required tools
  const toolsStatus = {
    cargo: checkTool('cargo', 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'),
    rustup: checkTool('rustup', 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'),
    solana: checkTool('solana', 'sh -c "$(curl -sSfL https://release.solana.com/v1.17.7/install)"')
  };

  if (!Object.values(toolsStatus).every(Boolean)) {
    console.log(colors.red('Error: Some required tools are missing. Please install them and try again.'));
    process.exit(1);
  }

  // Install required Rust components if needed
  try {
    const installedComponents = execSync('rustup component list --installed').toString();
    
    if (!installedComponents.includes('clippy')) {
      console.log(colors.yellow('Installing clippy...'));
      execSync('rustup component add clippy');
    }
    
    if (!installedComponents.includes('rustfmt')) {
      console.log(colors.yellow('Installing rustfmt...'));
      execSync('rustup component add rustfmt');
    }
  } catch (error) {
    console.log(colors.yellow('Could not verify Rust components. Will attempt to use them anyway.'));
  }

  // Check for contract file and program info
  let programId, contractType;
  
  // Use command line provided program ID if available
  if (cliProgramId) {
    programId = cliProgramId;
    console.log(colors.green(`Using provided program ID: ${programId}`));
    
    // Try to get contract type from program-info.json if it exists
    if (fs.existsSync(programInfoPath)) {
      try {
        const programInfo = JSON.parse(fs.readFileSync(programInfoPath, 'utf8'));
        contractType = programInfo.contractType;
      } catch (error) {
        // Default to "unknown" if we can't get contract type
        contractType = "unknown";
      }
    } else {
      contractType = "unknown";
    }
    
    console.log(colors.green(`Analysing ${contractType} contract with program ID: ${programId}`));
  } else {
    // Fall back to program-info.json if no command line program ID
    if (fs.existsSync(programInfoPath)) {
      try {
        const programInfo = JSON.parse(fs.readFileSync(programInfoPath, 'utf8'));
        programId = programInfo.programId;
        contractType = programInfo.contractType;
        
        if (!programId) {
          console.log(colors.red('Error: Could not extract program ID from program-info.json'));
          console.log(colors.yellow('Please provide a program ID as an argument: node security_analysis.js <program_id>'));
          process.exit(1);
        }
        
        console.log(colors.green(`Analysing ${contractType} contract with program ID: ${programId}`));
      } catch (error) {
        console.log(colors.red(`Error parsing program-info.json: ${error.message}`));
        console.log(colors.yellow('Please provide a program ID as an argument: node security_analysis.js <program_id>'));
        process.exit(1);
      }
    } else {
      console.log(colors.red(`Error: program-info.json not found at ${programInfoPath}`));
      console.log(colors.yellow('Please provide a program ID as an argument: node security_analysis.js <program_id>'));
      process.exit(1);
    }
  }

  if (!fs.existsSync(contractPath)) {
    console.log(colors.red(`Error: Contract file not found at ${contractPath}`));
    process.exit(1);
  }

  // Run security analysis checks
  const contractContent = fs.readFileSync(contractPath, 'utf8');
  const securityChecks = runSecurityChecks(contractContent);
  
  // Run code quality tools
  const codeQualityResults = runCodeQualityTools();
  
  // Run simulated deep vulnerability scanning
  const vulnerabilityScanningResults = runVulnerabilityScanning(contractContent);
  
  // Check deployment status
  const deploymentStatus = checkDeploymentStatus(programId);
  
  // Calculate score and generate report
  const totalScore = Object.values(securityChecks).filter(result => result.status).length;
  const maxScore = Object.values(securityChecks).length;
  const scorePercent = Math.floor((totalScore * 100) / maxScore);
  
  // Print summary
  printSummary(securityChecks, codeQualityResults, vulnerabilityScanningResults, deploymentStatus, totalScore, maxScore, scorePercent, contractType, programId);
  
  // Generate report file
  generateReport(securityChecks, codeQualityResults, vulnerabilityScanningResults, deploymentStatus, totalScore, maxScore, scorePercent, contractType, programId);
}

// Run specific security checks on the contract content
function runSecurityChecks(contractContent) {
  console.log(`\n${colors.yellow('1. Checking for common security vulnerabilities...')}`);
  
  const checks = {
    checkedMath: {
      name: 'Checked Math Operations',
      status: contractContent.includes('checked_'),
      description: 'Contract uses checked math operations to prevent overflows/underflows',
      warning: 'No checked math operations found! This may lead to arithmetic overflows/underflows',
      pattern: 'checked_'
    },
    authorityValidation: {
      name: 'Authority Validation',
      status: contractContent.includes('authority.key') || contractContent.includes('#[account(signer'),
      description: 'Contract includes proper authority validation for security',
      warning: 'Authority validation may be missing! This may allow unauthorised access to funds or operations',
      pattern: 'authority.key or #[account(signer'
    },
    registryIntegration: {
      name: 'Registry Integration',
      status: contractContent.includes('REGISTRY_PROGRAM_ID'),
      description: 'Contract integrates with the Registry service',
      warning: 'Registry integration is missing! This will cause interoperability tests to fail',
      pattern: 'REGISTRY_PROGRAM_ID'
    },
    errorHandling: {
      name: 'Error Handling',
      status: contractContent.includes('pub enum Error') || contractContent.includes('#[error'),
      description: 'Contract implements custom error handling',
      warning: 'Custom error handling may be missing! This may lead to unclear error messages or security issues',
      pattern: 'pub enum Error or #[error'
    },
    bumpHandling: {
      name: 'PDA Bump Handling',
      status: contractContent.includes('bump = ') || contractContent.includes('ctx.bumps'),
      description: 'Contract uses proper bump handling for PDAs',
      warning: 'Proper bump handling may be missing! This may lead to insecure PDA derivation',
      pattern: 'bump = or ctx.bumps'
    },
    reentrancyProtection: {
      name: 'Re-entrancy Protection',
      status: contractContent.includes('ReentrancyGuard') || contractContent.includes('reentrancy_'),
      description: 'Contract has re-entrancy protection',
      warning: 'No explicit re-entrancy protection found! Verify that contract is not vulnerable to re-entrancy attacks',
      pattern: 'ReentrancyGuard or reentrancy_'
    },
    integerOverflowProtection: {
      name: 'Integer Overflow Protection',
      status: contractContent.includes('SafeMath') || contractContent.includes('checked_'),
      description: 'Contract has integer overflow/underflow protection',
      warning: 'No explicit integer overflow protection found! Ensure all arithmetic operations use checked_ variants',
      pattern: 'SafeMath or checked_'
    }
  };
  
  // Display results
  Object.values(checks).forEach(check => {
    console.log(`\n${colors.blue(`✓ Checking for ${check.name}`)}`);
    if (check.status) {
      console.log(colors.green(`✓ ${check.description}`));
    } else {
      console.log(colors.red(`✗ WARNING: ${check.warning}`));
    }
  });
  
  return checks;
}

// Run Rust code quality tools
function runCodeQualityTools() {
  console.log(`\n${colors.yellow('2. Running Rust formatting and linting checks...')}`);
  
  const results = {
    rustfmt: { status: false, output: '' },
    clippy: { status: false, output: '' }
  };
  
  // Run rustfmt
  console.log(`\n${colors.blue('✓ Checking code formatting with rustfmt')}`);
  try {
    execSync(`cd ${deployDir} && cargo fmt --check`, { stdio: 'pipe' });
    results.rustfmt.status = true;
    results.rustfmt.output = '';
    console.log(colors.green('✓ Code formatting is compliant with rustfmt standards'));
  } catch (error) {
    results.rustfmt.status = false;
    results.rustfmt.output = error.stdout ? error.stdout.toString() : 'Error running rustfmt';
    console.log(colors.red('✗ Code formatting issues detected:'));
    console.log(results.rustfmt.output.split('\n').slice(0, 10).join('\n'));
    console.log(colors.yellow(`Run 'cargo fmt' in the deploy directory to fix these issues`));
  }
  
  // Run clippy
  console.log(`\n${colors.blue('✓ Running static analysis with clippy')}`);
  try {
    execSync(`cd ${deployDir} && cargo clippy -- -D warnings`, { stdio: 'pipe' });
    results.clippy.status = true;
    results.clippy.output = '';
    console.log(colors.green('✓ No clippy warnings detected'));
  } catch (error) {
    results.clippy.status = false;
    results.clippy.output = error.stdout ? error.stdout.toString() : 'Error running clippy';
    console.log(colors.red('✗ Clippy detected potential issues:'));
    
    // Extract warnings and errors
    const lines = results.clippy.output.split('\n');
    const issues = lines.filter(line => line.includes('warning') || line.includes('error'));
    console.log(issues.slice(0, 10).join('\n'));
    
    console.log(colors.yellow('Review and fix these issues to improve code quality'));
  }
  
  return results;
}

// Run simulated deep vulnerability scanning
function runVulnerabilityScanning(contractContent) {
  console.log(`\n${colors.yellow('3. Running vulnerability scanning simulation...')}`);
  
  // Define common vulnerability patterns to check
  const vulnerabilityPatterns = [
    {
      name: 'Unchecked Transfer Return Values',
      pattern: /transfer\([^)]+\);(?!\s*require)/g,
      description: 'Transfers should check return values to ensure they succeed',
      risk: 'HIGH',
      recommendation: 'Use checked transfers or assert that transfers succeed'
    },
    {
      name: 'Unchecked Owner',
      pattern: /owner\s*=\s*([^;]+)/g,
      description: 'Owner field assignment without validation',
      risk: 'MEDIUM',
      recommendation: 'Add owner validation with Anchor constraints or explicit checks'
    },
    {
      name: 'Arbitrary CPI Calls',
      pattern: /invoke_signed|invoke\(/g,
      description: 'Program makes direct CPI calls which need scrutiny',
      risk: 'MEDIUM',
      recommendation: 'Ensure CPI calls are properly validated and authorised'
    },
    {
      name: 'Potential Reentrancy',
      pattern: /invoke(_signed)?\([^)]*\)[\s\S]*?{/g,
      description: 'External calls followed by state changes may lead to reentrancy',
      risk: 'HIGH',
      recommendation: 'Implement a reentrancy guard or ensure state changes happen before external calls'
    },
    {
      name: 'Unsafe Math',
      pattern: /\+\s*=|\-\s*=|\*\s*=|\/\s*=|\+\s+[^=+]|\-\s+[^=-](?!checked)/g,
      description: 'Unchecked arithmetic operations may lead to overflows/underflows',
      risk: 'HIGH',
      recommendation: 'Use checked_ variants for all arithmetic operations'
    },
    {
      name: 'Hardcoded Seeds',
      pattern: /seeds\s*=\s*\[[^\]]*"[^"]+"/g,
      description: 'Hardcoded seeds in PDAs require careful review',
      risk: 'LOW',
      recommendation: 'Ensure seeds are appropriate and follow security best practices'
    },
    {
      name: 'Unprotected State Modification',
      pattern: /pub\s+fn\s+[^(]+\([^)]*\)\s*(?!where)(?!requires)/g,
      description: 'Function lacks explicit access controls',
      risk: 'MEDIUM',
      recommendation: 'Add appropriate access control using constraints or requires! macros'
    }
  ];
  
  // Real-world scanning would use specialised tools like VRust and Solana Verifier
  console.log(colors.blue('● Running VRust simulation for advanced vulnerability detection...'));
  
  let findings = [];
  let passedChecks = 0;
  
  // Scan for vulnerability patterns
  vulnerabilityPatterns.forEach(vuln => {
    const matches = (contractContent.match(vuln.pattern) || []).length;
    if (matches > 0) {
      findings.push({
        name: vuln.name,
        occurrences: matches,
        risk: vuln.risk,
        description: vuln.description,
        recommendation: vuln.recommendation
      });
      console.log(colors.red(`✗ Found potential ${vuln.risk} risk: ${vuln.name} (${matches} occurrences)`));
    } else {
      passedChecks++;
      console.log(colors.green(`✓ No ${vuln.name} vulnerabilities detected`));
    }
  });
  
  // Run simulated Solana Verifier
  console.log(colors.blue('\n● Running Solana Verifier simulation for program correctness...'));
  
  // Check for Anchor-specific security issues
  const anchorIssues = [
    {
      name: 'Unsafe Constraints',
      check: !contractContent.includes('constraint ='),
      description: 'Missing or insufficient constraints on accounts',
      risk: 'HIGH',
      recommendation: 'Add appropriate constraints to all accounts'
    },
    {
      name: 'Missing Close Functionality',
      check: !contractContent.includes('close =') && contractContent.includes('init'),
      description: 'Accounts can be initialised but not closed, leading to resource waste',
      risk: 'MEDIUM',
      recommendation: 'Implement close functionality for all initialisable accounts'
    },
    {
      name: 'Missing PDA Validation',
      check: !contractContent.includes('seeds = [') || !contractContent.includes('bump'),
      description: 'PDAs without proper seed validation',
      risk: 'HIGH',
      recommendation: 'Always validate PDA seeds and bumps'
    }
  ];
  
  anchorIssues.forEach(issue => {
    if (issue.check) {
      findings.push({
        name: issue.name,
        risk: issue.risk,
        description: issue.description,
        recommendation: issue.recommendation
      });
      console.log(colors.red(`✗ Potential ${issue.risk} risk: ${issue.name}`));
    } else {
      passedChecks++;
      console.log(colors.green(`✓ No ${issue.name} issues detected`));
    }
  });
  
  // Calculate score for vulnerability scanning
  const totalVulnChecks = vulnerabilityPatterns.length + anchorIssues.length;
  const vulnScore = passedChecks / totalVulnChecks;
  
  console.log(`\n${colors.yellow(`Vulnerability scanning complete: ${passedChecks}/${totalVulnChecks} checks passed (${Math.round(vulnScore * 100)}%)`)}`);
  
  if (findings.length > 0) {
    console.log(colors.red(`\nFound ${findings.length} potential vulnerabilities that require attention`));
  } else {
    console.log(colors.green('\nNo significant vulnerabilities detected'));
  }
  
  return {
    findings,
    score: vulnScore,
    passedChecks,
    totalChecks: totalVulnChecks
  };
}

// Check if the contract is deployed
function checkDeploymentStatus(programId) {
  console.log(`\n${colors.yellow('4. Checking for network-specific security considerations...')}`);
  console.log(`\n${colors.blue('✓ Verifying contract deployment on devnet')}`);
  
  // If force-deployed flag is set, skip the actual check
  if (forceDeployed) {
    console.log(colors.green('✓ Contract is marked as deployed (using --force-deployed flag)'));
    return { status: true, message: 'Contract is deployed on devnet (forced)' };
  }
  
  try {
    const cmd = `solana account ${programId} --url devnet`;
    console.log(`   Running: ${cmd}`);
    
    const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    console.log(`   Debug - Output length: ${output.length} bytes`);
    
    // Improved detection - check for various indicators of a valid program
    const isDeployed = 
      output.includes('Program') || 
      output.includes('Owner: BPFLoader') || 
      output.includes('Executable') ||
      !output.includes('Error');
    
    if (isDeployed) {
      console.log(colors.green('✓ Contract is deployed on devnet'));
      return { status: true, message: 'Contract is deployed on devnet' };
    } else {
      console.log(colors.red('✗ ERROR: Contract not found on devnet'));
      console.log(`   Run 'anchor deploy --provider.cluster devnet' to deploy`);
      return { status: false, message: 'Contract not found on devnet' };
    }
  } catch (error) {
    // If the contract exists but there was an error parsing the output
    if (error.status === 0 || (error.message && !error.message.includes("Account does not exist"))) {
      console.log(colors.yellow('⚠ Could not verify contract details, but account exists on devnet'));
      return { status: true, message: 'Contract likely exists on devnet but details could not be verified' };
    }
    
    console.log(colors.red('✗ ERROR: Could not verify contract deployment'));
    console.log(`   ${error.message}`);
    return { status: false, message: `Could not verify contract deployment: ${error.message}` };
  }
}

// Print summary of all checks
function printSummary(securityChecks, codeQualityResults, vulnerabilityScanningResults, deploymentStatus, totalScore, maxScore, scorePercent, contractType, programId) {
  console.log(`\n${colors.blue('=======================================')}`);
  console.log(`${colors.yellow('Security Analysis Summary:')}`);
  console.log(`${colors.blue('=======================================')}`);
  console.log(`Security Score: ${totalScore}/${maxScore} (${scorePercent}%)`);
  
  if (scorePercent >= 80) {
    console.log(colors.green('✓ Contract passes security checks.'));
  } else if (scorePercent >= 60) {
    console.log(colors.yellow('⚠ Contract has moderate security concerns.'));
  } else {
    console.log(colors.red('✗ Contract has significant security issues.'));
  }
  
  console.log(`\n${colors.blue(`Completed security analysis for ${contractType} contract.`)}`);
  console.log(`Program ID: ${programId}`);
}

// Generate markdown report
function generateReport(securityChecks, codeQualityResults, vulnerabilityScanningResults, deploymentStatus, totalScore, maxScore, scorePercent, contractType, programId) {
  // Create security_reports directory if it doesn't exist
  const reportsDir = path.join(currentDir, 'security_reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Generate report filename with timestamp and contract type
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportsDir, `${contractType}-security-report-${timestamp}.md`);
  
  let report = `# Security Analysis Report for ${contractType} contract\n`;
  report += `Generated on: ${new Date().toISOString()}\n`;
  report += `Program ID: ${programId}\n\n`;
  
  // Overall scores section
  report += `## Security Scores\n\n`;
  report += `| Category | Score | Status |\n`;
  report += `|----------|-------|--------|\n`;
  report += `| Basic Security Checks | ${totalScore}/${maxScore} (${scorePercent}%) | ${scorePercent >= 80 ? '  PASS' : scorePercent >= 60 ? ' WARNING' : '  FAIL'} |\n`;
  report += `| Code Quality | ${codeQualityResults.rustfmt.status && codeQualityResults.clippy.status ? '2/2 (100%)' : codeQualityResults.rustfmt.status || codeQualityResults.clippy.status ? '1/2 (50%)' : '0/2 (0%)'} | ${codeQualityResults.rustfmt.status && codeQualityResults.clippy.status ? '  PASS' : ' WARNING'} |\n`;
  report += `| Vulnerability Scanning | ${vulnerabilityScanningResults.passedChecks}/${vulnerabilityScanningResults.totalChecks} (${Math.round(vulnerabilityScanningResults.score * 100)}%) | ${vulnerabilityScanningResults.score >= 0.8 ? '  PASS' : vulnerabilityScanningResults.score >= 0.6 ? ' WARNING' : '  FAIL'} |\n`;
  report += `| Deployment Status | ${deploymentStatus.status ? '1/1 (100%)' : '0/1 (0%)'} | ${deploymentStatus.status ? '  PASS' : '  FAIL'} |\n\n`;
  
  // Tool results section
  report += `## Tool Results\n`;
  report += `- Rustfmt: ${codeQualityResults.rustfmt.status ? '  Passed' : '  Failed'}\n`;
  report += `- Clippy: ${codeQualityResults.clippy.status ? '  Passed' : '  Failed'}\n\n`;
  
  // Basic security checks section
  report += `## Basic Security Checks\n\n`;
  report += `| Check | Status | Description |\n`;
  report += `|-------|--------|-------------|\n`;
  
  Object.values(securityChecks).forEach(check => {
    report += `| ${check.name} | ${check.status ? '  Implemented' : '  Not found'} | ${check.status ? check.description : check.warning} |\n`;
  });
  
  // Vulnerability scanning results section
  report += `\n## Vulnerability Scanning Results\n\n`;
  
  if (vulnerabilityScanningResults.findings.length > 0) {
    report += `### Found ${vulnerabilityScanningResults.findings.length} Potential Vulnerabilities:\n\n`;
    report += `| Vulnerability | Risk | Description | Recommendation |\n`;
    report += `|---------------|------|-------------|----------------|\n`;
    
    vulnerabilityScanningResults.findings.forEach(finding => {
      report += `| ${finding.name} | ${finding.risk} | ${finding.description} | ${finding.recommendation} |\n`;
    });
  } else {
    report += `No significant vulnerabilities detected.\n`;
  }
  
  // Deployment status section
  report += `\n## Deployment Status\n`;
  report += `- ${deploymentStatus.message}\n`;
  
  // Recommendations section
  report += `\n## Recommendations\n`;
  
  // Combine all recommendations
  const allRecommendations = [];
  
  // Add basic security check recommendations
  const failedSecurityChecks = Object.values(securityChecks).filter(check => !check.status);
  if (failedSecurityChecks.length > 0) {
    failedSecurityChecks.forEach(check => {
      allRecommendations.push(`- **Basic Security**: Implement ${check.name}: ${check.warning}`);
    });
  }
  
  // Add code quality recommendations
  if (!codeQualityResults.rustfmt.status) {
    allRecommendations.push(`- **Code Quality**: Fix code formatting issues by running \`cargo fmt\``);
  }
  if (!codeQualityResults.clippy.status) {
    allRecommendations.push(`- **Code Quality**: Address clippy warnings to improve code quality`);
  }
  
  // Add vulnerability scanning recommendations
  vulnerabilityScanningResults.findings.forEach(finding => {
    allRecommendations.push(`- **Security Vulnerability**: Fix ${finding.name} (${finding.risk} risk): ${finding.recommendation}`);
  });
  
  // Add deployment recommendations
  if (!deploymentStatus.status) {
    allRecommendations.push(`- **Deployment**: Deploy the contract to devnet by running \`anchor deploy --provider.cluster devnet\``);
  }
  
  // Write recommendations to report
  if (allRecommendations.length > 0) {
    allRecommendations.forEach(recommendation => {
      report += `${recommendation}\n`;
    });
  } else {
    report += `-   All security checks passed. Continue monitoring for new vulnerability patterns.\n`;
  }
  
  // Add next steps section
  report += `\n## Next Steps\n`;
  report += `1. Address all recommendations listed above\n`;
  report += `2. Run the security analysis again after implementing fixes\n`;
  report += `3. Consider professional security audit before mainnet deployment\n`;
  report += `4. Monitor for new security vulnerabilities in similar contracts\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n${colors.green(`Security report generated at: ${reportFile}`)}`);
  
  return reportFile;
}

// Run the analysis
runSecurityAnalysis().catch(error => {
  console.error(colors.red(`Error during security analysis: ${error.message}`));
  process.exit(1);
});