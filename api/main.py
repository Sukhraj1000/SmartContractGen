import os
import json
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

client = OpenAI(api_key=os.environ.get('OPEN_API_KEY'))

# Define the root directory for Examples folder dynamically
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))  # Get the script's directory
EXAMPLES_DIR = os.path.join(ROOT_DIR, "Examples")  # Path to Examples folder

# Predefined contract templates for reference
CONTRACT_TEMPLATES = {
    os.path.join(EXAMPLES_DIR, "example1.rs"): "contract_generator.rs",
    os.path.join(EXAMPLES_DIR, "example2.rs"): "legal_agreement.rs",
    os.path.join(EXAMPLES_DIR, "example3.rs"): "tokenized_asset.rs",
    os.path.join(EXAMPLES_DIR, "example4.rs"): "subscription_contract.rs",
    os.path.join(EXAMPLES_DIR, "example5.rs"): "voting_contract.rs",
    os.path.join(EXAMPLES_DIR, "example6.rs"): "supply_chain_contract.rs",
    os.path.join(EXAMPLES_DIR, "example7.rs"): "crowdfunding_contract.rs",
}

# Function to generate Solana smart contract
def generate_solana_contract(legal_document, user_preferences):
    """
    Generates a Solana smart contract based on the provided legal document and user preferences.
    """

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert in writing Solana smart contracts in Rust using the Anchor framework. "
                "Your task is to generate a smart contract based on a provided legal document and user preferences. "
                "Ensure most of the code is commented to provide details of what is going on. "
                "Only the Code and the comments for the code should be present, no other explanations. "
                "If there are other explanations then comment with correct syntax. "
                "Use one of the following predefined templates as a foundation:\n"
                + "\n".join([f"{os.path.basename(key)}: {value}" for key, value in CONTRACT_TEMPLATES.items()])
                + "\nEnsure the generated contract is structured properly, and if any required inputs are missing, flag them clearly for UI input."
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "legal_document": legal_document,
                "user_preferences": user_preferences
            }, indent=4)
        }
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages
    )

    return response.choices[0].message.content


if __name__ == "__main__":
    # Simulate user input (In actual implementation, this would be taken from UI)
    legal_document = (
        "This document outlines a tokenized asset framework. "
        "The contract should include ownership validation and prevent unauthorized transfers."
    )
    
    user_preferences = {
        "contract_type": "tokenized_asset",  # User selects the relevant template
        "ownership_required": True,
        "transfer_restrictions": True,
        "burn_function": True,
        "additional_features": ["pausable", "role-based access control"]
    }

    # Generate the contract based on user input
    solana_contract = generate_solana_contract(legal_document, user_preferences)
    
    # Save the output to the Examples folder
    output_file = "generated_solana_contract.rs"
    with open(output_file, "w") as file:
        file.write(solana_contract)
    
    print(f"Solana smart contract generated and saved to {output_file}")
