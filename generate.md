# Comprehensive Database Utility with PostgreSQL and Oracle Support

Here's a complete database utility that implements context managers for both PostgreSQL and Oracle with all CRUD operations and more:

```python
import psycopg2
import oracledb
from typing import Optional, Dict, Any, List, Union, Tuple, Generator
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DBConfig:
    """Configuration for database connections"""
    db_type: str  # 'postgres' or 'oracle'
    user: str
    password: str
    host: str = 'localhost'
    port: Optional[int] = None
    dbname: Optional[str] = None  # For PostgreSQL
    service_name: Optional[str] = None  # For Oracle
    sid: Optional[str] = None  # For Oracle (alternative to service_name)
    thick_mode: bool = False  # For Oracle
    pool_min: int = 1  # Connection pool minimum
    pool_max: int = 5  # Connection pool maximum
    pool_increment: int = 1  # Connection pool increment

class DatabaseConnection:
    """
    Comprehensive database utility with support for PostgreSQL and Oracle.
    Implements all common database operations with context management.
    """
    
    def __init__(self, config: DBConfig):
        self.config = config
        self.conn = None
        self.cursor = None
        self.pool = None
        
        if config.db_type == 'oracle':
            self._init_oracle()
    
    def _init_oracle(self):
        """Initialize Oracle-specific settings"""
        if self.config.thick_mode:
            try:
                oracledb.init_oracle_client()
            except Exception as e:
                logger.warning(f"Oracle thick mode initialization failed: {e}")
        
        # Build DSN string for Oracle
        if self.config.service_name:
            dsn = f"{self.config.host}:{self.config.port}/{self.config.service_name}"
        elif self.config.sid:
            dsn = f"{self.config.host}:{self.config.port}:{self.config.sid}"
        else:
            dsn = self.config.host
            
        self.pool = oracledb.create_pool(
            user=self.config.user,
            password=self.config.password,
            dsn=dsn,
            min=self.config.pool_min,
            max=self.config.pool_max,
            increment=self.config.pool_increment
        )
    
    def __enter__(self):
        """Establish database connection"""
        try:
            if self.config.db_type == 'postgres':
                self.conn = psycopg2.connect(
                    dbname=self.config.dbname,
                    user=self.config.user,
                    password=self.config.password,
                    host=self.config.host,
                    port=self.config.port
                )
            elif self.config.db_type == 'oracle':
                self.conn = self.pool.acquire()
            
            self.cursor = self.conn.cursor()
            return self
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise ConnectionError(f"Could not connect to database: {e}")
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up database connection"""
        try:
            if self.cursor:
                self.cursor.close()
            
            if self.conn:
                if exc_type is None:
                    self.conn.commit()
                else:
                    self.conn.rollback()
                
                if self.config.db_type == 'oracle':
                    self.pool.release(self.conn)
                else:
                    self.conn.close()
        except Exception as e:
            logger.error(f"Error during connection cleanup: {e}")
            raise
    
    def execute(self, query: str, params: Optional[Union[tuple, dict]] = None) -> None:
        """Execute a SQL command without returning results"""
        try:
            self.cursor.execute(query, params or ())
        except Exception as e:
            logger.error(f"Query execution failed: {e}\nQuery: {query}")
            raise
    
    def fetch_all(self, query: str, params: Optional[Union[tuple, dict]] = None) -> List[Tuple]:
        """Execute query and return all results"""
        try:
            self.cursor.execute(query, params or ())
            return self.cursor.fetchall()
        except Exception as e:
            logger.error(f"Fetch failed: {e}\nQuery: {query}")
            raise
    
    def fetch_one(self, query: str, params: Optional[Union[tuple, dict]] = None) -> Optional[Tuple]:
        """Execute query and return first result"""
        try:
            self.cursor.execute(query, params or ())
            return self.cursor.fetchone()
        except Exception as e:
            logger.error(f"Fetch failed: {e}\nQuery: {query}")
            raise
    
    def fetch_iter(self, query: str, params: Optional[Union[tuple, dict]] = None, 
                  batch_size: int = 1000) -> Generator[Tuple, None, None]:
        """Execute query and return results as a generator (for large result sets)"""
        try:
            self.cursor.execute(query, params or ())
            while True:
                rows = self.cursor.fetchmany(batch_size)
                if not rows:
                    break
                for row in rows:
                    yield row
        except Exception as e:
            logger.error(f"Fetch iteration failed: {e}\nQuery: {query}")
            raise
    
    def insert(self, table: str, data: dict, returning: Optional[str] = None) -> Optional[Tuple]:
        """
        Insert a single record into a table
        
        Args:
            table: Table name
            data: Dictionary of column: value pairs
            returning: Optional column name to return after insert
            
        Returns:
            The returned value if 'returning' specified, else None
        """
        columns = ', '.join(data.keys())
        placeholders = ', '.join([f"%({k})s" for k in data.keys()])
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"
        
        if returning:
            query += f" RETURNING {returning}"
            return self.fetch_one(query, data)
        
        self.execute(query, data)
        return None
    
    def bulk_insert(self, table: str, columns: List[str], data: List[tuple]) -> None:
        """
        Insert multiple records efficiently
        
        Args:
            table: Table name
            columns: List of column names
            data: List of tuples with values
        """
        col_str = ', '.join(columns)
        placeholders = ', '.join(['%s'] * len(columns))
        query = f"INSERT INTO {table} ({col_str}) VALUES ({placeholders})"
        
        try:
            if self.config.db_type == 'postgres':
                self.cursor.executemany(query, data)
            elif self.config.db_type == 'oracle':
                # Oracle handles executemany differently for optimal performance
                self.cursor.executemany(query, data, batcherrors=True)
                
                # Log any errors that occurred during batch insert
                for error in self.cursor.getbatcherrors():
                    logger.error(f"Error inserting row {error.offset}: {error.message}")
        except Exception as e:
            logger.error(f"Bulk insert failed: {e}")
            raise
    
    def update(self, table: str, data: dict, condition: str, 
               condition_params: Optional[Union[tuple, dict]] = None) -> int:
        """
        Update records in a table
        
        Args:
            table: Table name
            data: Dictionary of column: value pairs to update
            condition: WHERE clause condition
            condition_params: Parameters for the WHERE clause
            
        Returns:
            Number of rows affected
        """
        set_clause = ', '.join([f"{k} = %({k})s" for k in data.keys()])
        query = f"UPDATE {table} SET {set_clause} WHERE {condition}"
        
        # Merge the data and condition parameters
        params = data.copy()
        if isinstance(condition_params, dict):
            params.update(condition_params)
        elif condition_params:
            # For tuple params, we need to use positional placeholders
            set_clause = ', '.join([f"{k} = %s" for k in data.keys()])
            query = f"UPDATE {table} SET {set_clause} WHERE {condition}"
            params = tuple(data.values()) + condition_params
        
        self.execute(query, params)
        return self.cursor.rowcount
    
    def delete(self, table: str, condition: str, 
               params: Optional[Union[tuple, dict]] = None) -> int:
        """
        Delete records from a table
        
        Args:
            table: Table name
            condition: WHERE clause condition
            params: Parameters for the WHERE clause
            
        Returns:
            Number of rows affected
        """
        query = f"DELETE FROM {table} WHERE {condition}"
        self.execute(query, params)
        return self.cursor.rowcount
    
    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists in the database"""
        try:
            if self.config.db_type == 'postgres':
                query = """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = %s
                    )
                """
                return self.fetch_one(query, (table_name,))[0]
            elif self.config.db_type == 'oracle':
                query = """
                    SELECT COUNT(*) FROM user_tables 
                    WHERE table_name = UPPER(:table_name)
                """
                return self.fetch_one(query, {'table_name': table_name})[0] > 0
        except Exception as e:
            logger.error(f"Table existence check failed: {e}")
            return False
    
    def get_table_columns(self, table_name: str) -> List[str]:
        """Get list of columns for a table"""
        try:
            if self.config.db_type == 'postgres':
                query = """
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = %s 
                    ORDER BY ordinal_position
                """
                return [row[0] for row in self.fetch_all(query, (table_name,))]
            elif self.config.db_type == 'oracle':
                query = """
                    SELECT column_name 
                    FROM user_tab_columns 
                    WHERE table_name = UPPER(:table_name) 
                    ORDER BY column_id
                """
                return [row[0] for row in self.fetch_all(query, {'table_name': table_name})]
        except Exception as e:
            logger.error(f"Column retrieval failed: {e}")
            return []
    
    def call_procedure(self, proc_name: str, params: Optional[Union[tuple, dict]] = None):
        """
        Call a stored procedure
        
        Args:
            proc_name: Procedure name
            params: Parameters for the procedure
        """
        try:
            if self.config.db_type == 'postgres':
                query = f"CALL {proc_name}(%s)" if isinstance(params, tuple) else f"CALL {proc_name}(%(param)s)"
            elif self.config.db_type == 'oracle':
                query = f"BEGIN {proc_name}(:param); END;"
            
            self.execute(query, params)
        except Exception as e:
            logger.error(f"Procedure call failed: {e}")
            raise
    
    def close_pool(self):
        """Close the connection pool (for Oracle)"""
        if self.config.db_type == 'oracle' and self.pool:
            self.pool.close()

# Example usage
if __name__ == "__main__":
    # Example configuration
    postgres_config = DBConfig(
        db_type='postgres',
        user='your_user',
        password='your_password',
        host='localhost',
        port=5432,
        dbname='your_db'
    )
    
    oracle_config = DBConfig(
        db_type='oracle',
        user='your_user',
        password='your_password',
        host='localhost',
        port=1521,
        service_name='ORCLPDB1',
        thick_mode=False
    )
    
    # PostgreSQL operations example
    try:
        with DatabaseConnection(postgres_config) as db:
            # Create table if not exists
            if not db.table_exists('employees'):
                db.execute("""
                    CREATE TABLE employees (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(100) UNIQUE,
                        salary DECIMAL(10,2),
                        department VARCHAR(50),
                        hire_date DATE DEFAULT CURRENT_DATE
                    )
                """)
                logger.info("Created employees table")
            
            # Insert single record
            emp_id = db.insert(
                table='employees',
                data={
                    'name': 'John Doe',
                    'email': 'john@example.com',
                    'salary': 75000.00,
                    'department': 'Engineering'
                },
                returning='id'
            )
            logger.info(f"Inserted employee with ID: {emp_id[0]}")
            
            # Bulk insert
            employees = [
                ('Jane Smith', 'jane@example.com', 80000.00, 'Marketing'),
                ('Bob Johnson', 'bob@example.com', 65000.00, 'HR'),
                ('Alice Brown', 'alice@example.com', 90000.00, 'Engineering')
            ]
            db.bulk_insert(
                table='employees',
                columns=['name', 'email', 'salary', 'department'],
                data=employees
            )
            logger.info("Bulk inserted employees")
            
            # Update records
            rows_updated = db.update(
                table='employees',
                data={'salary': 85000.00},
                condition='department = %s',
                condition_params=('Engineering',)
            )
            logger.info(f"Updated {rows_updated} employees in Engineering")
            
            # Query data
            engineering_team = db.fetch_all(
                "SELECT name, email, salary FROM employees WHERE department = %s ORDER BY salary DESC",
                ('Engineering',)
            )
            logger.info("Engineering team:")
            for emp in engineering_team:
                logger.info(f"{emp[0]} - {emp[1]} - ${emp[2]:,.2f}")
            
            # Delete record
            rows_deleted = db.delete(
                table='employees',
                condition='email = %s',
                params=('bob@example.com',)
            )
            logger.info(f"Deleted {rows_deleted} employee(s)")
            
    except Exception as e:
        logger.error(f"PostgreSQL operation failed: {e}")
    
    # Oracle operations example
    try:
        with DatabaseConnection(oracle_config) as db:
            # Create table if not exists
            if not db.table_exists('EMPLOYEES'):
                db.execute("""
                    BEGIN
                        EXECUTE IMMEDIATE 'CREATE TABLE employees (
                            id NUMBER GENERATED ALWAYS AS IDENTITY,
                            name VARCHAR2(100) NOT NULL,
                            email VARCHAR2(100),
                            salary NUMBER(10,2),
                            department VARCHAR2(50),
                            hire_date DATE DEFAULT SYSDATE,
                            CONSTRAINT emp_pk PRIMARY KEY (id),
                            CONSTRAINT emp_email_uk UNIQUE (email)
                        )';
                    EXCEPTION
                        WHEN OTHERS THEN
                            IF SQLCODE = -955 THEN NULL; -- table already exists
                            ELSE RAISE;
                            END IF;
                    END;
                """)
                logger.info("Created employees table")
            
            # Insert single record
            emp_id = db.insert(
                table='employees',
                data={
                    'name': 'John Doe',
                    'email': 'john@example.com',
                    'salary': 75000.00,
                    'department': 'Engineering'
                },
                returning='id'
            )
            logger.info(f"Inserted employee with ID: {emp_id[0]}")
            
            # Bulk insert
            employees = [
                ('Jane Smith', 'jane@example.com', 80000.00, 'Marketing'),
                ('Bob Johnson', 'bob@example.com', 65000.00, 'HR'),
                ('Alice Brown', 'alice@example.com', 90000.00, 'Engineering')
            ]
            db.bulk_insert(
                table='employees',
                columns=['name', 'email', 'salary', 'department'],
                data=employees
            )
            logger.info("Bulk inserted employees")
            
            # Call a stored procedure (example)
            try:
                db.call_procedure('my_package.give_raise', {'param': 'Engineering'})
                logger.info("Called give_raise procedure for Engineering department")
            except Exception as e:
                logger.warning(f"Procedure call failed (might not exist): {e}")
            
    except Exception as e:
        logger.error(f"Oracle operation failed: {e}")
```

## Key Features of This Utility:

1. **Unified Interface** for both PostgreSQL and Oracle databases
2. **Complete CRUD Operations**:
   - `insert()` - Single record insertion with optional returning clause
   - `bulk_insert()` - Efficient multi-row insertion
   - `update()` - Record modification with conditions
   - `delete()` - Record deletion with conditions
   - `fetch_all()`, `fetch_one()`, `fetch_iter()` - Various query methods

3. **Advanced Features**:
   - Connection pooling for Oracle
   - Table existence checking
   - Column listing
   - Stored procedure execution
   - Batch operations with error handling

4. **Production-Ready**:
   - Comprehensive error handling
   - Detailed logging
   - Proper resource cleanup
   - Type hints throughout
   - Configurable connection parameters

5. **Performance Optimizations**:
   - Generator-based fetching for large result sets
   - Efficient bulk operations
   - Oracle-specific optimizations

6. **Context Management**:
   - Automatic connection handling
   - Transaction management (commit/rollback)
   - Pool management for Oracle

To use this utility:
1. Install required packages: `pip install psycopg2-binary oracledb`
2. Configure your database connection with the `DBConfig` dataclass
3. Use the context manager (`with` statement) for all operations

This implementation provides a solid foundation that can be extended with additional database-specific features as needed.
