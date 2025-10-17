"""
Main module for testing Python symbol search
"""
import os
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class AccountInvoice:
    """Account Invoice class for testing class search"""
    invoice_id: str
    amount: float
    customer_name: str
    
    def calculate_tax(self, tax_rate: float) -> float:
        """Calculate tax for the invoice"""
        return self.amount * tax_rate
    
    @property
    def formatted_amount(self) -> str:
        """Format amount as currency"""
        return f"${self.amount:.2f}"


class UserManager:
    """User management class"""
    
    def __init__(self):
        self.users: Dict[str, str] = {}
    
    def add_user(self, username: str, email: str) -> bool:
        """Add a new user"""
        if username not in self.users:
            self.users[username] = email
            return True
        return False
    
    def get_user_email(self, username: str) -> Optional[str]:
        """Get user email by username"""
        return self.users.get(username)


def process_account_data(account_info: Dict) -> AccountInvoice:
    """Process account data and create invoice"""
    return AccountInvoice(
        invoice_id=account_info['id'],
        amount=account_info['amount'],
        customer_name=account_info['customer']
    )


async def fetch_user_data(user_id: str) -> Dict:
    """Async function to fetch user data"""
    # Simulate API call
    return {
        'id': user_id,
        'name': 'Test User',
        'email': 'test@example.com'
    }


# Global variables for testing
MAX_RETRY_COUNT = 3
DEFAULT_TIMEOUT = 30
API_BASE_URL = "https://api.example.com"


if __name__ == "__main__":
    manager = UserManager()
    manager.add_user("testuser", "test@example.com")
    print(f"User email: {manager.get_user_email('testuser')}")