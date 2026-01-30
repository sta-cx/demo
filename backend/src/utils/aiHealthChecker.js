/**
 * AI Health Checker with Circuit Breaker Pattern
 *
 * Tracks the health status of AI services (iFlow, Ollama) and implements
 * circuit breaker pattern to prevent cascading failures.
 */

const logger = require('./logger');

class AIHealthChecker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes

    // Circuit breaker state
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastStateChange: Date.now(),
      stateHistory: []
    };

    // Auto-recovery check interval
    this.recoveryInterval = null;
    this.startAutoRecovery();
  }

  /**
   * Mark a successful request
   */
  markSuccess() {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // Reset failure count on success
    if (this.failureCount > 0) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    // If in HALF_OPEN state, move to CLOSED
    if (this.state === 'HALF_OPEN') {
      this.setState('CLOSED');
      this.failureCount = 0;
      logger.info(`Circuit breaker CLOSED for ${this.serviceName} after successful recovery`);
    }

    logger.debug(`AI health check success for ${this.serviceName}`, {
      state: this.state,
      failureCount: this.failureCount,
      consecutiveSuccesses: this.stats.consecutiveSuccesses
    });
  }

  /**
   * Mark a failed request
   */
  markFailure(error) {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (this.failureCount >= this.failureThreshold && this.state !== 'OPEN') {
      this.setState('OPEN');
      logger.warn(`Circuit breaker OPEN for ${this.serviceName} after ${this.failureCount} failures`, {
        error: error?.message || 'Unknown error'
      });
    }

    logger.warn(`AI health check failure for ${this.serviceName}`, {
      state: this.state,
      failureCount: this.failureCount,
      consecutiveFailures: this.stats.consecutiveFailures,
      error: error?.message || 'Unknown error'
    });
  }

  /**
   * Check if the service is healthy
   */
  isHealthy() {
    // If circuit is OPEN, check if we should try HALF_OPEN
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.recoveryTimeout) {
        this.setState('HALF_OPEN');
        logger.info(`Circuit breaker moved to HALF_OPEN for ${this.serviceName}`);
        return true; // Allow one request through
      }
      return false;
    }

    return this.state !== 'OPEN';
  }

  /**
   * Get the current health status
   */
  getStatus() {
    const uptime = Date.now() - this.stats.lastStateChange;
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
      : '0.00';

    return {
      service: this.serviceName,
      state: this.state,
      healthy: this.isHealthy(),
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      uptime: `${Math.floor(uptime / 1000)}s`,
      stats: {
        ...this.stats,
        successRate: `${successRate}%`
      },
      config: {
        recoveryTimeout: `${this.recoveryTimeout / 1000}s`,
        monitoringPeriod: `${this.monitoringPeriod / 1000}s`
      }
    };
  }

  /**
   * Get detailed health report
   */
  getHealthReport() {
    const status = this.getStatus();
    const recommendations = [];

    if (status.state === 'OPEN') {
      recommendations.push('Circuit is open - requests are being blocked');
      recommendations.push(`Wait for recovery timeout (${status.config.recoveryTimeout}) before retrying`);
    } else if (status.state === 'HALF_OPEN') {
      recommendations.push('Circuit is half-open - testing service recovery');
      recommendations.push('Next successful request will close the circuit');
    }

    if (parseFloat(status.stats.successRate) < 50) {
      recommendations.push('Low success rate detected - consider reviewing service configuration');
    }

    if (status.stats.consecutiveFailures > 5) {
      recommendations.push('High consecutive failures - service may be unavailable');
    }

    return {
      ...status,
      recommendations
    };
  }

  /**
   * Reset the circuit breaker
   */
  reset() {
    const previousState = this.state;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.stats.consecutiveFailures = 0;

    logger.info(`Circuit breaker reset for ${this.serviceName}`, {
      previousState,
      newState: this.state
    });
  }

  /**
   * Set circuit breaker state
   * @private
   */
  setState(newState) {
    const previousState = this.state;
    this.state = newState;
    this.stats.lastStateChange = Date.now();
    this.stats.stateHistory.push({
      state: newState,
      timestamp: Date.now(),
      previousState
    });

    // Keep only last 100 state changes
    if (this.stats.stateHistory.length > 100) {
      this.stats.stateHistory = this.stats.stateHistory.slice(-100);
    }
  }

  /**
   * Start auto-recovery checking
   * @private
   */
  startAutoRecovery() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }

    this.recoveryInterval = setInterval(() => {
      if (this.state === 'OPEN') {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        if (timeSinceLastFailure >= this.recoveryTimeout) {
          this.setState('HALF_OPEN');
          logger.info(`Auto-recovery: Circuit breaker moved to HALF_OPEN for ${this.serviceName}`);
        }
      }
    }, this.recoveryTimeout / 2); // Check twice per recovery timeout
  }

  /**
   * Stop auto-recovery checking
   */
  stopAutoRecovery() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
      logger.info(`Auto-recovery stopped for ${this.serviceName}`);
    }
  }

  /**
   * Get state history
   */
  getStateHistory(limit = 10) {
    return this.stats.stateHistory.slice(-limit);
  }

  /**
   * Get statistics summary
   */
  getStatsSummary() {
    return {
      service: this.serviceName,
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      successRate: this.stats.totalRequests > 0
        ? `${(this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)}%`
        : '0%',
      consecutiveFailures: this.stats.consecutiveFailures,
      consecutiveSuccesses: this.stats.consecutiveSuccesses,
      currentState: this.state,
      timeSinceLastSuccess: this.lastSuccessTime
        ? `${Math.floor((Date.now() - this.lastSuccessTime) / 1000)}s ago`
        : 'never',
      timeSinceLastFailure: this.lastFailureTime
        ? `${Math.floor((Date.now() - this.lastFailureTime) / 1000)}s ago`
        : 'never'
    };
  }
}

/**
 * AI Health Manager - Manages multiple AI service health checkers
 */
class AIHealthManager {
  constructor() {
    this.checkers = new Map();
  }

  /**
   * Register a service health checker
   */
  register(serviceName, options) {
    if (!this.checkers.has(serviceName)) {
      const checker = new AIHealthChecker(serviceName, options);
      this.checkers.set(serviceName, checker);
      logger.info(`Registered health checker for ${serviceName}`);
    }
    return this.checkers.get(serviceName);
  }

  /**
   * Get a service health checker
   */
  getChecker(serviceName) {
    return this.checkers.get(serviceName);
  }

  /**
   * Mark success for a service
   */
  markSuccess(serviceName) {
    const checker = this.checkers.get(serviceName);
    if (checker) {
      checker.markSuccess();
    }
  }

  /**
   * Mark failure for a service
   */
  markFailure(serviceName, error) {
    const checker = this.checkers.get(serviceName);
    if (checker) {
      checker.markFailure(error);
    }
  }

  /**
   * Check if a service is healthy
   */
  isHealthy(serviceName) {
    const checker = this.checkers.get(serviceName);
    return checker ? checker.isHealthy() : false;
  }

  /**
   * Get status for all services
   */
  getAllStatus() {
    const status = {};
    for (const [name, checker] of this.checkers.entries()) {
      status[name] = checker.getStatus();
    }
    return status;
  }

  /**
   * Get health report for all services
   */
  getAllHealthReports() {
    const reports = {};
    for (const [name, checker] of this.checkers.entries()) {
      reports[name] = checker.getHealthReport();
    }
    return reports;
  }

  /**
   * Reset all checkers
   */
  resetAll() {
    for (const [name, checker] of this.checkers.entries()) {
      checker.reset();
    }
  }

  /**
   * Get overall system health
   */
  getOverallHealth() {
    const statuses = this.getAllStatus();
    const services = Object.keys(statuses);
    const healthyCount = services.filter(s => statuses[s].healthy).length;
    const overallHealth = services.length > 0
      ? (healthyCount / services.length * 100).toFixed(2)
      : '0';

    return {
      overallHealth: `${overallHealth}%`,
      healthyServices: healthyCount,
      totalServices: services.length,
      services: statuses,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stop all auto-recovery checks
   */
  stopAll() {
    for (const [name, checker] of this.checkers.entries()) {
      checker.stopAutoRecovery();
    }
  }
}

// Create singleton instance
const aiHealthManager = new AIHealthManager();

// Register default AI services
aiHealthManager.register('iflow', {
  failureThreshold: 3,
  recoveryTimeout: 60000,
  monitoringPeriod: 300000
});

aiHealthManager.register('ollama', {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitoringPeriod: 180000
});

module.exports = {
  AIHealthChecker,
  AIHealthManager,
  aiHealthManager
};
