"""
Database Configuration & Session Management

Provides:
- Connection pooling for PostgreSQL
- Session factory for ORM operations
- Database initialization and migration utilities
"""

import os
from typing import Generator, Optional
from sqlalchemy import create_engine, event, Engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import logging

from .models import Base

logger = logging.getLogger(__name__)


class DatabaseConfig:
    """PostgreSQL connection configuration."""
    
    def __init__(self):
        # Read from environment or use defaults
        self.host = os.getenv("DB_HOST", "postgres")
        self.port = int(os.getenv("DB_PORT", 5432))
        self.user = os.getenv("DB_USER", "SpikeVerse_user")
        self.password = os.getenv("DB_PASSWORD", "SpikeVerse_password")
        self.database = os.getenv("DB_NAME", "SpikeVerse_db")
        
        # Connection pool settings
        self.pool_size = int(os.getenv("DB_POOL_SIZE", 5))
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", 10))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", 3600))
        self.pool_pre_ping = True  # Verify connections before using
    
    @property
    def connection_string(self) -> str:
        """Generate SQLAlchemy connection string."""
        return (
            f"postgresql+psycopg2://{self.user}:{self.password}@"
            f"{self.host}:{self.port}/{self.database}"
        )


class DatabaseManager:
    """Manages database connections, pooling, and session lifecycle."""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self.engine: Optional[Engine] = None
        self.SessionLocal: Optional[sessionmaker] = None
        self._initialized = False
        self._migrations_ran = False
    
    def initialize(self) -> Engine:
        """
        Initialize database engine with connection pooling.
        
        Returns:
            SQLAlchemy Engine instance
        """
        if self._initialized:
            return self.engine
        
        try:
            logger.info(f"Connecting to PostgreSQL: {self.config.host}:{self.config.port}/{self.config.database}")
            
            self.engine = create_engine(
                self.config.connection_string,
                poolclass=QueuePool,
                pool_size=self.config.pool_size,
                max_overflow=self.config.max_overflow,
                pool_recycle=self.config.pool_recycle,
                pool_pre_ping=self.config.pool_pre_ping,
                echo=False,  # Set to True for SQL debugging
                future=True,
            )
            
            # Test connection
            with self.engine.connect() as conn:
                logger.info("✓ Database connection successful")
            
            # Create session factory
            self.SessionLocal = sessionmaker(
                bind=self.engine,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
            )
            
            self._initialized = True
            return self.engine
        
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def create_all_tables(self) -> None:
        """Create all tables defined in Base.metadata."""
        if not self.engine:
            self.initialize()
        
        try:
            logger.info("Creating database tables...")
            Base.metadata.create_all(self.engine)
            logger.info("✓ Database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            raise

    def run_startup_migrations(self) -> None:
        """Apply lightweight runtime migrations needed for compatibility."""
        if self._migrations_ran:
            return
        if not self.engine:
            self.initialize()

        try:
            with self.engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE users "
                    "ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'"
                ))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"))
        except Exception as e:
            logger.error(f"Failed to apply startup SQL migrations: {e}")
            raise

        try:
            from .models import User
            from .security import get_password_hash

            with self.session_context() as session:
                admin_user = session.query(User).filter(User.username == "moriol").first()
                hashed = get_password_hash("trebol")

                if admin_user:
                    admin_user.role = "admin"
                    admin_user.is_guest = False
                    admin_user.password_hash = hashed
                    if not admin_user.display_name:
                        admin_user.display_name = "moriol"
                else:
                    session.add(User(
                        username="moriol",
                        password_hash=hashed,
                        is_guest=False,
                        role="admin",
                        display_name="moriol",
                    ))
        except Exception as e:
            logger.error(f"Failed to bootstrap admin user: {e}")
            raise

        self._migrations_ran = True
    
    def drop_all_tables(self) -> None:
        """Drop all tables (USE WITH CAUTION - development only)."""
        if not self.engine:
            self.initialize()
        
        try:
            logger.warning("Dropping all database tables...")
            Base.metadata.drop_all(self.engine)
            logger.info("✓ All tables dropped")
        except Exception as e:
            logger.error(f"Failed to drop tables: {e}")
            raise
    
    def get_session(self) -> Session:
        """Get a new database session."""
        if not self.SessionLocal:
            self.initialize()
        
        return self.SessionLocal()
    
    @contextmanager
    def session_context(self) -> Generator[Session, None, None]:
        """
        Context manager for session lifecycle management.
        
        Usage:
            with db_manager.session_context() as session:
                user = session.query(User).filter_by(username="john").first()
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Session error: {e}")
            raise
        finally:
            session.close()
    
    def close(self) -> None:
        """Close all connections in the pool."""
        if self.engine:
            self.engine.dispose()
            logger.info("Database connections closed")
    
    def __repr__(self):
        return f"<DatabaseManager(host={self.config.host}, db={self.config.database})>"


# Singleton instance for application-wide use
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """
    Get or create the global database manager instance.
    
    Returns:
        DatabaseManager: Singleton instance
    """
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
        _db_manager.initialize()
        _db_manager.create_all_tables()
        _db_manager.run_startup_migrations()
    
    return _db_manager


def get_db_session() -> Session:
    """Dependency injection for FastAPI routes."""
    db = get_db_manager()
    session = db.get_session()
    try:
        yield session
    finally:
        session.close()
