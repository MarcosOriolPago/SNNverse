"""
Artifact Storage & Model Archiving Utilities

Provides:
- Model compression (zip compiled GeNN code)
- S3/MinIO upload functionality
- Model SHA generation & verification
- Warm-start code retrieval
"""

import os
import io
import shutil
import hashlib
import logging
from pathlib import Path
from typing import Optional, Tuple
from zipfile import ZipFile
from urllib.parse import urlparse

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception

logger = logging.getLogger(__name__)


class ArtifactStorageConfig:
    """Configuration for S3/MinIO artifact storage."""
    
    def __init__(self):
        # Storage backend selection
        self.storage_type = os.getenv("STORAGE_TYPE", "minio")  # "s3" or "minio"
        self.bucket_name = os.getenv("STORAGE_BUCKET", "snnverse-models")
        
        # S3/MinIO credentials
        self.access_key = os.getenv("STORAGE_ACCESS_KEY", "minioadmin")
        self.secret_key = os.getenv("STORAGE_SECRET_KEY", "minioadmin")
        self.endpoint_url = os.getenv("STORAGE_ENDPOINT_URL", "http://minio:9000")
        self.region = os.getenv("STORAGE_REGION", "us-east-1")
        
        # S3 configuration
        self.use_path_style = os.getenv("STORAGE_PATH_STYLE", "true").lower() == "true"
        
        # Local temporary storage
        self.temp_archive_dir = Path(os.getenv("TEMP_ARCHIVE_DIR", "/tmp/snn_archives"))
        self.temp_archive_dir.mkdir(parents=True, exist_ok=True)


class ModelArchiver:
    """Handles compression and archiving of compiled GeNN models."""
    
    @staticmethod
    def compute_sha256(file_path: str) -> str:
        """
        Compute SHA256 hash of a file.
        
        Args:
            file_path: Path to the file
        
        Returns:
            SHA256 hash string (hex)
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    @staticmethod
    def compute_model_sha(code_dir: str) -> str:
        """
        Compute a SHA256 of the entire model directory structure.
        Used as a content hash to detect changes.
        
        Args:
            code_dir: Path to the *_CODE directory
        
        Returns:
            SHA256 hash of model contents
        """
        sha256_hash = hashlib.sha256()
        code_path = Path(code_dir)
        
        # Hash all files in sorted order for consistency
        for file_path in sorted(code_path.rglob("*")):
            if file_path.is_file():
                with open(file_path, "rb") as f:
                    sha256_hash.update(f.read())
        
        return sha256_hash.hexdigest()
    
    @staticmethod
    def archive_model(code_dir: str, output_zip: Optional[str] = None) -> Tuple[str, str]:
        """
        Compress the compiled GeNN model into a zip archive.
        
        Args:
            code_dir: Path to the *_CODE directory containing:
                - librunner.so (or .dll on Windows)
                - definitions.h
                - Makefile
                - other compiled artifacts
            output_zip: Optional output zip path. If None, uses temp dir.
        
        Returns:
            Tuple of (zip_file_path, model_sha)
        """
        code_path = Path(code_dir)
        if not code_path.exists():
            raise FileNotFoundError(f"Code directory not found: {code_dir}")
        
        # Compute model SHA before archiving
        model_sha = ModelArchiver.compute_model_sha(code_dir)
        logger.info(f"Model SHA256: {model_sha}")
        
        # Create output zip path
        if output_zip is None:
            output_zip = f"/tmp/snn_archives/{code_path.name}_{model_sha[:8]}.zip"
        
        output_path = Path(output_zip)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            logger.info(f"Archiving model to {output_zip}")
            with ZipFile(output_zip, 'w') as zipf:
                # Walk the code directory and add all files
                for file_path in code_path.rglob("*"):
                    if file_path.is_file():
                        # Use relative path within zip (preserves directory structure relative to root)
                        arcname = file_path.relative_to(code_path)
                        zipf.write(file_path, arcname)
            
            logger.info(f"✓ Model archived successfully ({output_path.stat().st_size / 1024 / 1024:.2f} MB)")
            return str(output_path), model_sha
        
        except Exception as e:
            logger.error(f"Failed to archive model: {e}")
            raise
    
    @staticmethod
    def extract_model(zip_path: str, target_dir: str) -> None:
        """
        Extract archived model to target directory.
        
        Args:
            zip_path: Path to the zip file
            target_dir: Target extraction directory
        """
        target_path = Path(target_dir)
        target_path.mkdir(parents=True, exist_ok=True)
        
        try:
            logger.info(f"Extracting model to {target_dir}")
            with ZipFile(zip_path, 'r') as zipf:
                zipf.extractall(target_path)
            logger.info("✓ Model extracted successfully")
        except Exception as e:
            logger.error(f"Failed to extract model: {e}")
            raise


class ArtifactStorageClient:
    """Client for uploading/downloading models to S3/MinIO."""
    
    def __init__(self, config: Optional[ArtifactStorageConfig] = None):
        self.config = config or ArtifactStorageConfig()
        self.s3_client = self._initialize_s3_client()
    
    def _initialize_s3_client(self):
        """Initialize boto3 S3 client for MinIO or S3."""
        if not boto3:
            logger.warning("boto3 not installed. Artifact uploads will be disabled.")
            return None
        
        try:
            if self.config.storage_type == "minio":
                # MinIO-specific configuration
                s3_client = boto3.client(
                    "s3",
                    endpoint_url=self.config.endpoint_url,
                    aws_access_key_id=self.config.access_key,
                    aws_secret_access_key=self.config.secret_key,
                    region_name=self.config.region,
                    use_ssl=self.config.endpoint_url.startswith("https"),
                )
            else:
                # AWS S3
                s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=self.config.access_key,
                    aws_secret_access_key=self.config.secret_key,
                    region_name=self.config.region,
                )
            
            # Test connection by listing buckets
            s3_client.list_buckets()
            logger.info(f"✓ Connected to {self.config.storage_type.upper()}")
            
            # Create bucket if not exists
            self._ensure_bucket_exists(s3_client)
            
            return s3_client
        
        except Exception as e:
            logger.error(f"Failed to initialize S3/MinIO client: {e}")
            return None
    
    def _ensure_bucket_exists(self, s3_client) -> None:
        """Create bucket if it doesn't already exist."""
        try:
            s3_client.head_bucket(Bucket=self.config.bucket_name)
            logger.info(f"✓ Bucket '{self.config.bucket_name}' exists")
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                try:
                    logger.info(f"Creating bucket '{self.config.bucket_name}'")
                    s3_client.create_bucket(Bucket=self.config.bucket_name)
                    logger.info(f"✓ Bucket created")
                except Exception as create_err:
                    logger.error(f"Failed to create bucket: {create_err}")
            else:
                raise
    
    def upload_model(self, zip_path: str, network_id: str, model_sha: str) -> str:
        """
        Upload archived model to S3/MinIO.
        
        Args:
            zip_path: Path to the .zip file
            network_id: Network UUID (used as object key)
            model_sha: Model SHA256 hash
        
        Returns:
            S3 object URL (e.g., s3://bucket/network_id_model_sha.zip)
        """
        if not self.s3_client:
            logger.warning("S3/MinIO client not available. Returning local path.")
            return f"file://{zip_path}"
        
        try:
            file_key = f"models/{network_id}_{model_sha[:8]}.zip"
            
            logger.info(f"Uploading {zip_path} to {self.config.bucket_name}/{file_key}")
            
            with open(zip_path, "rb") as f:
                self.s3_client.upload_fileobj(
                    f,
                    self.config.bucket_name,
                    file_key,
                    ExtraArgs={"Metadata": {"model_sha": model_sha}},
                )
            
            # Generate URL
            s3_url = f"s3://{self.config.bucket_name}/{file_key}"
            logger.info(f"✓ Upload successful: {s3_url}")
            
            return s3_url
        
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            raise
    
    def download_model(self, s3_url: str, local_path: str) -> None:
        """
        Download archived model from S3/MinIO.
        
        Args:
            s3_url: S3 URL (s3://bucket/key)
            local_path: Where to save the file
        """
        if not self.s3_client:
            # If it's a local file URL, just copy
            if s3_url.startswith("file://"):
                source = s3_url.replace("file://", "")
                shutil.copy(source, local_path)
                return
            raise RuntimeError("S3/MinIO client not available")
        
        try:
            # Parse S3 URL
            parsed = urlparse(s3_url)
            bucket = parsed.netloc
            key = parsed.path.lstrip("/")
            
            logger.info(f"Downloading {s3_url}")
            
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            
            self.s3_client.download_file(bucket, key, local_path)
            logger.info(f"✓ Download successful: {local_path}")
        
        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise


# Singleton instances
_archiver: Optional[ModelArchiver] = None
_storage_client: Optional[ArtifactStorageClient] = None


def get_model_archiver() -> ModelArchiver:
    """Get the model archiver instance."""
    global _archiver
    if _archiver is None:
        _archiver = ModelArchiver()
    return _archiver


def get_storage_client() -> ArtifactStorageClient:
    """Get the storage client instance."""
    global _storage_client
    if _storage_client is None:
        _storage_client = ArtifactStorageClient()
    return _storage_client
