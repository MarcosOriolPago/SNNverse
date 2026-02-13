"""
Simulation Statistics Recording & Analytics

Provides utilities for tracking simulation execution metrics and performance.
Integrates with the database for historical analysis and reporting.
"""

import logging
from typing import Optional
from datetime import datetime
from uuid import UUID

from .database import get_db_manager, DatabaseManager
from .models import SimulationStat

logger = logging.getLogger(__name__)


class SimulationMetrics:
    """Container for simulation execution metrics."""
    
    def __init__(
        self,
        user_id: UUID,
        network_id: UUID,
        duration_ms: float,
        spike_count: Optional[int] = None,
        num_timesteps: Optional[int] = None,
        wall_time_ms: Optional[float] = None,
        memory_peak_mb: Optional[float] = None,
        backend_used: str = "cpu",
        status: str = "completed",
        error_message: Optional[str] = None,
        used_precompiled: bool = False,
    ):
        self.user_id = user_id
        self.network_id = network_id
        self.duration_ms = duration_ms
        self.spike_count = spike_count
        self.num_timesteps = num_timesteps
        self.wall_time_ms = wall_time_ms
        self.memory_peak_mb = memory_peak_mb
        self.backend_used = backend_used
        self.status = status
        self.error_message = error_message
        self.used_precompiled = used_precompiled
        self.created_at = datetime.utcnow()


class SimulationStatsRecorder:
    """Records and persists simulation statistics to the database."""
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db_manager = db_manager or get_db_manager()
    
    def record(self, metrics: SimulationMetrics) -> UUID:
        """
        Record simulation statistics to the database.
        
        Args:
            metrics: SimulationMetrics object with execution data
        
        Returns:
            UUID of the created SimulationStat record
        """
        try:
            with self.db_manager.session_context() as session:
                stat = SimulationStat(
                    user_id=metrics.user_id,
                    network_id=metrics.network_id,
                    duration_ms=metrics.duration_ms,
                    spike_count=metrics.spike_count,
                    num_timesteps=metrics.num_timesteps,
                    wall_time_ms=metrics.wall_time_ms,
                    memory_peak_mb=metrics.memory_peak_mb,
                    backend_used=metrics.backend_used,
                    status=metrics.status,
                    error_message=metrics.error_message,
                    used_precompiled=metrics.used_precompiled,
                    created_at=metrics.created_at,
                )
                session.add(stat)
                session.commit()
                
                logger.info(
                    f"Recorded simulation stats: "
                    f"network={metrics.network_id}, "
                    f"duration={metrics.duration_ms}ms, "
                    f"spikes={metrics.spike_count}, "
                    f"warm_start={metrics.used_precompiled}"
                )
                
                return stat.stat_id
        
        except Exception as e:
            logger.error(f"Failed to record simulation stats: {e}")
            raise


class SimulationAnalytics:
    """Query and analyze simulation statistics."""
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db_manager = db_manager or get_db_manager()
    
    def get_network_stats(self, network_id: UUID) -> dict:
        """
        Get aggregated statistics for a specific network.
        
        Args:
            network_id: UUID of the network
        
        Returns:
            Dictionary with aggregated metrics
        """
        try:
            from sqlalchemy import func
            
            with self.db_manager.session_context() as session:
                stats = session.query(SimulationStat).filter_by(
                    network_id=network_id,
                    status="completed"
                ).all()
                
                if not stats:
                    return {
                        "network_id": str(network_id),
                        "total_runs": 0,
                        "avg_duration_ms": None,
                        "total_spikes": 0,
                    }
                
                total_duration = sum(s.duration_ms for s in stats)
                avg_duration = total_duration / len(stats)
                total_spikes = sum(s.spike_count or 0 for s in stats)
                warm_starts = sum(1 for s in stats if s.used_precompiled)
                
                return {
                    "network_id": str(network_id),
                    "total_runs": len(stats),
                    "avg_duration_ms": round(avg_duration, 2),
                    "min_duration_ms": min(s.duration_ms for s in stats),
                    "max_duration_ms": max(s.duration_ms for s in stats),
                    "total_spikes": total_spikes,
                    "avg_spikes_per_run": round(total_spikes / len(stats), 1),
                    "warm_starts_count": warm_starts,
                    "warm_start_percentage": round((warm_starts / len(stats)) * 100, 1),
                    "avg_memory_mb": round(
                        sum(s.memory_peak_mb or 0 for s in stats) / len(stats), 1
                    ),
                }
        
        except Exception as e:
            logger.error(f"Failed to get network stats: {e}")
            return {}
    
    def get_user_stats(self, user_id: UUID) -> dict:
        """
        Get aggregated statistics for a specific user.
        
        Args:
            user_id: UUID of the user
        
        Returns:
            Dictionary with user-level metrics
        """
        try:
            with self.db_manager.session_context() as session:
                stats = session.query(SimulationStat).filter_by(
                    user_id=user_id,
                    status="completed"
                ).all()
                
                if not stats:
                    return {
                        "user_id": str(user_id),
                        "total_runs": 0,
                        "total_networks": 0,
                    }
                
                # Count unique networks
                unique_networks = len(set(s.network_id for s in stats))
                
                return {
                    "user_id": str(user_id),
                    "total_runs": len(stats),
                    "total_networks": unique_networks,
                    "avg_duration_ms": round(
                        sum(s.duration_ms for s in stats) / len(stats), 2
                    ),
                    "total_computation_time_min": round(
                        sum(s.wall_time_ms or 0 for s in stats) / 1000 / 60, 1
                    ),
                    "total_spikes": sum(s.spike_count or 0 for s in stats),
                    "failed_runs": len([s for s in stats if s.status == "failed"]),
                }
        
        except Exception as e:
            logger.error(f"Failed to get user stats: {e}")
            return {}
    
    def get_backend_comparison(self, network_id: UUID) -> dict:
        """
        Compare performance across different backends (CPU, CUDA).
        
        Args:
            network_id: UUID of the network
        
        Returns:
            Dictionary with per-backend statistics
        """
        try:
            with self.db_manager.session_context() as session:
                stats = session.query(SimulationStat).filter_by(
                    network_id=network_id,
                    status="completed"
                ).all()
                
                backends = {}
                for stat in stats:
                    backend = stat.backend_used
                    if backend not in backends:
                        backends[backend] = {
                            "count": 0,
                            "total_duration_ms": 0,
                            "total_spikes": 0,
                            "durations": []
                        }
                    
                    backends[backend]["count"] += 1
                    backends[backend]["total_duration_ms"] += stat.duration_ms
                    backends[backend]["total_spikes"] += stat.spike_count or 0
                    backends[backend]["durations"].append(stat.duration_ms)
                
                # Calculate statistics
                result = {}
                for backend, data in backends.items():
                    durations = data["durations"]
                    result[backend] = {
                        "runs": data["count"],
                        "avg_duration_ms": round(
                            data["total_duration_ms"] / data["count"], 2
                        ),
                        "min_duration_ms": min(durations),
                        "max_duration_ms": max(durations),
                        "total_spikes": data["total_spikes"],
                    }
                
                return result
        
        except Exception as e:
            logger.error(f"Failed to compare backends: {e}")
            return {}
    
    def get_warm_start_impact(self, network_id: UUID) -> dict:
        """
        Analyze the performance impact of warm-start compilation.
        
        Args:
            network_id: UUID of the network
        
        Returns:
            Dictionary comparing warm-start vs full build times
        """
        try:
            with self.db_manager.session_context() as session:
                warm_starts = session.query(SimulationStat).filter_by(
                    network_id=network_id,
                    used_precompiled=True,
                    status="completed"
                ).all()
                
                full_builds = session.query(SimulationStat).filter_by(
                    network_id=network_id,
                    used_precompiled=False,
                    status="completed"
                ).all()
                
                if not warm_starts or not full_builds:
                    return {
                        "warm_starts": len(warm_starts),
                        "full_builds": len(full_builds),
                        "comparison": "Insufficient data"
                    }
                
                warm_start_avg = sum(s.duration_ms for s in warm_starts) / len(warm_starts)
                full_build_avg = sum(s.duration_ms for s in full_builds) / len(full_builds)
                
                speedup = full_build_avg / warm_start_avg if warm_start_avg > 0 else 0
                
                return {
                    "warm_starts": len(warm_starts),
                    "full_builds": len(full_builds),
                    "warm_start_avg_ms": round(warm_start_avg, 2),
                    "full_build_avg_ms": round(full_build_avg, 2),
                    "speedup_factor": round(speedup, 2),
                    "time_saved_percent": round((1 - warm_start_avg / full_build_avg) * 100, 1) if full_build_avg > 0 else 0,
                }
        
        except Exception as e:
            logger.error(f"Failed to analyze warm-start impact: {e}")
            return {}


# Convenience functions
def record_simulation(metrics: SimulationMetrics) -> UUID:
    """Shorthand to record simulation metrics."""
    recorder = SimulationStatsRecorder()
    return recorder.record(metrics)


def get_analytics() -> SimulationAnalytics:
    """Get an analytics instance."""
    return SimulationAnalytics()
