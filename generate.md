Here's an updated version using the newer `oracledb` library (the replacement for `cx_Oracle`) with context management protocol for both PostgreSQL and Oracle databases:

```python
"""
Python database connection classes with context management protocol for:
1. PostgreSQL (using psycopg2)
2. Oracle (using oracledb - the new official Oracle Python driver)

Features:
- Proper connection handling with context managers
- Connection pooling for Oracle
- Parameter validation
- Type hints
- Error handling
- Query execution methods
"""

import psycopg2
import oracledb
from typing import Optional, Dict, Any, List, Union

class PostgresDBConnection:
    """Context manager for PostgreSQL database connections using psycopg2."""
    
    def __init__(self, 
                 dbname: str, 
                 user: str, 
                 password: str, 
                 host: str = 'localhost', 
                 port: int = 5432,
                 **kwargs: Any):
        """
        Initialize PostgreSQL connection parameters.
        
        Args:
            dbname: Database name
            user: Username
            password: Password
            host: Host address (default: 'localhost')
            port: Port number (default: 5432)
            kwargs: Additional connection parameters for psycopg2.connect()
        """
        self.connection_params = {
            'dbname': dbname,
            'user': user,
            'password': password,
            'host': host,
            'port': port,
            **kwargs
        }
        self.conn: Optional[psycopg2.extensions.connection] = None
        self.cursor: Optional[psycopg2.extensions.cursor] = None
    
    def __enter__(self) -> 'PostgresDBConnection':
        """Establish connection and return cursor when entering context."""
        try:
            self.conn = psycopg2.connect(**self.connection_params)
            self.cursor = self.conn.cursor()
            return self
        except psycopg2.Error as e:
            raise ConnectionError(f"Failed to connect to PostgreSQL: {e}")
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Clean up connection when exiting context."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
            self.conn.close()
    
    def execute_query(self, 
                     query: str, 
                     params: Optional[Union[tuple, Dict[str, Any]]] = None,
                     fetch: bool = True) -> Optional[List[tuple]]:
        """
        Execute a SQL query.
        
        Args:
            query: SQL query string
            params: Optional parameters for parameterized queries
            fetch: Whether to fetch results (for SELECT queries)
            
        Returns:
            List of tuples representing query results if fetch=True, else None
        """
        if not self.cursor:
            raise RuntimeError("Database cursor not available")
        
        try:
            self.cursor.execute(query, params)
            if fetch and self.cursor.description:  # If it's a SELECT query
                return self.cursor.fetchall()
            return None
        except psycopg2.Error as e:
            raise RuntimeError(f"Query execution failed: {e}")

class OracleDBConnection:
    """Context manager for Oracle database connections using oracledb."""
    
    def __init__(self,
                 user: str,
                 password: str,
                 dsn: str,
                 *,
                 thick_mode: bool = False,
                 pool_min: int = 1,
                 pool_max: int = 2,
                 pool_increment: int = 1,
                 **kwargs: Any):
        """
        Initialize Oracle connection parameters.
        
        Args:
            user: Database username
            password: Database password
            dsn: Data Source Name (connection string)
            thick_mode: Whether to use thick mode (requires Oracle Client)
            pool_min: Minimum number of connections in pool
            pool_max: Maximum number of connections in pool
            pool_increment: Connection increment for pool
            kwargs: Additional connection parameters for oracledb.connect()
        """
        if thick_mode:
            oracledb.init_oracle_client()
            
        self.pool = oracledb.create_pool(
            user=user,
            password=password,
            dsn=dsn,
            min=pool_min,
            max=pool_max,
            increment=pool_increment,
            **kwargs
        )
        self.conn: Optional[oracledb.Connection] = None
        self.cursor: Optional[oracledb.Cursor] = None
    
    def __enter__(self) -> 'OracleDBConnection':
        """Establish connection from pool and return cursor when entering context."""
        try:
            self.conn = self.pool.acquire()
            self.cursor = self.conn.cursor()
            return self
        except oracledb.Error as e:
            raise ConnectionError(f"Failed to connect to Oracle: {e}")
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Release connection back to pool when exiting context."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
            self.pool.release(self.conn)
    
    def execute_query(self,
                     query: str,
                     params: Optional[Union[tuple, Dict[str, Any]]] = None,
                     fetch: bool = True) -> Optional[List[tuple]]:
        """
        Execute a SQL query.
        
        Args:
            query: SQL query string
            params: Optional parameters for parameterized queries
            fetch: Whether to fetch results (for SELECT queries)
            
        Returns:
            List of tuples representing query results if fetch=True, else None
        """
        if not self.cursor:
            raise RuntimeError("Database cursor not available")
        
        try:
            self.cursor.execute(query, params or {})
            if fetch and self.cursor.description:  # If it's a SELECT query
                return self.cursor.fetchall()
            return None
        except oracledb.Error as e:
            raise RuntimeError(f"Query execution failed: {e}")
    
    def close_pool(self) -> None:
        """Close the connection pool."""
        self.pool.close()

# Example usage
if __name__ == "__main__":
    # PostgreSQL example
    print("PostgreSQL Example:")
    try:
        with PostgresDBConnection(
            dbname="your_db",
            user="your_user",
            password="your_password",
            host="localhost"
        ) as pg_db:
            # Create table
            pg_db.execute_query("""
                CREATE TABLE IF NOT EXISTS test_table (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100),
                    value INTEGER
                )
            """, fetch=False)
            
            # Insert data
            pg_db.execute_query(
                "INSERT INTO test_table (name, value) VALUES (%s, %s)",
                ("Sample", 42),
                fetch=False
            )
            
            # Query data
            results = pg_db.execute_query("SELECT * FROM test_table")
            for row in results:
                print(row)
    except Exception as e:
        print(f"PostgreSQL error: {e}")
    
    # Oracle example
    print("\nOracle Example:")
    try:
        # Initialize connection pool (would normally do this once at app startup)
        oracle_pool = OracleDBConnection(
            user="your_user",
            password="your_password",
            dsn="localhost:1521/ORCLPDB1",
            thick_mode=False  # Set to True if you need thick mode features
        )
        
        with oracle_pool as ora_db:
            # Create table
            ora_db.execute_query("""
                BEGIN
                    EXECUTE IMMEDIATE 'CREATE TABLE test_table (
                        id NUMBER GENERATED ALWAYS AS IDENTITY,
                        name VARCHAR2(100),
                        value NUMBER,
                        PRIMARY KEY (id)
                    )';
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLCODE = -955 THEN NULL; -- table already exists
                        ELSE RAISE;
                        END IF;
                END;
            """, fetch=False)
            
            # Insert data
            ora_db.execute_query(
                "INSERT INTO test_table (name, value) VALUES (:1, :2)",
                ("Oracle Sample", 99),
                fetch=False
            )
            
            # Query data
            results = ora_db.execute_query("SELECT * FROM test_table")
            for row in results:
                print(row)
        
        # Close pool when done (typically at application shutdown)
        oracle_pool.close_pool()
    except Exception as e:
        print(f"Oracle error: {e}")
```

### Key Improvements in this Version:

1. **OracleDB using oracledb**:
   - Uses the modern `oracledb` driver (successor to cx_Oracle)
   - Supports both thin and thick modes
   - Implements connection pooling for better performance

2. **Enhanced Features**:
   - Connection pooling for Oracle
   - Better parameter handling for both databases
   - Optional fetch parameter for execute_query
   - Support for both tuple and dict parameter styles
   - Proper resource cleanup

3. **Usage Improvements**:
   - More complete example with table creation and data manipulation
   - Better error handling
   - Type hints throughout
   - Configurable connection parameters

4. **Production-ready**:
   - The Oracle implementation is particularly suited for production use with pooling
   - Proper transaction management
   - Resource cleanup in all cases

To use this code, install the required packages:
```bash
pip install psycopg2-binary oracledb
```

Note: For Oracle thick mode, you may need to download the Oracle Instant Client separately if you need those features.
