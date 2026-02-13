#!/usr/bin/env python
"""
Database Initialization & Migration Utility

Usage:
    python database_init.py init              # Initialize all tables
    python database_init.py seed              # Populate with example data
    python database_init.py drop              # Drop all tables (dev only)
    python database_init.py health            # Check database health
"""

import sys
import os
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_db_manager, DatabaseManager
from app.core.models import User, Network, SimulationStat
import uuid
from datetime import datetime, timedelta
import json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def init_database():
    """Initialize database and create all tables."""
    try:
        logger.info("Initializing database...")
        db = get_db_manager()
        db.create_all_tables()
        logger.info("✓ Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        sys.exit(1)


def seed_database():
    """Populate database with example data."""
    try:
        logger.info("Seeding database with example data...")
        db = get_db_manager()
        
        with db.session_context() as session:
            # Create example user
            user_id = uuid.uuid4()
            user = User(
                user_id=user_id,
                username="demo_user",
                password_hash="hashed_password_placeholder",
                created_at=datetime.utcnow(),
            )
            session.add(user)
            logger.info(f"Created user: {user.username}")
            
            # Create example networks
            example_config = {
                "name": "Example Spiking Network",
                "nodes": [
                    {"id": "input_1", "type": "SPIKE_FX", "params": {}},
                    {"id": "neuron_1", "type": "LIF", "params": {"tau": 20.0}},
                    {"id": "neuron_2", "type": "LIF", "params": {"tau": 20.0}},
                ],
                "edges": [
                    {"source": "input_1", "target": "neuron_1"},
                    {"source": "neuron_1", "target": "neuron_2"},
                ]
            }
            
            for i in range(3):
                network_id = uuid.uuid4()
                network = Network(
                    network_id=network_id,
                    user_id=user_id,
                    name=f"Example Network {i+1}",
                    description=f"Demo network for testing warm-start capabilities",
                    metadata_json=example_config,
                    model_sha=f"sha256_placeholder_{i}",
                    compiled_code_url=f"s3://snnverse-models/models/network_{network_id}_{i}.zip",
                    backend_used="cpu",
                    is_example=True,
                )
                session.add(network)
                logger.info(f"Created network: {network.name}")
                
                # Create example simulation stats
                for j in range(2):
                    stat = SimulationStat(
                        user_id=user_id,
                        network_id=network_id,
                        duration_ms=100.0 + (j * 10),
                        spike_count=250 * (i + 1),
                        num_timesteps=1000,
                        wall_time_ms=95.0 + (j * 10),
                        memory_peak_mb=512.5 + (j * 50),
                        backend_used="cpu",
                        status="completed",
                        used_precompiled=(j == 1),  # Second run uses warm-start
                        created_at=datetime.utcnow() - timedelta(hours=j),
                    )
                    session.add(stat)
                    logger.info(f"Created stat: {stat.stat_id}")
            
            session.commit()
            logger.info("✓ Database seeded successfully")
    
    except Exception as e:
        logger.error(f"Failed to seed database: {e}")
        sys.exit(1)


def drop_database():
    """Drop all tables (WARNING: destructive operation)."""
    response = input("⚠️  This will delete ALL data. Type 'yes' to confirm: ")
    if response.lower() != "yes":
        logger.info("Cancelled")
        return
    
    try:
        logger.warning("Dropping all database tables...")
        db = get_db_manager()
        db.drop_all_tables()
        logger.info("✓ All tables dropped")
    except Exception as e:
        logger.error(f"Failed to drop tables: {e}")
        sys.exit(1)


def health_check():
    """Verify database connectivity and schema."""
    try:
        logger.info("Checking database health...")
        db = get_db_manager()
        
        with db.session_context() as session:
            # Test basic query
            session.execute("SELECT 1")
            logger.info("✓ Database connection OK")
            
            # Count records
            user_count = session.query(User).count()
            network_count = session.query(Network).count()
            stat_count = session.query(SimulationStat).count()
            
            logger.info(f"  Users: {user_count}")
            logger.info(f"  Networks: {network_count}")
            logger.info(f"  Simulation Stats: {stat_count}")
            
            logger.info("✓ Database schema OK")
    
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "init":
        init_database()
    elif command == "seed":
        init_database()
        seed_database()
    elif command == "drop":
        drop_database()
    elif command == "health":
        health_check()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
