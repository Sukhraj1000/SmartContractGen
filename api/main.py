import os
import json
import openai
from docx import Document
from pdfminer.high_level import extract_text
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.environ.get('OPEN_API_KEY'))

def load_extracted_json():
    """Loads the full extracted contract JSON from file."""
    json_path = "extracted_contract.json"
    if not os.path.exists(json_path):
        raise FileNotFoundError("Extracted contract JSON file not found.")

    with open(json_path, "r") as file:
        return json.load(file)

def extract_text_from_file(file_path):
    """Extract text from PDF, DOCX, or TXT files."""
    if file_path.endswith(".pdf"):
        return extract_text(file_path)
    elif file_path.endswith(".docx"):
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
    elif file_path.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        raise ValueError("Unsupported file format. Only PDF, DOCX, and TXT are supported.")

def load_legal_document():
    """Loads the original legal document text from file."""
    doc_path = "ESCROW AGREEMENT.docx"
    if not os.path.exists(doc_path):
        raise FileNotFoundError("Legal document file not found.")
    
    return extract_text_from_file(doc_path)

def compare_contract_with_legal(contract_code, legal_text):
    """Compares the generated smart contract with the original legal document."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert in smart contract auditing and legal compliance. "
                "Your task is to compare the following original legal contract text with the generated Solana smart contract. "
                "Identify any missing clauses, incorrect obligations, or security vulnerabilities. "
                "Ensure that all legal requirements in the document are correctly implemented in the smart contract. "
                "Return a structured JSON output listing any discrepancies and necessary improvements."
            ),
        },
        {
            "role": "user",
            "content": (
                "Original Legal Document: \n" + legal_text + "\n\n"
                "Generated Smart Contract Code: \n" + contract_code + "\n\n"
                "Provide a structured report of any mismatches and suggested fixes."
            )
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        audit_report = response.choices[0].message.content.strip()
        with open("contract_audit_report.json", "w") as file:
            file.write(audit_report)
        
        return audit_report
    except Exception as e:
        print("OpenAI API error:", e)
        return f"Error during contract audit: {str(e)}"

def refine_solana_contract(contract_code, legal_text):
    """Refines the generated smart contract based on legal document comparison."""
    audit_report = compare_contract_with_legal(contract_code, legal_text)
    
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert in smart contract auditing and refinement. "
                "Your task is to improve the given smart contract based on the provided audit feedback from the original legal document. "
                "Ensure the contract fully implements all obligations, security best practices, and legal compliance as outlined in the legal document. "
                "Address issues found in the audit report, such as missing clauses, security vulnerabilities, or unoptimised logic. "
                "Return only the improved Solana smart contract code, with only comments but no other explanations in the file."
            ),
        },
        {
            "role": "user",
            "content": (
                "Original Smart Contract Code: \n" + contract_code + "\n\n"
                "Audit Report: \n" + audit_report + "\n\n"
                "Generate a revised, legally compliant, and fully optimized Solana smart contract, incorporating all necessary fixes."
            )
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        refined_contract_code = response.choices[0].message.content.strip()
        with open("final_contract.rs", "w") as file:
            file.write(refined_contract_code)
        
        return refined_contract_code
    except Exception as e:
        print("OpenAI API error:", e)
        return f"Error refining smart contract: {str(e)}"

def generate_solana_contract():
    """
    Generates and refines a Solana smart contract by embedding the extracted JSON into the AI query.
    """
    extracted_json = load_extracted_json()
    legal_text = load_legal_document()
    json_query = json.dumps(extracted_json, indent=4)
    
    # First AI Pass - Generate Initial Contract
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert in writing Solana smart contracts in Rust using the Anchor framework. "
                "Your task is to generate a high-quality, secure, and legally enforceable Solana smart contract based on the following contract details: \n"
                f"{json_query}\n"
                "Ensure that the smart contract meets all legal and security requirements."
            ),
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        contract_code = response.choices[0].message.content.strip()
        if not contract_code:
            raise ValueError("AI response is empty.")

        with open("generated_contract.rs", "w") as file:
            file.write(contract_code)
        
        # Perform two refinement iterations with legal document comparison
        for i in range(2):
            print(f"Refinement Loop {i+1}...")
            contract_code = refine_solana_contract(contract_code, legal_text)
        
        print("Refinement completed. Review 'final_contract.rs' for the final version.")
        return contract_code
    except Exception as e:
        print("OpenAI API error:", e)
        return f"Error generating smart contract: {str(e)}"

# Example usage
def main():
    try:
        smart_contract_code = generate_solana_contract()
        print("Smart contract generated, audited, and refined successfully!")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
