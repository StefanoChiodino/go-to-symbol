"""
Test file to demonstrate enhanced Python symbol search functionality
"""
from enum import Enum
from typing import List, Dict

# 1. Enum definition - should match "AccTran" query
class AccountTransaction(Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER = "transfer"

# 2. Class definition - should match "AccTran" query  
class AccountTransactionProcessor:
    def __init__(self):
        self.transactions = []
    
    def process_transaction(self, transaction):
        pass

# 3. Type annotation - should match "AccTran" query
AccountTransactionList: List[AccountTransaction] = []

# 4. Variable assignment - should match "AccTran" query
AccountTransactionMap = {
    "pending": [],
    "completed": []
}

# Additional test cases
def process_account_transaction(transaction: AccountTransaction) -> bool:
    """Function that uses AccountTransaction type"""
    return True

class BankAccount:
    def __init__(self):
        self.account_transactions: List[AccountTransaction] = []
    
    def add_transaction(self, transaction: AccountTransaction):
        self.account_transactions.append(transaction)