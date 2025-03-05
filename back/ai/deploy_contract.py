import os
import subprocess
import shutil
import json
import time

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Corrected paths
CONFIG_FILE = os.path.join(BASE_DIR, "back/test-config.json")  
DEPLOY_DIR = os.path.join(BASE_DIR, "test-deploy/target/deploy")  
ANCHOR_PROJECT_DIR = os.path.join(BASE_DIR, "test-deploy")  

# Ensure paths are absolute
CONFIG_FILE = os.path.abspath(CONFIG_FILE)
DEPLOY_DIR = os.path.abspath(DEPLOY_DIR)
ANCHOR_PROJECT_DIR = os.path.abspath(ANCHOR_PROJECT_DIR)

def start_solana_validator():
    """Starts the Solana test validator if it's not running."""
    try:
        result = subprocess.run(["solana", "cluster-version"], capture_output=True, text=True)
        if result.returncode != 0:
            print("Solana validator not running. Starting solana-test-validator...")
            subprocess.Popen(["solana-test-validator"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(5)  # Give it time to start
    except Exception as e:
        print(f"Error checking Solana validator: {e}")

def clean_deploy_folder():
    """Deletes all files in the deploy folder before deployment."""
    if os.path.exists(DEPLOY_DIR):
        print(f"Cleaning up old deployment files in: {DEPLOY_DIR}")
        for file in os.listdir(DEPLOY_DIR):
            file_path = os.path.join(DEPLOY_DIR, file)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}: {e}")

def get_program_keypair():
    """Finds the correct keypair file for the deployed program automatically and updates test-config.json."""
    try:
        if not os.path.exists(DEPLOY_DIR):
            print("Error: Deploy directory does not exist.")
            return None

        keypair_files = [f for f in os.listdir(DEPLOY_DIR) if f.endswith("-keypair.json")]
        if not keypair_files:
            print("Error: No keypair files found in target/deploy.")
            return None

        keypair_files.sort(key=lambda f: os.path.getmtime(os.path.join(DEPLOY_DIR, f)), reverse=True)
        keypair_path = os.path.join(DEPLOY_DIR, keypair_files[0])

        print(f"Using program keypair file: {keypair_path}")

        result = subprocess.run(["solana", "address", "-k", keypair_path], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error fetching program ID: {result.stderr}")
            return None

        program_id = result.stdout.strip()
        print(f"Retrieved Program ID: {program_id}")

        # Ensure test-config.json exists
        if not os.path.exists(CONFIG_FILE):
            print(f"Error: {CONFIG_FILE} does not exist! Creating new file.")
            with open(CONFIG_FILE, "w") as file:
                json.dump({"programId": program_id}, file, indent=2)

        # Update test-config.json with new program ID
        with open(CONFIG_FILE, "r") as file:
            config_data = json.load(file)

        config_data["programId"] = program_id  # Update the programId

        with open(CONFIG_FILE, "w") as file:
            json.dump(config_data, file, indent=2)

        print(f"Updated {CONFIG_FILE} with new Program ID: {program_id}")

        return program_id

    except Exception as e:
        print(f"Error retrieving program keypair: {str(e)}")
        return None

def deploy_contract():
    """Ensures Solana is running, cleans deploy folder, runs `anchor build`, and updates program ID."""
    try:
        # Step 1: Ensure Solana validator is running
        start_solana_validator()

        # Step 2: Ensure Solana CLI is set to localhost
        subprocess.run(["solana", "config", "set", "--url", "localhost"], check=True)

        # Step 3: Clean old deploy files
        clean_deploy_folder()

        # Step 4: Run `anchor build` inside test-deploy/
        print("Building and deploying contract inside test-deploy...")
        build_result = subprocess.run(["anchor", "build"], cwd=ANCHOR_PROJECT_DIR, check=True)
        if build_result.returncode != 0:
            print("Anchor build failed!")
            return None

        deploy_result = subprocess.run(["anchor", "deploy"], cwd=ANCHOR_PROJECT_DIR, check=True)
        if deploy_result.returncode != 0:
            print("Anchor deploy failed!")
            return None

        # Step 5: Retrieve and Save New Program ID
        return get_program_keypair()

    except subprocess.CalledProcessError as e:
        print("Deployment error:", e)
        return None

if __name__ == "__main__":
    program_id = deploy_contract()
    if program_id:
        print(f"Success! Program ID: {program_id}")
    else:
        print("Failed to retrieve program ID.")
