"""
Utility functions for the application
"""
from typing import Any, List, Callable
import json
import logging


class ConfigurationManager:
    """Manages application configuration"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self._config_data = {}
        self.load_config()
    
    def load_config(self) -> None:
        """Load configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                self._config_data = json.load(f)
        except FileNotFoundError:
            logging.warning(f"Config file not found: {self.config_path}")
            self._config_data = {}
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get configuration setting"""
        return self._config_data.get(key, default)


def validate_email_address(email: str) -> bool:
    """Validate email address format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format amount as currency string"""
    if currency == "USD":
        return f"${amount:.2f}"
    elif currency == "EUR":
        return f"€{amount:.2f}"
    else:
        return f"{amount:.2f} {currency}"


def retry_operation(func: Callable, max_retries: int = 3) -> Any:
    """Retry operation with exponential backoff"""
    import time
    
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(2 ** attempt)


# Constants
EMAIL_REGEX_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY"]
DEFAULT_RETRY_DELAY = 1.0