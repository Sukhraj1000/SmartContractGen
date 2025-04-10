import os
import re
import json
from anthropic import Anthropic
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

# Initialise AI Client
client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

def get_ai_client():
    """Get AI client instance."""
    return client
