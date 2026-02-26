# SpikeVerse Database Setup

This directory contains PostgreSQL initialization scripts that are automatically executed when the database container starts for the first time.

## Structure

```
db/
└── init/
    ├── 01-schema.sql    # Database schema (tables, indexes, triggers)
    └── 02-seed.sql      # Optional seed data (demo user, example networks)
```

## Schema Overview

### Tables

#### `users`
- **Purpose**: User authentication and account management
- **Primary Key**: `user_id` (UUID)
- **Unique Constraints**: `username`
- **Fields**:
  - `user_id`: UUID (auto-generated)
  - `username`: VARCHAR(255), unique
  - `password_hash`: VARCHAR(255) (bcrypt)
  - `created_at`, `updated_at`: TIMESTAMP (auto-managed)

#### `networks`
- **Purpose**: SNN network definitions and compiled artifacts
- **Primary Key**: `network_id` (UUID)
- **Foreign Keys**: `user_id` → `users.user_id`
- **Fields**:
  - `network_id`: UUID (auto-generated)
  - `user_id`: UUID (FK with CASCADE delete)
  - `name`: VARCHAR(255)
  - `description`: TEXT
  - `metadata_json`: JSONB (stores node/edge graph from frontend)
  - `compiled_code_url`: VARCHAR(512) (S3/MinIO path)
  - `model_sha`: VARCHAR(64) (GeNN checksum for warm-start)
  - `is_example`: BOOLEAN
  - `backend_used`: VARCHAR(50) (cpu, cuda, single_threaded_cpu)
  - `created_at`, `updated_at`, `last_compiled_at`: TIMESTAMP

#### `simulation_stats`
- **Purpose**: Performance metrics and execution tracking
- **Primary Key**: `stat_id` (UUID)
- **Foreign Keys**: `user_id`, `network_id` (both CASCADE delete)
- **Fields**:
  - `stat_id`: UUID (auto-generated)
  - `user_id`, `network_id`: UUID (FKs)
  - `duration_ms`: FLOAT (simulation time)
  - `spike_count`: INTEGER
  - `backend_used`: VARCHAR(50)
  - `num_timesteps`: INTEGER
  - `wall_time_ms`, `memory_peak_mb`: FLOAT
  - `status`: VARCHAR(50) (completed, failed, timeout)
  - `error_message`: TEXT
  - `used_precompiled`: BOOLEAN (warm-start indicator)
  - `created_at`: TIMESTAMP

### Indexes

Optimized for common query patterns:
- User lookup by ID and username
- Network queries by user, name, and SHA
- Simulation stats by user, network, and timestamp
- Composite indexes for analytics queries

### Triggers

- **Auto-update timestamps**: `updated_at` columns automatically update on row modification

## Docker Integration

The initialization scripts are automatically mounted into the PostgreSQL container via docker-compose:

```yaml
services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
```

PostgreSQL executes all `.sql` files in `/docker-entrypoint-initdb.d/` in alphabetical order during first-time container initialization.

## Usage

### First-Time Setup

1. **Start the database**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Verify initialization**:
   ```bash
   docker logs SpikeVerse-postgres
   ```
   Look for messages: "SpikeVerse database schema initialized successfully!"

3. **Connect to database**:
   ```bash
   docker exec -it SpikeVerse-postgres psql -U SpikeVerse_user -d SpikeVerse_db
   ```

4. **Verify tables**:
   ```sql
   \dt
   SELECT * FROM users;
   ```

### Demo Account

If seed data is loaded, a demo account is available:
- **Username**: `demo_user`
- **Password**: `demo123`
- **User ID**: `00000000-0000-0000-0000-000000000001`

### Reset Database

To completely reset the database and re-run initialization scripts:

```bash
# Stop and remove postgres container + volume
docker-compose down -v postgres
docker volume rm SpikeVerse_postgres_data

# Restart (will re-run init scripts)
docker-compose up -d postgres
```

## Environment Variables

Configure in `.env` or docker-compose:
- `DB_USER` (default: `SpikeVerse_user`)
- `DB_PASSWORD` (default: `SpikeVerse_password`)
- `DB_NAME` (default: `SpikeVerse_db`)

## SQLAlchemy Integration

The Python backend uses SQLAlchemy ORM models defined in `back/app/core/models.py`. These models mirror the SQL schema and provide:
- Type-safe database operations
- Relationship management (cascading deletes)
- Schema validation

## Adding New Tables

1. Create new migration SQL file: `db/init/0X-tablename.sql`
2. Update SQLAlchemy models: `back/app/core/models.py`
3. Reset database or manually apply changes

## Backup and Restore

### Backup
```bash
docker exec SpikeVerse-postgres pg_dump -U SpikeVerse_user SpikeVerse_db > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i SpikeVerse-postgres psql -U SpikeVerse_user -d SpikeVerse_db
```

## Production Considerations

For production deployments:
1. **Change default passwords** in `.env`
2. **Remove seed data**: Delete or rename `02-seed.sql`
3. **Set strong password policies**
4. **Enable SSL/TLS** for PostgreSQL connections
5. **Configure regular backups**
6. **Review and restrict user permissions**
7. **Consider using managed database services** (AWS RDS, etc.)
