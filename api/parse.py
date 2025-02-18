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
    
    # Detect contract type dynamically
    contract_types = ["escrow", "vesting", "crowdfunding", "loan", "partnership", "licensing", "nda", "employment"]
    for ctype in contract_types:
        if ctype in text.lower():
            contract_data["contract_type"] = ctype
            break
    else:
        contract_data["contract_type"] = "custom"
    
    # Extract parties
    parties = re.findall(r'([A-Za-z0-9 &.,]+), a corporation.*?hereinafter referred to as the "([A-Za-z ]+)"', text)
    for entity, role in parties:
        contract_data.setdefault("parties", {})[role.lower()] = entity.strip()
    
    # Extract payment details (amount and currency)
    payment_match = re.search(r'([A-Z]{3})\s([0-9,]+)', text)
    if payment_match:
        contract_data["payment"] = {
            "amount": payment_match.group(2).replace(",", ""),
            "currency": payment_match.group(1)
        }
    
    # Extract key obligations
    obligations = re.findall(r'([A-Za-z ]+) shall (.+?)(?:\.|\n)', text)
    for party, obligation in obligations:
        contract_data.setdefault("obligations", {})[party.lower()] = obligation.strip()
    
    # Extract conditions
    conditions = re.findall(r'(upon|when|if|after)\s+([^\n]+)', text, re.IGNORECASE)
    contract_data["conditions"] = [condition[1].strip() for condition in conditions]
    
    # Extract governing law and dispute resolution
    governing_law_match = re.search(r'governed by the laws of ([A-Za-z ]+)', text, re.IGNORECASE)
    if governing_law_match:
        contract_data["governing_law"] = governing_law_match.group(1).strip()
    
    dispute_resolution_match = re.search(r'dispute shall be resolved by ([A-Za-z ]+)', text, re.IGNORECASE)
    if dispute_resolution_match:
        contract_data["dispute_resolution"] = dispute_resolution_match.group(1).strip()
    
    return contract_data

def clean_ai_response(response_text):
    """Cleans AI response to remove surrounding markdown-style triple backticks."""
    response_text = response_text.strip()
    if response_text.startswith("```json") and response_text.endswith("```"):
        response_text = response_text[7:-3].strip()
    return response_text

def refine_contract_details(nlp_extracted_data, full_text):
    """Use AI to refine and validate extracted contract details and save output to a file."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are an AI assistant trained to analyze and extract key legal details from contracts. "
                "Ensure accuracy in identifying all parties, obligations, conditions, payment terms, governing law, and dispute resolution mechanisms. "
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
        
        ai_output = clean_ai_response(response.choices[0].message.content.strip())
        if not ai_output:
            raise ValueError("AI response is empty.")
        
        try:
            json_data = json.loads(ai_output)
            with open("extracted_contract.json", "w") as json_file:
                json.dump(json_data, json_file, indent=4)
            return json_data
        except json.JSONDecodeError:
            print("Invalid JSON format from AI response. Returning raw text.")
            return {"error": "Invalid JSON format", "raw_response": ai_output}
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
    process_contract(file_path)
    print("Extracted contract details saved to extracted_contract.json")
