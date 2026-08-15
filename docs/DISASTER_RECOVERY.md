# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for the Hisab Kitab AI Voice Assistant system.

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| RPO (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| RTO (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| Backup Frequency | Hourly | Database backup frequency |
| Retention Period | 30 days | Backup retention period |
| Config Retention | 90 days | Configuration backup retention |

## Backup Strategy

### 1. Database Backups

**Location**: `./backups/database/`

**Frequency**: 
- Daily automated backups (recommended)
- Manual backups before major changes

**Script**: `./scripts/backup-database.sh`

**Features**:
- Full PostgreSQL dump
- Gzip compression
- Optional S3 upload (if AWS credentials configured)
- Automatic retention policy (30 days)

**Usage**:
```bash
./scripts/backup-database.sh
```

### 2. Configuration Backups

**Location**: `./backups/config/`

**Frequency**: 
- Weekly automated backups
- Manual backups before configuration changes

**Script**: `./scripts/backup-config.sh`

**Features**:
- Environment variables (.env files)
- Package configuration (package.json, pnpm-workspace.yaml)
- TypeScript configuration
- Drizzle configuration
- Optional S3 upload
- Automatic retention policy (90 days)

**Usage**:
```bash
./scripts/backup-config.sh
```

### 3. Audit Log Backups

**Location**: Database (ai_audit_log table)

**Frequency**: 
- Continuous logging to database
- Monthly export to JSON (manual)

**Script**: To be implemented

**Features**:
- All AI actions logged
- Tool execution tracked
- Audit trail maintained

## Recovery Procedures

### 1. Database Recovery

**Script**: `./scripts/recover-database.sh`

**Prerequisites**:
- Valid backup file (.sql or .sql.gz)
- DATABASE_URL configured in .env
- Application services stopped

**Steps**:
1. Stop application services
2. Drop existing database
3. Create new database
4. Restore from backup
5. Restart application services
6. Verify with health check

**Usage**:
```bash
./scripts/recover-database.sh ./backups/database/full_20240115_120000.sql.gz
```

**Verification**:
- Health check endpoint: `GET /api/healthz`
- Manual testing of key features
- Data integrity checks

### 2. Configuration Recovery

**Steps**:
1. Extract configuration backup
2. Copy .env files to appropriate locations
3. Restart application services
4. Verify configuration

**Usage**:
```bash
tar -xzf ./backups/config/config_20240115.tar.gz
```

### 3. Point-in-Time Recovery

**Prerequisites**:
- WAL archiving enabled (PostgreSQL feature)
- Base backup available
- WAL logs available

**Steps**:
1. Restore from base backup
2. Configure recovery target time
3. Replay WAL logs
4. Verify data consistency

**Note**: This feature requires PostgreSQL WAL archiving configuration.

## Disaster Scenarios

### Scenario 1: Database Corruption

**Detection**:
- Application errors
- Database connection failures
- Data inconsistency

**Recovery Steps**:
1. Identify corruption point
2. Stop application
3. Restore from last known good backup
4. Verify data integrity
5. Restart application
6. Monitor for issues

**Recovery Time**: ~2 hours

### Scenario 2: Server Failure

**Detection**:
- Server unreachable
- All services down
- Monitoring alerts

**Recovery Steps**:
1. Identify failure cause
2. Provision new server
3. Restore configuration
4. Restore database
5. Deploy application
6. Verify functionality

**Recovery Time**: ~4 hours

### Scenario 3: Data Loss

**Detection**:
- Missing data
- Incorrect data
- User reports

**Recovery Steps**:
1. Identify affected data
2. Determine data loss point
3. Restore from appropriate backup
4. Verify data integrity
5. Communicate with users

**Recovery Time**: ~1-2 hours

### Scenario 4: Security Breach

**Detection**:
- Unauthorized access
- Suspicious activity
- Security alerts

**Recovery Steps**:
1. Identify breach scope
2. Isolate affected systems
3. Change all credentials
4. Restore from clean backup
5. Review security logs
6. Implement additional security measures

**Recovery Time**: ~4-6 hours

## Testing

### Monthly Recovery Drill

**Frequency**: Monthly

**Procedure**:
1. Select recent backup
2. Restore to test environment
3. Verify data integrity
4. Test key functionality
5. Document recovery time
6. Update procedures if needed

**Responsibility**: DevOps team

### Backup Integrity Verification

**Frequency**: Weekly

**Script**: `./scripts/verify-backup.sh`

**Procedure**:
1. Select random backup
2. Restore to test database
3. Verify table structure
4. Check row counts
5. Cleanup test database

**Usage**:
```bash
./scripts/verify-backup.sh ./backups/database/full_20240115_120000.sql.gz
```

## Monitoring

### Backup Monitoring

**Metrics to Monitor**:
- Backup success/failure rate
- Backup size trends
- Backup duration
- Retention policy compliance

**Alerts**:
- Backup failure (immediate)
- Backup size anomaly (investigate)
- Retention policy violation (weekly)

### Recovery Monitoring

**Metrics to Monitor**:
- Recovery time objectives
- Data integrity after recovery
- Application functionality after recovery

**Alerts**:
- RTO exceeded (immediate)
- Data integrity issues (immediate)

## Contact Information

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | [Name] | [Email/Phone] |
| Database Admin | [Name] | [Email/Phone] |
| System Admin | [Name] | [Email/Phone] |
| Emergency Contact | [Name] | [Email/Phone] |

## Appendix

### Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Database | Daily | 30 days | ./backups/database/ + S3 |
| Configuration | Weekly | 90 days | ./backups/config/ + S3 |
| Audit Logs | Monthly | 1 year | Database + JSON export |

### Recovery Escalation

**Level 1**: Standard recovery (DevOps team)
**Level 2**: Complex recovery (DevOps + Database Admin)
**Level 3**: Emergency recovery (All team members)

### Documentation Updates

This document should be reviewed and updated:
- After any major system changes
- After any recovery incidents
- Quarterly as part of system review

---

**Last Updated**: 2024-01-15
**Version**: 1.0