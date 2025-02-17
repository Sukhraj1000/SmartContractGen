import os
import spacy
import json
import re
import openai
from collections import defaultdict
from pdfminer.high_level import extract_text
from docx import Document
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.environ.get('OPEN_API_KEY'))

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

# Load spaCy NLP model
nlp = spacy.load("en_core_web_sm")

def extract_contract_details(text):
    doc = nlp(text)
    contract_data = defaultdict(str)
    
    # Detect contract type (Escrow, Vesting, Crowdfunding, etc.)
    if "escrow" in text.lower():
        contract_data["contract_type"] = "escrow"
    elif "vesting" in text.lower():
        contract_data["contract_type"] = "vesting"
    elif "crowdfunding" in text.lower() or "fundraising" in text.lower():
        contract_data["contract_type"] = "crowdfunding"
    else:
        contract_data["contract_type"] = "custom"
    
    # Extract Depositor, Beneficiary, and Escrow Agent
    parties = re.findall(r'([A-Za-z0-9 &.,]+), a corporation.*?hereinafter referred to as the "(Depositor|Beneficiary|Escrow Agent)"', text)
    for entity, role in parties:
        contract_data[role.lower()] = entity.strip()
    
    # Extract payment details (amount and currency)
    payment_match = re.search(r'([A-Z]{3})\s([0-9,]+)', text)
    if payment_match:
        contract_data["payment"] = {
            "amount": payment_match.group(2).replace(",", ""),
            "currency": payment_match.group(1)
        }
    
    # Extract release conditions
    conditions = re.findall(r'(upon|when|if|after)\s+([^\n]+)', text, re.IGNORECASE)
    contract_data["release_conditions"] = [condition[1].strip() for condition in conditions]
    
    # Extract expiry details (if mentioned)
    expiry_match = re.search(r'(expires?|expiry|deadline)\s+(on|in|after)\s+([^.,]+)', text, re.IGNORECASE)
    if expiry_match:
        contract_data["expiry"] = expiry_match.group(3)
    
    return contract_data

def refine_contract_details(nlp_extracted_data, full_text):
    """Use AI to refine and validate extracted contract details."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an AI assistant trained to analyze and extract key legal details from contracts. "
                "Ensure accuracy in identifying the Depositor, Beneficiary, and Escrow Agent, "
                "along with key obligations, fund release conditions, and deadlines. "
                "Provide a structured JSON output while correcting errors and missing details."
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "contract_text": full_text,
                "extracted_data": nlp_extracted_data
            }, indent=4)
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        
        # Ensure response contains valid content
        ai_output = response.choices[0].message.content.strip()
        if not ai_output:
            raise ValueError("AI response is empty.")
        
        # Debugging: Print raw AI response before parsing
        print("AI Response:", ai_output)
        
        return json.loads(ai_output)
    except json.JSONDecodeError as e:
        print("Error decoding AI response:", e)
        return {"error": "Invalid JSON from AI"}
    except Exception as e:
        print("OpenAI API error:", e)
        return {"error": str(e)}

# Example usage
def process_contract(file_path):
    text = extract_text_from_file(file_path)
    nlp_extracted_data = extract_contract_details(text)
    refined_data = refine_contract_details(nlp_extracted_data, text)
    return json.dumps(refined_data, indent=4)

# Example
if __name__ == "__main__":
    file_path = "ESCROW AGREEMENT.docx"  # Change to your file
    extracted_data = process_contract(file_path)
    print(extracted_data)
