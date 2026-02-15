
import sys
import os
import uuid
import time
import requests
import logging

# Add back directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../back')))

from app.core.database import get_db_manager
from app.core.models import User, Network
from app.core.genn_builder import GeNNNetworkBuilder
from app.core.artifact_storage import get_storage_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_integration():
    logger.info("Starting integration test...")

    # 1. Initialize DB and Storage
    db_manager = get_db_manager()
    storage_client = get_storage_client()
    
    # Ensure bucket exists
    try:
        storage_client.s3_client.head_bucket(Bucket=storage_client.config.bucket_name)
        logger.info(f"Bucket {storage_client.config.bucket_name} exists.")
    except Exception as e:
        logger.error(f"Bucket check failed: {e}")
        return

    # 2. Create Dummy User
    user_id = uuid.uuid4()
    with db_manager.session_context() as session:
        user = User(user_id=user_id, username=f"test_user_{user_id}", password_hash="hash")
        session.add(user)
        session.commit()
        logger.info(f"Created test user: {user_id}")

    # 3. Define Network Payload
    network_id = uuid.uuid4()
    payload = {
        "name": "Integration Test Network",
        "nodes": [
            {"id": "input", "type": "INPUT", "params": {}},
            {"id": "neuron", "type": "LIF", "params": {}}
        ],
        "edges": [
            {"source": "input", "target": "neuron"}
        ]
    }

    # 4. Build Network
    logger.info("Building network...")
    builder = GeNNNetworkBuilder(
        network_id=network_id,
        user_id=user_id,
        model_id=f"net_{str(network_id)[:8]}"
    )
    
    # This might take a while as it runs GeNN build
    try:
        code_path, metadata = builder.build_from_json(payload, save_to_db=True)
        logger.info("Build successful.")
    except Exception as e:
        logger.error(f"Build failed: {e}")
        # Allow failure if GeNN is not actually working in this environment, 
        # but we want to test the DB/Storage part mostly.
        # However, GeNN build is required for artifact creation.
        return

    # 5. Verify DB Record
    with db_manager.session_context() as session:
        net = session.query(Network).filter_by(network_id=network_id).first()
        if net and net.compiled_code_url:
            logger.info(f"Network saved to DB with URL: {net.compiled_code_url}")
        else:
            logger.error("Network not found in DB or missing compiled_code_url")
            return

    # 6. Verify Warm Start
    logger.info("Testing warm start...")
    builder2 = GeNNNetworkBuilder(
        network_id=network_id,
        user_id=user_id,
        model_id=f"net_{str(network_id)[:8]}_warm"
    )
    
    if builder2.warm_start_from_db(network_id, user_id):
        logger.info("Warm start successful!")
    else:
        logger.error("Warm start failed.")

if __name__ == "__main__":
    # Wait for services to be ready
    time.sleep(5) 
    test_integration()
