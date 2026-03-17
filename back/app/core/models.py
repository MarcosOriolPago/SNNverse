"""
SQLAlchemy ORM Models for SpikeVerse

Defines database schema for:
- Users (authentication & persistence)
- Networks (model metadata & compiled artifact locations)
- Simulation Stats (execution metrics & performance tracking)
"""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, LargeBinary, ForeignKey, Text, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

Base = declarative_base()


class User(Base):
    """User accounts and authentication."""
    __tablename__ = "users"
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for guests and Google-only users
    is_guest = Column(Boolean, default=False, nullable=False)
    role = Column(String(20), default="user", nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    networks = relationship("Network", back_populates="user", cascade="all, delete-orphan")
    simulation_stats = relationship("SimulationStat", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(user_id={self.user_id}, username={self.username}, is_guest={self.is_guest}, role={self.role})>"


class Network(Base):
    """Network definitions and compiled model artifacts."""
    __tablename__ = "networks"
    
    network_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Network configuration as JSONB
    metadata_json = Column(JSONB, nullable=False, comment="Stores node/edge config from frontend")
    
    # Artifact storage & compilation tracking
    compiled_code_url = Column(String(512), nullable=True, comment="S3/MinIO path to compiled .zip")
    model_sha = Column(String(64), nullable=True, unique=False, index=True, comment="GeNN model checksum (SHA256)")
    
    # Model metadata
    is_example = Column(Boolean, default=False, nullable=False)
    backend_used = Column(String(50), default="cpu", nullable=False)  # cpu, cuda, single_threaded_cpu
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_compiled_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="networks")
    simulation_stats = relationship("SimulationStat", back_populates="network", cascade="all, delete-orphan")
    
    # Indexes for query optimization
    __table_args__ = (
        Index("idx_user_name", "user_id", "name"),
        Index("idx_model_sha", "model_sha"),
    )
    
    def __repr__(self):
        return f"<Network(network_id={self.network_id}, name={self.name}, user_id={self.user_id})>"


class SimulationStat(Base):
    """Execution metrics and performance statistics."""
    __tablename__ = "simulation_stats"
    
    stat_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    network_id = Column(UUID(as_uuid=True), ForeignKey("networks.network_id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Simulation execution metrics
    duration_ms = Column(Float, nullable=False, comment="Total simulation time in milliseconds")
    spike_count = Column(Integer, nullable=True, comment="Total number of spikes across all neurons")
    backend_used = Column(String(50), nullable=False, comment="CPU, CUDA, etc.")
    num_timesteps = Column(Integer, nullable=True, comment="Number of timesteps executed")
    
    # Performance tracking
    wall_time_ms = Column(Float, nullable=True, comment="Actual computation time")
    memory_peak_mb = Column(Float, nullable=True, comment="Peak memory usage")
    
    # Execution status
    status = Column(String(50), default="completed", nullable=False)  # completed, failed, timeout
    error_message = Column(Text, nullable=True)
    
    # Warm-start tracking
    used_precompiled = Column(Boolean, default=False, nullable=False, comment="Whether warm-start was used")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="simulation_stats")
    network = relationship("Network", back_populates="simulation_stats")
    
    # Indexes for analytics
    __table_args__ = (
        Index("idx_user_created", "user_id", "created_at"),
        Index("idx_network_created", "network_id", "created_at"),
    )
    
    def __repr__(self):
        return f"<SimulationStat(stat_id={self.stat_id}, network_id={self.network_id}, duration_ms={self.duration_ms})>"
