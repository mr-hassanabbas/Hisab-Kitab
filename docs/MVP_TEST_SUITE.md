# MVP Test Suite - Manual Test Instructions

Since automated testing requires additional setup, this document provides manual test cases for verifying MVP functionality.

## Test Environment Setup

1. **Prerequisites**
   - OpenRouter API key configured in environment
   - Database running with test data
   - Chrome or Edge browser (for Web Speech API)
   - Microphone connected and working

2. **Test Data Required**
   - At least 1 project in database
   - At least 2 workers in database
   - Test expense categories configured

## Intent Classification Tests

### Test Case 1: Urdu Commands

**Test Commands:**
- "احمد کو آج پریزنٹ کر دو"
- "آج کی حاضری دکھاؤ"
- "نیا مزدور بناؤ"
- "5000 کا خرچہ لگاؤ"

**Expected Results:**
- ✅ Each command should be classified with correct intent
- ✅ Confidence score should be > 0.7
- ✅ Entities should be extracted (worker name, amount, etc.)

**Verification Method:**
Check browser console logs for intent classification output.

### Test Case 2: Roman Urdu Commands

**Test Commands:**
- "Ahmed ko aaj present kar do"
- "Aaj ki attendance dikhao"
- "Naya worker banayein"
- "5000 ka expense lagao"

**Expected Results:**
- ✅ Each command should be classified with correct intent
- ✅ Confidence score should be > 0.7
- ✅ Entities should be extracted correctly

**Verification Method:**
Check browser console logs for intent classification output.

### Test Case 3: English Commands

**Test Commands:**
- "Mark Ahmed present today"
- "Show today's attendance"
- "Create new worker"
- "Add 5000 expense"

**Expected Results:**
- ✅ Each command should be classified with correct intent
- ✅ Confidence score should be > 0.7
- ✅ Entities should be extracted correctly

**Verification Method:**
Check browser console logs for intent classification output.

### Test Case 4: Mixed Language Commands

**Test Commands:**
- "Ahmed ko aaj present kar do bhai"
- "Mujhe attendance chahiye"
- "Project kholo aur attendance dikhao"

**Expected Results:**
- ✅ Commands should be classified reasonably
- ✅ System should not crash on mixed input
- ✅ Should attempt to extract key entities

**Verification Method:**
Check browser console logs for intent classification output.

## Security Tests

### Test Case 5: Permission Checking

**Test Method:**
1. Login as 'viewer' role user
2. Try to execute 'delete_worker' command
3. Check for permission denied response

**Expected Results:**
- ✅ Viewer should be denied delete operations
- ✅ Error message should be user-friendly (Urdu/English)
- ✅ Security event should be logged

**Verification Method:**
Check command history for permission denied entry.

### Test Case 6: Input Validation

**Test Method:**
1. Try to add expense with negative amount: "-5000 ka expense lagao"
2. Try to add expense with XSS attempt: "<script>alert('xss')</script> ka expense lagao"
3. Try to add expense with excessive amount: "100000000 ka expense lagao"

**Expected Results:**
- ✅ Negative amounts should be rejected
- ✅ XSS attempts should be sanitized
- ✅ Excessive amounts should be capped
- ✅ User should receive clear error message

**Verification Method:**
Check response from voice assistant and command history.

### Test Case 7: Risk Assessment

**Test Method:**
1. Try high-risk operation: "delete worker Ahmed"
2. Try medium-risk operation: "create worker"
3. Try low-risk operation: "show attendance"

**Expected Results:**
- ✅ High-risk operations should require confirmation
- ✅ Medium-risk operations may require confirmation based on role
- ✅ Low-risk operations should execute immediately

**Verification Method:**
Check if confirmation prompt appears for high-risk operations.

## Error Handling Tests

### Test Case 8: Network Error Simulation

**Test Method:**
1. Disconnect internet connection
2. Try to execute voice command
3. Reconnect and retry

**Expected Results:**
- ✅ Should detect network error
- ✅ Should display user-friendly error message (Urdu)
- ✅ Should offer retry option
- ✅ Should retry automatically when reconnected

**Verification Method:**
Check error message from voice assistant.

### Test Case 9: API Error Handling

**Test Method:**
1. Use invalid OpenRouter API key
2. Try to execute voice command
3. Restore valid API key

**Expected Results:**
- ✅ Should detect API error
- ✅ Should display appropriate error message
- ✅ Should fall back to local parsing if available
- ✅ Should log error for debugging

**Verification Method:**
Check error message and console logs.

### Test Case 10: Retry Logic

**Test Method:**
1. Temporarily block OpenRouter API
2. Execute voice command
3. Unblock API

**Expected Results:**
- ✅ Should retry up to 3 times with exponential backoff
- ✅ Should not retry non-retryable errors
- ✅ Should succeed on retry if API becomes available
- ✅ Should display retry status to user

**Verification Method:**
Check console logs for retry attempts and timing.

## Voice Recognition Tests

### Test Case 11: Urdu Speech Recognition

**Test Method:**
1. Click microphone button
2. Speak clearly in Urdu: "احمد کو آج پریزنٹ کر دو"
3. Wait for processing

**Expected Results:**
- ✅ Speech should be transcribed accurately
- ✅ Text should match spoken words reasonably
- ✅ Intent should be classified correctly
- ✅ Action should be executed successfully

**Verification Method:**
Check live text display and command history.

### Test Case 12: English Speech Recognition

**Test Method:**
1. Click microphone button
2. Speak clearly in English: "Mark Ahmed present today"
3. Wait for processing

**Expected Results:**
- ✅ Speech should be transcribed accurately
- ✅ Text should match spoken words
- ✅ Intent should be classified correctly
- ✅ Action should be executed successfully

**Verification Method:**
Check live text display and command history.

### Test Case 13: Mixed Language Speech Recognition

**Test Method:**
1. Click microphone button
2. Speak in mixed language: "Ahmed ko aaj present kar do"
3. Wait for processing

**Expected Results:**
- ✅ Speech should be transcribed reasonably
- ✅ System should handle mixed input gracefully
- ✅ Intent should be classified from key terms
- ✅ Action should be attempted

**Verification Method:**
Check live text display and command history.

## Integration Tests

### Test Case 14: End-to-End Attendance Flow

**Test Method:**
1. Say: "احمد کو آج پریزنٹ کر دو"
2. Wait for confirmation
3. Say: "آج کی حاضری دکھاؤ"
4. Verify Ahmed is marked present

**Expected Results:**
- ✅ Command should be understood
- ✅ Attendance should be marked
- ✅ Confirmation should be spoken
- ✅ Query should show updated attendance
- ✅ History should show both commands

**Verification Method:**
Check database records and command history.

### Test Case 15: End-to-End Worker Creation Flow

**Test Method:**
1. Say: "Naya worker banayein named Ali Khan"
2. Wait for confirmation
3. Say: "Ali Khan ki details dikhao"
4. Verify worker was created

**Expected Results:**
- ✅ Command should be understood
- ✅ Worker should be created
- ✅ Confirmation should be spoken
- ✅ Query should show worker details
- ✅ History should show both commands

**Verification Method:**
Check database records and command history.

### Test Case 16: End-to-End Expense Flow

**Test Method:**
1. Say: "5000 ka expense lagao for cement"
2. Wait for confirmation
3. Say: "Expenses dikhao"
4. Verify expense was recorded

**Expected Results:**
- ✅ Command should be understood
- ✅ Expense should be recorded
- ✅ Confirmation should be spoken
- ✅ Query should show expense
- ✅ History should show both commands

**Verification Method:**
Check database records and command history.

## Performance Tests

### Test Case 17: Response Time

**Test Method:**
1. Execute 10 voice commands
2. Measure time from speech end to response
3. Calculate average response time

**Expected Results:**
- ✅ Average response time should be < 5 seconds
- ✅ Voice-to-text should be < 2 seconds
- ✅ AI processing should be < 3 seconds
- ✅ Total command execution should be < 5 seconds

**Verification Method:**
Check console logs for timing information.

### Test Case 18: Cache Performance

**Test Method:**
1. Execute same command twice
2. Compare response times
3. Check cache hit logs

**Expected Results:**
- ✅ Second execution should be faster (cache hit)
- ✅ Cache should reduce AI API calls
- ✅ User should see same result
- ✅ Console should log cache hit

**Verification Method:**
Check console logs for cache status and timing.

## UI/UX Tests

### Test Case 19: Command History

**Test Method:**
1. Execute 5 voice commands
2. Click history button
3. Verify all commands are listed
4. Click on a command to see details

**Expected Results:**
- ✅ All commands should appear in history
- ✅ Timestamps should be correct
- ✅ Success/failure status should be shown
- ✅ Details should be viewable
- ✅ Clear history should work

**Verification Method:**
Check command history modal.

### Test Case 20: Voice Feedback

**Test Method:**
1. Execute successful command
2. Execute failed command
3. Listen to voice responses

**Expected Results:**
- ✅ Success should have positive voice feedback
- ✅ Failure should have helpful error message
- ✅ Messages should be in same language as command
- ✅ Voice should be clear and understandable

**Verification Method:**
Listen to voice assistant responses.

## Test Results Summary

After completing all test cases, document results:

| Test Case | Passed | Failed | Notes |
|-----------|--------|--------|-------|
| Intent Classification (Urdu) | ☐ | ☐ | |
| Intent Classification (Roman Urdu) | ☐ | ☐ | |
| Intent Classification (English) | ☐ | ☐ | |
| Intent Classification (Mixed) | ☐ | ☐ | |
| Permission Checking | ☐ | ☐ | |
| Input Validation | ☐ | ☐ | |
| Risk Assessment | ☐ | ☐ | |
| Network Error Handling | ☐ | ☐ | |
| API Error Handling | ☐ | ☐ | |
| Retry Logic | ☐ | ☐ | |
| Urdu Speech Recognition | ☐ | ☐ | |
| English Speech Recognition | ☐ | ☐ | |
| Mixed Speech Recognition | ☐ | ☐ | |
| E2E Attendance Flow | ☐ | ☐ | |
| E2E Worker Creation Flow | ☐ | ☐ | |
| E2E Expense Flow | ☐ | ☐ | |
| Response Time | ☐ | ☐ | |
| Cache Performance | ☐ | ☐ | |
| Command History | ☐ | ☐ | |
| Voice Feedback | ☐ | ☐ | |

**Overall Result:** ☐ Passed (100%) ☐ Passed (>80%) ☐ Failed (<80%)

## Known Issues Found During Testing

Document any issues discovered during testing:

1. 
2. 
3. 

## Recommendations

Based on test results, provide recommendations for MVP improvements:

1. 
2. 
3. 

---

**Test Completed By:** ______________________
**Date:** ______________________
**Environment:** ______________________
