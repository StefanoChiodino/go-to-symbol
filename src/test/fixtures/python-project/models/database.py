"""
Database models and connection management
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum


class ConnectionStatus(Enum):
    """Database connection status"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


@dataclass
class DatabaseConfig:
    """Database configuration"""
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl_enabled: bool = False


class DatabaseConnection(ABC):
    """Abstract database connection"""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.status = ConnectionStatus.DISCONNECTED
    
    @abstractmethod
    def connect(self) -> bool:
        """Connect to database"""
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Disconnect from database"""
        pass
    
    @abstractmethod
    def execute_query(self, query: str, params: Optional[Dict] = None) -> List[Dict]:
        """Execute database query"""
        pass


class PostgreSQLConnection(DatabaseConnection):
    """PostgreSQL database connection implementation"""
    
    def __init__(self, config: DatabaseConfig):
        super().__init__(config)
        self._connection = None
    
    def connect(self) -> bool:
        """Connect to PostgreSQL database"""
        try:
            # Simulate connection logic
            print(f"Connecting to PostgreSQL at {self.config.host}:{self.config.port}")
            self.status = ConnectionStatus.CONNECTED
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            self.status = ConnectionStatus.ERROR
            return False
    
    def disconnect(self) -> None:
        """Disconnect from PostgreSQL"""
        if self._connection:
            self._connection = None
            self.status = ConnectionStatus.DISCONNECTED
    
    def execute_query(self, query: str, params: Optional[Dict] = None) -> List[Dict]:
        """Execute PostgreSQL query"""
        if self.status != ConnectionStatus.CONNECTED:
            raise RuntimeError("Not connected to database")
        
        # Simulate query execution
        return [{"result": "mock_data"}]


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self):
        self._connections: Dict[str, DatabaseConnection] = {}
        self._active_connection: Optional[str] = None
    
    def add_connection(self, name: str, connection: DatabaseConnection) -> None:
        """Add a database connection"""
        self._connections[name] = connection
    
    def set_active_connection(self, name: str) -> bool:
        """Set active database connection"""
        if name in self._connections:
            self._active_connection = name
            return True
        return False
    
    def get_active_connection(self) -> Optional[DatabaseConnection]:
        """Get the active database connection"""
        if self._active_connection:
            return self._connections.get(self._active_connection)
        return None
    
    def execute_on_active(self, query: str, params: Optional[Dict] = None) -> List[Dict]:
        """Execute query on active connection"""
        connection = self.get_active_connection()
        if not connection:
            raise RuntimeError("No active database connection")
        return connection.execute_query(query, params)


# Global database manager instance
db_manager = DatabaseManager()

# Default connection settings
DEFAULT_DB_CONFIG = DatabaseConfig(
    host="localhost",
    port=5432,
    database="testdb",
    username="testuser",
    password="testpass"
)