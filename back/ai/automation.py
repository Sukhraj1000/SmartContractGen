import os
import shutil
import subprocess
import json
import time
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import from local modules
from ai.contract_generator import generate_smart_contract

class ContractAutomation:
    """Class to automate the smart contract generation, building, and deployment process.
    
    This class provides methods to:
    1. Generate smart contracts based on type and schema
    2. Validate generated contracts
    3. Build contracts using Anchor
    4. Deploy contracts to specified networks
    """
    
    def __init__(self):
        # Define paths
        self.root_dir = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.back_dir = self.root_dir / "back"
        self.deploy_dir = self.root_dir / "deploy"
        self.templates_dir = self.back_dir / "templates"
        self.deploy_templates_dir = self.deploy_dir / "templates"
        self.deploy_programs_dir = self.deploy_dir / "programs" / "deploy" / "src"
        
        # Ensure directories exist
        os.makedirs(self.deploy_programs_dir, exist_ok=True)
        os.makedirs(self.deploy_templates_dir, exist_ok=True)
        
    def sync_templates(self):
        """Sync templates from back/templates to deploy/templates."""
        print("Syncing templates...")
        if not os.path.exists(self.templates_dir):
            print(f"Error: Templates directory not found at {self.templates_dir}")
            return False
            
        # Create deploy/templates if it doesn't exist
        os.makedirs(self.deploy_templates_dir, exist_ok=True)
        
        # Copy all template files
        for template_file in os.listdir(self.templates_dir):
            if template_file.endswith(".rs"):
                src = self.templates_dir / template_file
                dst = self.deploy_templates_dir / template_file
                shutil.copy2(src, dst)
                print(f"Copied {template_file} to deploy/templates")
                
        return True
    
    def update_cargo_toml(self):
        """Ensure the Cargo.toml files have the correct configuration."""
        print("Updating Cargo.toml files...")
        
        # Update workspace Cargo.toml
        workspace_cargo = self.deploy_dir / "Cargo.toml"
        if os.path.exists(workspace_cargo):
            with open(workspace_cargo, 'r') as f:
                content = f.read()
                
            # Check if we need to fix the resolver
            if "[workspace.resolver]" in content:
                content = content.replace(
                    "[workspace.resolver]\nversion = \"2\"", 
                    ""
                )
                
                # Make sure resolver is in the workspace section
                if "resolver = \"2\"" not in content:
                    content = content.replace(
                        "[workspace]\nmembers = [", 
                        "[workspace]\nmembers = [\n    \"programs/*\"\n]\nresolver = \"2\"\n\n[profile.release"
                    )
                    
                with open(workspace_cargo, 'w') as f:
                    f.write(content)
                print("Fixed workspace Cargo.toml resolver configuration")
        
        return True
    
    def generate_contract(self, contract_type, schema):
        """Generate a smart contract based on the type and schema.
        
        Args:
            contract_type (str): Type of contract to generate
            schema (dict): Contract schema defining structure and parameters
            
        Returns:
            bool: True if contract generation was successful, False otherwise
        """
        print(f"Generating {contract_type} contract...")
        
        # Make sure we have a valid deploy directory structure
        os.makedirs(self.deploy_programs_dir, exist_ok=True)
        
        # Output path
        output_path = self.deploy_programs_dir / "lib.rs"
        
        # Generate the contract
        contract_code = generate_smart_contract(
            contract_type=contract_type,
            schema=schema,
            output_path=str(output_path)
        )
        
        if not contract_code:
            print("Error: Failed to generate contract")
            return False
            
        print(f"Contract successfully generated and saved to {output_path}")
        return True
    
    def validate_contract(self):
        """Run validation on the generated contract.
        
        Returns:
            bool: True if validation was successful, False otherwise
        """
        print("Validating contract...")
        
        try:
            # Change to deploy directory
            os.chdir(self.deploy_dir)
            
            # Run the validation script
            result = subprocess.run(
                ["node", "scripts/validate_contract.js"], 
                capture_output=True, 
                text=True
            )
            
            print(result.stdout)
            
            if result.returncode != 0:
                print(f"Validation failed: {result.stderr}")
                return False
                
            return True
            
        except Exception as e:
            print(f"Error during validation: {str(e)}")
            return False
        finally:
            # Change back to root dir
            os.chdir(self.root_dir)
    
    def build_contract(self):
        """Build the smart contract using Anchor."""
        print("Building contract...")
        
        try:
            # Change to deploy directory
            os.chdir(self.deploy_dir)
            
            # Build the contract
            result = subprocess.run(
                ["cargo", "build-sbf"], 
                capture_output=True, 
                text=True
            )
            
            if result.returncode != 0:
                print(f"Build failed: {result.stderr}")
                print(result.stdout)  # Sometimes useful errors are in stdout
                return False
                
            print("Contract built successfully")
            return True
            
        except Exception as e:
            print(f"Error during build: {str(e)}")
            return False
        finally:
            # Change back to root dir
            os.chdir(self.root_dir)
    
    def deploy_contract(self):
        """Deploy the contract to Solana devnet."""
        print("Deploying contract...")
        
        try:
            # Change to deploy directory
            os.chdir(self.deploy_dir)
            
            # Make the deployment script executable
            os.chmod("scripts/deploy.sh", 0o755)
            
            # Run the deployment script
            process = subprocess.Popen(
                ["./scripts/deploy.sh"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Monitor the output
            for line in iter(process.stdout.readline, ''):
                print(line, end='')
                
                # When prompted for confirmation, automatically respond with 'y'
                if "Continue?" in line or "Would you like to airdrop" in line:
                    process.stdin.write("y\n")
                    process.stdin.flush()
            
            # Get the exit code
            exit_code = process.wait()
            
            if exit_code != 0:
                print(f"Deployment failed with exit code {exit_code}")
                return False
                
            print("Contract deployed successfully")
            return True
            
        except Exception as e:
            print(f"Error during deployment: {str(e)}")
            return False
        finally:
            # Change back to root dir
            os.chdir(self.root_dir)
    
    def run_automation(self, contract_type, schema):
        """Run the complete automation process."""
        print(f"Starting automation for {contract_type} contract...")
        
        # 1. Sync templates
        if not self.sync_templates():
            print("Template synchronization failed. Continuing anyway...")
        
        # 2. Update Cargo.toml files
        if not self.update_cargo_toml():
            print("Cargo.toml update failed. Continuing anyway...")
        
        # 3. Generate contract
        if not self.generate_contract(contract_type, schema):
            print("Contract generation failed")
            return False
        
        # 4. Validate contract
        if not self.validate_contract():
            print("Contract validation failed")
            return False
        
        # 5. Build contract
        if not self.build_contract():
            print("Contract build failed")
            return False
        
        # 6. Ask if user wants to deploy
        deploy_choice = input("Do you want to deploy the contract to Devnet? (y/n): ")
        if deploy_choice.lower() == 'y':
            if not self.deploy_contract():
                print("Contract deployment failed")
                return False
        
        print("Automation completed successfully")
        return True

# Command line interface
if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description="Automate smart contract generation, building, and deployment")
    parser.add_argument("contract_type", help="Type of contract to generate (escrow, token_vesting, crowdfunding)")
    parser.add_argument("--schema", help="JSON schema file path (optional)")
    parser.add_argument("--deploy", action="store_true", help="Deploy automatically after generation")
    
    args = parser.parse_args()
    
    # Get schema
    schema = {}
    if args.schema:
        with open(args.schema, 'r') as f:
            schema = json.load(f)
    
    # Run automation
    automation = ContractAutomation()
    result = automation.run_automation(args.contract_type, schema)
    
    if result:
        print("Process completed successfully")
        sys.exit(0)
    else:
        print("Process failed")
        sys.exit(1) 