Here's a comprehensive logging utility using `loguru` that handles daily log file rotation and automatic cleanup of old logs (older than 60 days):

```python
# logging_utils.py
import os
import time
from pathlib import Path
from datetime import datetime, timedelta
from loguru import logger
import schedule
import threading
from typing import Optional

class LoggingUtils:
    """
    Comprehensive logging utility with:
    - Console logging
    - Daily rotating file logs
    - Automatic cleanup of old logs (60 days)
    - Colored output
    - Structured logging
    """
    
    def __init__(self, log_dir: str = "logs", retention_days: int = 60):
        """
        Initialize logging utility
        
        Args:
            log_dir: Directory to store log files
            retention_days: Number of days to keep log files
        """
        self.log_dir = Path(log_dir)
        self.retention_days = retention_days
        self._configure_logger()
        self._start_cleanup_scheduler()
    
    def _configure_logger(self) -> None:
        """Configure loguru logger with console and file sinks"""
        # Create log directory if it doesn't exist
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Remove default logger
        logger.remove()
        
        # Console logging configuration
        logger.add(
            sink=self._console_formatter,
            level="DEBUG",
            colorize=True,
            backtrace=True,
            diagnose=True,
            format=self._console_format
        )
        
        # File logging configuration (daily rotation)
        logger.add(
            sink=self._get_log_file_path(),
            level="DEBUG",
            rotation="00:00",  # Rotate at midnight
            retention=f"{self.retention_days} days",
            compression="zip",
            enqueue=True,  # Thread-safe
            backtrace=True,
            diagnose=True,
            format=self._file_format,
            filter=self._file_filter
        )
    
    def _console_format(self, record: dict) -> str:
        """Custom format for console logging"""
        level_colors = {
            "TRACE": "blue",
            "DEBUG": "cyan",
            "INFO": "green",
            "SUCCESS": "bold green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "bold red"
        }
        
        level = record["level"].name
        timestamp = datetime.fromtimestamp(record["time"].timestamp()).strftime("%Y-%m-%d %H:%M:%S")
        
        if level in level_colors:
            level = f"<{level_colors[level]}>{level}</{level_colors[level]}>"
        
        return (
            f"<light-black>{timestamp}</light-black> | "
            f"{level} | "
            f"<cyan>{record['name']}</cyan>:<cyan>{record['function']}</cyan>:<cyan>{record['line']}</cyan> - "
            f"<light-white>{record['message']}</light-white>"
        )
    
    def _console_formatter(self, message: str) -> None:
        """Custom console formatter that handles colored output"""
        print(message, flush=True)
    
    def _file_format(self, record: dict) -> str:
        """Structured format for file logging"""
        return (
            "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
            "{level} | "
            "{name}:{function}:{line} - "
            "{message}\n{exception}"
        )
    
    def _file_filter(self, record: dict) -> bool:
        """Filter for file logging (can customize what gets logged to file)"""
        return True
    
    def _get_log_file_path(self) -> str:
        """Generate log file path with current date"""
        date_str = datetime.now().strftime("%Y-%m-%d")
        return str(self.log_dir / f"app_{date_str}.log")
    
    def _cleanup_old_logs(self) -> None:
        """Clean up log files older than retention_days"""
        try:
            cutoff_time = time.time() - (self.retention_days * 86400)
            
            for log_file in self.log_dir.glob("app_*.log"):
                if log_file.is_file() and log_file.stat().st_mtime < cutoff_time:
                    try:
                        log_file.unlink()
                        logger.info(f"Removed old log file: {log_file.name}")
                    except Exception as e:
                        logger.error(f"Failed to remove {log_file.name}: {e}")
            
            # Also clean up compressed logs
            for zip_file in self.log_dir.glob("app_*.log.zip"):
                if zip_file.is_file() and zip_file.stat().st_mtime < cutoff_time:
                    try:
                        zip_file.unlink()
                        logger.info(f"Removed old compressed log: {zip_file.name}")
                    except Exception as e:
                        logger.error(f"Failed to remove {zip_file.name}: {e}")
        except Exception as e:
            logger.error(f"Log cleanup failed: {e}")
    
    def _start_cleanup_scheduler(self) -> None:
        """Start background scheduler for daily log cleanup"""
        def run_scheduler():
            schedule.every().day.at("00:15").do(self._cleanup_old_logs)
            while True:
                schedule.run_pending()
                time.sleep(60)
        
        # Start the scheduler in a daemon thread
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        logger.info("Started log cleanup scheduler")
    
    @staticmethod
    def get_logger(name: Optional[str] = None):
        """
        Get a configured logger instance
        
        Args:
            name: Name of the logger (usually __name__)
            
        Returns:
            Configured logger instance
        """
        return logger.bind(name=name)

# Example usage
if __name__ == "__main__":
    # Initialize logging
    logging_utils = LoggingUtils(log_dir="example_logs", retention_days=60)
    
    # Get logger for a module
    log = logging_utils.get_logger(__name__)
    
    # Example log messages
    log.debug("This is a debug message")
    log.info("This is an info message")
    log.warning("This is a warning message")
    log.error("This is an error message")
    
    try:
        1 / 0
    except Exception as e:
        log.exception("This is an exception with stack trace")
    
    log.success("This is a success message!")
```

## Key Features

1. **Daily Rotating Log Files**:
   - Creates new log file each day with date in filename (e.g., `app_2023-11-15.log`)
   - Automatically rotates at midnight

2. **Automatic Cleanup**:
   - Background thread runs daily cleanup at 00:15
   - Removes log files older than 60 days (configurable)
   - Also cleans up compressed log files (.zip)

3. **Enhanced Logging**:
   - Color-coded console output
   - Structured file logging
   - Thread-safe operation
   - Stack traces for exceptions
   - Compression of rotated logs

4. **Easy Integration**:
   - Simple `get_logger()` interface
   - Works like standard Python logging
   - Can be used across modules

5. **Customization**:
   - Adjustable retention period
   - Custom log directory
   - Separate filters/formatters for console vs file

## Usage Instructions

1. Install required packages:
   ```bash
   pip install loguru schedule
   ```

2. In your application:
   ```python
   from logging_utils import LoggingUtils
   
   # Initialize once (typically in your main.py or __init__.py)
   logging_utils = LoggingUtils(log_dir="my_app_logs", retention_days=30)
   
   # In each module
   log = logging_utils.get_logger(__name__)
   
   # Use like normal logger
   log.info("Application started")
   ```

3. The system will automatically:
   - Create dated log files
   - Rotate at midnight
   - Clean up old logs
   - Provide beautiful colored console output

## Customization Options

- Change log directory: `LoggingUtils(log_dir="custom_path")`
- Adjust retention period: `LoggingUtils(retention_days=90)`
- Modify log formats by editing `_console_format` and `_file_format` methods
- Change cleanup schedule by modifying `_start_cleanup_scheduler`

This implementation provides production-ready logging with all the features you requested while being easy to integrate into any Python application.
