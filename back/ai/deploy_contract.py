import os
import json
import subprocess

CONFIG_FILE = "test-config.json"
DEPLOY_DIR = "target/deploy"

def get_program_keypair():
    """Finds the correct keypair file for the deployed program automatically."""
    try:
        deploy_dir = os.path.join(os.getcwd(), "target/deploy")
        keypair_files = [f for f in os.listdir(deploy_dir) if f.endswith("-keypair.json")]

        if not keypair_files:
            print("No keypair files found in target/deploy.")
            return None

        keypair_files.sort(key=lambda f: os.path.getmtime(os.path.join(deploy_dir, f)), reverse=True)
        keypair_path = os.path.join(deploy_dir, keypair_files[0])

        print(f"Using program keypair file: {keypair_path}")

        result = subprocess.run(
            ["solana", "address", "-k", keypair_path],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print("Error fetching program ID:", result.stderr)
            return None

        return result.stdout.strip()

    except Exception as e:
        print("Error retrieving program keypair:", str(e))
        return None


def deploy_contract():
    """Deploys the contract and retrieves the real program ID."""
    try:
        print("Building and deploying contract...")
        subprocess.run(["anchor", "build"], check=True)
        subprocess.run(["anchor", "deploy"], check=True)

        program_id = get_program_keypair()

        if program_id:
            print(f"Retrieved Program ID: {program_id}")
            return program_id
        else:
            print("Failed to retrieve Program ID.")
            return None

    except subprocess.CalledProcessError as e:
        print("Deployment error:", e)
        return None
