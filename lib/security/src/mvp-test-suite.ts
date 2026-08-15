// MVP End-to-End Test Suite
import { MVPIntentClassifier } from '@workspace/ai-gateway/src/mvp-intent-classifier';
import { MVPSecurityManager } from '@workspace/security/src/mvp-security';
import { mvpErrorHandler } from '@workspace/security/src/mvp-error-handler';
import { getMVPTool, getMVPToolNames } from '@workspace/tools/src/tools/mvp-tools';

export class MVPTestSuite {
  private intentClassifier: MVPIntentClassifier;
  private securityManager: MVPSecurityManager;
  private results: { test: string; passed: boolean; message: string }[] = [];

  constructor() {
    this.intentClassifier = new MVPIntentClassifier();
    this.securityManager = new MVPSecurityManager();
  }

  /**
   * Run all MVP tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting MVP Test Suite...\n');

    // Test Intent Classification
    await this.testIntentClassification();

    // Test Security Manager
    await this.testSecurityManager();

    // Test Error Handler
    await this.testErrorHandler();

    // Test MVP Tools
    await this.testMVPTools();

    // Print Results
    this.printResults();
  }

  /**
   * Test Intent Classification
   */
  private async testIntentClassification(): Promise<void> {
    console.log('📝 Testing Intent Classification...');

    const testCases = [
      { text: 'احمد کو آج پریزنٹ کر دو', expectedIntent: 'mark_attendance' },
      { text: 'Ahmed ko aaj present kar do', expectedIntent: 'mark_attendance' },
      { text: 'Mark Ahmed present today', expectedIntent: 'mark_attendance' },
      { text: 'آج کی حاضری دکھاؤ', expectedIntent: 'get_attendance' },
      { text: 'Aaj ki attendance dikhao', expectedIntent: 'get_attendance' },
      { text: 'Show today\'s attendance', expectedIntent: 'get_attendance' },
      { text: 'نیا مزدور بناؤ', expectedIntent: 'create_worker' },
      { text: 'Naya worker banayein', expectedIntent: 'create_worker' },
      { text: 'Create new worker', expectedIntent: 'create_worker' },
      { text: '5000 کا خرچہ لگاؤ', expectedIntent: 'add_expense' },
      { text: '5000 ka expense lagao', expectedIntent: 'add_expense' },
      { text: 'Add 5000 expense', expectedIntent: 'add_expense' },
    ];

    for (const testCase of testCases) {
      const classification = this.intentClassifier.classify(testCase.text);
      const passed = classification.intent === testCase.expectedIntent;
      
      this.results.push({
        test: `Intent: "${testCase.text}"`,
        passed,
        message: passed 
          ? `✓ Classified as ${classification.intent}`
          : `✗ Expected ${testCase.expectedIntent}, got ${classification.intent}`
      });
    }

    // Test command detection
    const commandTest = this.intentClassifier.isCommand('Mark attendance');
    this.results.push({
      test: 'Command Detection',
      passed: commandTest,
      message: commandTest ? '✓ Correctly identified as command' : '✗ Failed to identify command'
    });

    console.log('✅ Intent Classification tests completed\n');
  }

  /**
   * Test Security Manager
   */
  private async testSecurityManager(): Promise<void> {
    console.log('🔒 Testing Security Manager...');

    // Test permission checking
    const ownerCheck = this.securityManager.checkPermission(
      'mark_attendance',
      'attendance:write',
      { userRole: 'owner' }
    );
    this.results.push({
      test: 'Owner Permission Check',
      passed: ownerCheck.allowed,
      message: ownerCheck.allowed ? '✓ Owner has permission' : '✗ Owner permission denied'
    });

    const viewerCheck = this.securityManager.checkPermission(
      'delete_worker',
      'workers:delete',
      { userRole: 'viewer' }
    );
    this.results.push({
      test: 'Viewer Permission Check',
      passed: !viewerCheck.allowed,
      message: !viewerCheck.allowed ? '✓ Viewer correctly denied' : '✗ Viewer incorrectly granted'
    });

    // Test risk assessment
    const highRisk = this.securityManager.assessRiskLevel('delete_worker', {});
    this.results.push({
      test: 'High Risk Assessment',
      passed: highRisk === 'high',
      message: highRisk === 'high' ? '✓ Correctly assessed as high risk' : '✗ Risk assessment incorrect'
    });

    const lowRisk = this.securityManager.assessRiskLevel('get_attendance', {});
    this.results.push({
      test: 'Low Risk Assessment',
      passed: lowRisk === 'low',
      message: lowRisk === 'low' ? '✓ Correctly assessed as low risk' : '✗ Risk assessment incorrect'
    });

    // Test input validation
    const validInput = this.securityManager.validateInput('mark_attendance', {
      worker_name: 'Ahmed',
      project_name: 'Construction'
    });
    this.results.push({
      test: 'Valid Input Validation',
      passed: validInput.valid,
      message: validInput.valid ? '✓ Valid input accepted' : '✗ Valid input rejected'
    });

    const invalidInput = this.securityManager.validateInput('add_expense', {
      amount: -100,
      description: '<script>alert("xss")</script>'
    });
    this.results.push({
      test: 'Invalid Input Validation',
      passed: !invalidInput.valid,
      message: !invalidInput.valid ? '✓ Invalid input rejected' : '✗ Invalid input accepted'
    });

    // Test input sanitization
    const sanitized = this.securityManager.sanitizeInput({
      name: '<script>alert("xss")</script>',
      amount: 1000001
    });
    this.results.push({
      test: 'Input Sanitization',
      passed: !sanitized.name.includes('<script>') && sanitized.amount <= 1000000,
      message: (!sanitized.name.includes('<script>') && sanitized.amount <= 1000000)
        ? '✓ Input properly sanitized'
        : '✗ Sanitization failed'
    });

    console.log('✅ Security Manager tests completed\n');
  }

  /**
   * Test Error Handler
   */
  private async testErrorHandler(): Promise<void> {
    console.log('⚠️  Testing Error Handler...');

    // Test error classification
    const networkError = mvpErrorHandler.classifyError(new Error('Network connection failed'));
    this.results.push({
      test: 'Network Error Classification',
      passed: networkError.type === 'network',
      message: networkError.type === 'network' ? '✓ Network error classified' : '✗ Classification failed'
    });

    const apiError = mvpErrorHandler.classifyError({ status: 500, message: 'Server error' });
    this.results.push({
      test: 'API Error Classification',
      passed: apiError.type === 'api',
      message: apiError.type === 'api' ? '✓ API error classified' : '✗ Classification failed'
    });

    const permissionError = mvpErrorHandler.classifyError(new Error('Permission denied'));
    this.results.push({
      test: 'Permission Error Classification',
      passed: permissionError.type === 'permission',
      message: permissionError.type === 'permission' ? '✓ Permission error classified' : '✗ Classification failed'
    });

    // Test user-friendly messages
    const urduMessage = mvpErrorHandler.getUserMessage(networkError, 'urdu');
    this.results.push({
      test: 'Urdu Error Message',
      passed: urduMessage.includes('انٹرنیٹ'),
      message: urduMessage.includes('انٹرنیٹ') ? '✓ Urdu message generated' : '✗ Urdu message failed'
    });

    const englishMessage = mvpErrorHandler.getUserMessage(networkError, 'english');
    this.results.push({
      test: 'English Error Message',
      passed: englishMessage.includes('Network'),
      message: englishMessage.includes('Network') ? '✓ English message generated' : '✗ English message failed'
    });

    // Test retry with backoff
    let attemptCount = 0;
    const retryResult = await mvpErrorHandler.handleAsync(
      async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network connection failed');
        }
        return 'success';
      },
      { retry: true }
    );
    this.results.push({
      test: 'Retry with Backoff',
      passed: retryResult.success && attemptCount === 3,
      message: retryResult.success && attemptCount === 3
        ? '✓ Retry succeeded after 3 attempts'
        : '✗ Retry failed'
    });

    console.log('✅ Error Handler tests completed\n');
  }

  /**
   * Test MVP Tools
   */
  private async testMVPTools(): Promise<void> {
    console.log('🔧 Testing MVP Tools...');

    // Test tool registry
    const toolNames = getMVPToolNames();
    this.results.push({
      test: 'MVP Tool Registry',
      passed: toolNames.length > 0,
      message: toolNames.length > 0 
        ? `✓ Found ${toolNames.length} MVP tools`
        : '✗ No MVP tools found'
    });

    // Test expected tools exist
    const expectedTools = ['mark_attendance', 'get_attendance', 'create_worker', 'get_worker_info', 'add_expense', 'get_expenses'];
    for (const toolName of expectedTools) {
      const tool = getMVPTool(toolName);
      this.results.push({
        test: `Tool: ${toolName}`,
        passed: tool !== undefined,
        message: tool !== undefined ? `✓ ${toolName} available` : `✗ ${toolName} not found`
      });
    }

    // Test tool structure
    const markAttendanceTool = getMVPTool('mark_attendance');
    if (markAttendanceTool) {
      this.results.push({
        test: 'Tool Structure (mark_attendance)',
        passed: markAttendanceTool.name === 'mark_attendance' && 
                markAttendanceTool.parameters !== undefined &&
                markAttendanceTool.execute !== undefined,
        message: (markAttendanceTool.name === 'mark_attendance' && 
                markAttendanceTool.parameters !== undefined &&
                markAttendanceTool.execute !== undefined)
          ? '✓ Tool structure valid'
          : '✗ Tool structure invalid'
      });
    }

    console.log('✅ MVP Tools tests completed\n');
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n📊 Test Results Summary\n');
    console.log('─'.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    for (const result of this.results) {
      console.log(`${result.message}`);
    }

    console.log('─'.repeat(60));
    console.log(`\nTotal: ${total} tests`);
    console.log(`Passed: ${passed} tests`);
    console.log(`Failed: ${total - passed} tests`);
    console.log(`Success Rate: ${percentage}%\n`);

    if (percentage === 100) {
      console.log('🎉 All MVP tests passed! The MVP is ready for deployment.\n');
    } else {
      console.log('⚠️  Some tests failed. Please review the failures above.\n');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const testSuite = new MVPTestSuite();
  testSuite.runAllTests().catch(console.error);
}

export { MVPTestSuite };
