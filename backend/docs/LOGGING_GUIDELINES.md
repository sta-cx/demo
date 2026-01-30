# Logging Guidelines

## Overview

This document defines the standard logging levels and usage guidelines for the Our Daily Backend application. All logging is handled by Winston with appropriate log levels and formats.

## Log Levels

### `debug`
**Purpose**: Sensitive information and detailed debugging information
**Environment**: Development only
**Use Cases**:
- Verification codes, passwords, tokens
- Detailed request/response payloads
- Database query details
- Internal state information

**Example**:
```javascript
logger.debug(`Verification code for ${phone}: ${code}`);
logger.debug('Database query result', { rows: result.rows });
```

### `info`
**Purpose**: General business information and normal operations
**Environment**: All environments
**Use Cases**:
- User actions (login, logout, registration)
- Successful API requests
- Business milestones (couple binding, answer submission)
- Service start/stop

**Example**:
```javascript
logger.info(`User ${userId} logged in successfully`);
logger.info(`New answer submitted for couple ${coupleId}`);
logger.info('Daily question push completed', { count: pushedCount });
```

### `warn`
**Purpose**: Warning information that doesn't stop the application
**Environment**: All environments
**Use Cases**:
- Rate limiting thresholds
- Invalid input attempts
- Deprecated API usage
- Failed retry attempts
- Missing optional configuration

**Example**:
```javascript
logger.warn(`Rate limit exceeded for phone: ${phone}`);
logger.warn('Invalid token provided', { ip: req.ip });
logger.warn('SMS service unavailable, using fallback');
```

### `error`
**Purpose**: Error information that affects functionality
**Environment**: All environments
**Use Cases**:
- Uncaught exceptions
- Database connection failures
- API errors
- Failed critical operations
- Security violations

**Example**:
```javascript
logger.error('Database connection failed', { error: error.message, stack: error.stack });
logger.error('Login error', { error: error.message, phone, stack: error.stack });
```

## Best Practices

### 1. Use Structured Logging
Pass objects as second parameter for better queryability:

```javascript
// Good
logger.info('User logged in', { userId, phone, timestamp });

// Avoid
logger.info(`User ${userId} with phone ${phone} logged in at ${timestamp}`);
```

### 2. Never Log Sensitive Data in Production
Always use `debug` level for sensitive information:

```javascript
// Bad - Never do this in production
logger.info(`Password: ${password}`);

// Good
logger.debug(`Password: ${password}`);
```

### 3. Include Context
Add relevant context to error logs:

```javascript
logger.error('Failed to send SMS', {
  phone,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

### 4. Use Appropriate Log Levels
Choose the right level based on severity and audience:
- **debug**: Developers only
- **info**: Operations and business monitoring
- **warn**: Needs attention but not critical
- **error**: Requires immediate attention

### 5. Environment-Specific Behavior
Production environment should never log:
- Verification codes
- Passwords
- Full request/response bodies
- Personal identifiable information (PII) beyond what's necessary

## Log Files

Logs are stored in the `/backend/logs/` directory:
- **error.log**: All error-level logs (5MB max, 5 files rotated)
- **combined.log**: All logs from info level and above (5MB max, 5 files rotated)

## Configuration

Log levels can be configured via environment variable:
```bash
LOG_LEVEL=debug  # Development
LOG_LEVEL=info   # Production
```

## Examples by Feature

### Authentication
```javascript
// Debug: Verification code (dev only)
logger.debug(`[DEV] Verification code for ${phone}: ${code}`);

// Info: Successful login
logger.info(`User ${userId} logged in successfully`, { phone });

// Warn: Invalid credentials
logger.warn(`Login attempt with invalid code for phone: ${phone}`);

// Error: Login failure
logger.error('Login error', { error: error.message, phone, stack: error.stack });
```

### Question Service
```javascript
// Info: Question generation
logger.info(`Generated daily question for couple ${coupleId}`, { categoryId });

// Warn: No history available
logger.warn(`No answer history for couple ${coupleId}, using default questions`);

// Error: Generation failure
logger.error('Failed to generate question', { coupleId, error: error.message });
```

### Scheduled Tasks
```javascript
// Info: Task completion
logger.info('Daily question push completed', { count: pushedCount, duration: '2s' });

// Warn: Partial failures
logger.warn('Some couples did not receive questions', { failedCount: 5 });

// Error: Task failure
logger.error('Daily question push failed', { error: error.message, stack: error.stack });
```

## Monitoring and Alerts

In production, monitor:
- Error logs: Alert on spike in error rate
- Warn logs: Review daily for patterns
- Info logs: Use for business metrics and analytics

Never create alerts for debug-level logs.
