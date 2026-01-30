/**
 * Tests for AI Health Checker
 */

const { AIHealthChecker, AIHealthManager, aiHealthManager } = require('../../src/utils/aiHealthChecker');

describe('AIHealthChecker', () => {
  let checker;

  beforeEach(() => {
    checker = new AIHealthChecker('test-service', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000
    });
  });

  afterEach(() => {
    checker.stopAutoRecovery();
  });

  describe('markSuccess', () => {
    it('should increment success count', () => {
      checker.markSuccess();
      expect(checker.stats.successfulRequests).toBe(1);
      expect(checker.stats.totalRequests).toBe(1);
      expect(checker.stats.consecutiveSuccesses).toBe(1);
    });

    it('should reset consecutive failures on success', () => {
      checker.markFailure(new Error('Test error'));
      checker.markFailure(new Error('Test error'));
      checker.markSuccess();

      expect(checker.stats.consecutiveFailures).toBe(0);
      expect(checker.stats.consecutiveSuccesses).toBe(1);
    });

    it('should move from HALF_OPEN to CLOSED after success', () => {
      // Force to OPEN state
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test error'));
      }

      expect(checker.state).toBe('OPEN');

      // Manually set to HALF_OPEN
      checker.setState('HALF_OPEN');
      checker.markSuccess();

      expect(checker.state).toBe('CLOSED');
      expect(checker.failureCount).toBe(0);
    });

    it('should decrease failure count on success', () => {
      checker.markFailure(new Error('Test error'));
      checker.markFailure(new Error('Test error'));
      expect(checker.failureCount).toBe(2);

      checker.markSuccess();
      expect(checker.failureCount).toBe(1);
    });
  });

  describe('markFailure', () => {
    it('should increment failure count', () => {
      const error = new Error('Test error');
      checker.markFailure(error);

      expect(checker.stats.failedRequests).toBe(1);
      expect(checker.stats.totalRequests).toBe(1);
      expect(checker.stats.consecutiveFailures).toBe(1);
    });

    it('should open circuit after threshold failures', () => {
      expect(checker.state).toBe('CLOSED');

      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error(`Test error ${i}`));
      }

      expect(checker.state).toBe('OPEN');
      expect(checker.isHealthy()).toBe(false);
    });

    it('should reset consecutive successes on failure', () => {
      checker.markSuccess();
      checker.markSuccess();
      checker.markFailure(new Error('Test error'));

      expect(checker.stats.consecutiveSuccesses).toBe(0);
      expect(checker.stats.consecutiveFailures).toBe(1);
    });

    it('should record last failure time', () => {
      const beforeTime = Date.now();
      checker.markFailure(new Error('Test error'));
      const afterTime = Date.now();

      expect(checker.lastFailureTime).toBeGreaterThanOrEqual(beforeTime);
      expect(checker.lastFailureTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('isHealthy', () => {
    it('should return true when circuit is CLOSED', () => {
      expect(checker.state).toBe('CLOSED');
      expect(checker.isHealthy()).toBe(true);
    });

    it('should return false when circuit is OPEN', () => {
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test error'));
      }

      expect(checker.state).toBe('OPEN');
      expect(checker.isHealthy()).toBe(false);
    });

    it('should return true when circuit is HALF_OPEN', () => {
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test error'));
      }
      checker.setState('HALF_OPEN');

      expect(checker.isHealthy()).toBe(true);
    });

    it('should move to HALF_OPEN after recovery timeout', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test error'));
      }

      expect(checker.state).toBe('OPEN');
      expect(checker.isHealthy()).toBe(false);

      // Set lastFailureTime to past
      checker.lastFailureTime = Date.now() - 2000;

      // Call isHealthy to trigger state change
      checker.isHealthy();

      expect(checker.state).toBe('HALF_OPEN');
      expect(checker.isHealthy()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return complete status information', () => {
      checker.markSuccess();
      checker.markFailure(new Error('Test error'));

      const status = checker.getStatus();

      expect(status).toHaveProperty('service', 'test-service');
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('failureThreshold', 3);
      expect(status).toHaveProperty('stats');
      expect(status).toHaveProperty('config');
    });

    it('should include stats with success rate', () => {
      checker.markSuccess();
      checker.markSuccess();
      checker.markFailure(new Error('Test error'));

      const status = checker.getStatus();

      expect(status.stats.totalRequests).toBe(3);
      expect(status.stats.successfulRequests).toBe(2);
      expect(status.stats.failedRequests).toBe(1);
      expect(status.stats.successRate).toBe('66.67%');
    });

    it('should return 0% success rate for no requests', () => {
      const status = checker.getStatus();
      expect(status.stats.successRate).toBe('0.00%');
    });
  });

  describe('getHealthReport', () => {
    it('should include recommendations when circuit is OPEN', () => {
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test error'));
      }

      const report = checker.getHealthReport();

      expect(report.state).toBe('OPEN');
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should include recommendations for low success rate', () => {
      for (let i = 0; i < 10; i++) {
        checker.markFailure(new Error('Test error'));
      }
      checker.markSuccess();

      const report = checker.getHealthReport();

      expect(report.recommendations).toContainEqual(
        expect.stringContaining('Low success rate')
      );
    });
  });

  describe('reset', () => {
    it('should reset all counters and state', () => {
      checker.markSuccess();
      checker.markFailure(new Error('Test error'));
      checker.markFailure(new Error('Test error'));

      checker.reset();

      expect(checker.state).toBe('CLOSED');
      expect(checker.failureCount).toBe(0);
      expect(checker.stats.consecutiveFailures).toBe(0);
      expect(checker.lastFailureTime).toBeNull();
    });
  });

  describe('getStateHistory', () => {
    it('should track state changes', () => {
      checker.setState('OPEN');
      checker.setState('HALF_OPEN');
      checker.setState('CLOSED');

      const history = checker.getStateHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].state).toBe('CLOSED');
    });

    it('should limit history size', () => {
      // Add many state changes
      for (let i = 0; i < 150; i++) {
        checker.setState(i % 2 === 0 ? 'CLOSED' : 'OPEN');
      }

      const history = checker.getStateHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getStatsSummary', () => {
    it('should return comprehensive summary', () => {
      checker.markSuccess();
      checker.markFailure(new Error('Test error'));
      checker.markSuccess();

      const summary = checker.getStatsSummary();

      expect(summary.service).toBe('test-service');
      expect(summary.totalRequests).toBe(3);
      expect(summary.currentState).toBeDefined();
      expect(summary.timeSinceLastSuccess).toBeDefined();
      expect(summary.timeSinceLastFailure).toBeDefined();
    });
  });
});

describe('AIHealthManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AIHealthManager();
  });

  afterEach(() => {
    manager.stopAll();
  });

  describe('register', () => {
    it('should register a new service checker', () => {
      const checker = manager.register('test-service', {
        failureThreshold: 5,
        recoveryTimeout: 30000
      });

      expect(checker).toBeInstanceOf(AIHealthChecker);
      expect(checker.serviceName).toBe('test-service');
    });

    it('should not register duplicate services', () => {
      const checker1 = manager.register('test-service');
      const checker2 = manager.register('test-service');

      expect(checker1).toBe(checker2);
    });
  });

  describe('getChecker', () => {
    it('should return registered checker', () => {
      manager.register('test-service');
      const checker = manager.getChecker('test-service');

      expect(checker).toBeDefined();
      expect(checker.serviceName).toBe('test-service');
    });

    it('should return undefined for unknown service', () => {
      const checker = manager.getChecker('unknown');
      expect(checker).toBeUndefined();
    });
  });

  describe('isHealthy', () => {
    it('should return false for unknown service', () => {
      expect(manager.isHealthy('unknown')).toBe(false);
    });

    it('should return checker health status', () => {
      manager.register('test-service');
      expect(manager.isHealthy('test-service')).toBe(true);

      // Make it unhealthy
      const checker = manager.getChecker('test-service');
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test'));
      }

      expect(manager.isHealthy('test-service')).toBe(false);
    });
  });

  describe('getAllStatus', () => {
    it('should return status for all registered services', () => {
      manager.register('service1');
      manager.register('service2');

      const statuses = manager.getAllStatus();

      expect(Object.keys(statuses)).toEqual(['service1', 'service2']);
      expect(statuses.service1).toHaveProperty('service', 'service1');
      expect(statuses.service2).toHaveProperty('service', 'service2');
    });
  });

  describe('getOverallHealth', () => {
    it('should calculate overall health percentage', () => {
      manager.register('service1');
      manager.register('service2');

      const overall = manager.getOverallHealth();

      expect(overall).toHaveProperty('overallHealth');
      expect(overall).toHaveProperty('healthyServices', 2);
      expect(overall).toHaveProperty('totalServices', 2);
      expect(overall.overallHealth).toBe('100.00%');
    });

    it('should reflect partial health', () => {
      manager.register('service1');
      manager.register('service2');

      // Make service2 unhealthy
      const checker = manager.getChecker('service2');
      for (let i = 0; i < 3; i++) {
        checker.markFailure(new Error('Test'));
      }

      const overall = manager.getOverallHealth();

      expect(overall.healthyServices).toBe(1);
      expect(overall.totalServices).toBe(2);
      expect(overall.overallHealth).toBe('50.00%');
    });
  });

  describe('resetAll', () => {
    it('should reset all checkers', () => {
      manager.register('service1');
      manager.register('service2');

      const checker1 = manager.getChecker('service1');
      const checker2 = manager.getChecker('service2');

      checker1.markFailure(new Error('Test'));
      checker2.markFailure(new Error('Test'));

      manager.resetAll();

      expect(checker1.state).toBe('CLOSED');
      expect(checker2.state).toBe('CLOSED');
    });
  });
});

describe('aiHealthManager singleton', () => {
  it('should have default services registered', () => {
    const status = aiHealthManager.getAllStatus();

    expect(status).toHaveProperty('iflow');
    expect(status).toHaveProperty('ollama');
  });

  it('should be the same instance across imports', () => {
    const { aiHealthManager: manager1 } = require('../../src/utils/aiHealthChecker');
    const { aiHealthManager: manager2 } = require('../../src/utils/aiHealthChecker');

    expect(manager1).toBe(manager2);
  });
});
