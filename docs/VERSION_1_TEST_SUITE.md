# Version 1 Test Suite

## Overview

This test suite provides comprehensive testing guidelines for Version 1 of the Hisab Kitab AI Voice Assistant. It covers all new features including advanced voice recognition, expanded tools, enhanced AI integration, and security features.

## Test Environment Setup

### Prerequisites

- Development environment with Version 1 installed
- Test database (separate from production)
- Test user accounts with different roles
- Browser with microphone support
- OpenRouter API key (for AI testing)

### Test Data Setup

```sql
-- Create test database
CREATE DATABASE hisabkitab_v1_test;

-- Insert test workers
INSERT INTO labour (name, daily_wage, phone) VALUES
  ('Ahmed', 1000, '03001234567'),
  ('Ali', 1200, '03007654321'),
  ('Raza', 1100, '03009876543');

-- Insert test project
INSERT INTO projects (name, location, start_date, end_date, budget) VALUES
  ('Liberty Tower', 'Lahore', '2026-01-01', '2026-12-31', 500000);

-- Insert test attendance
INSERT INTO attendance (project_id, labour_id, date, status, wage_for_day) VALUES
  (1, 1, '2026-08-15', 'present', 1000),
  (1, 2, '2026-08-15', 'present', 1200);
```

## Test Categories

### Phase A: Advanced Voice Recognition Tests

#### Test A1: Whisper.cpp Integration

**Objective**: Verify Whisper.cpp loads and processes audio correctly

**Test Steps:**
1. Open application in browser
2. Check browser console for Whisper.cpp WASM load
3. Click microphone button
4. Speak clearly in Urdu: "احمد کو آج پریزنٹ کر دو"
5. Verify transcription appears with confidence score
6. Verify confidence score > 0.7

**Expected Result:**
- Whisper.cpp loads successfully
- Transcription appears within 2 seconds
- Confidence score displayed
- Confidence score > 0.7

**Test Case ID**: A1-WHISPER-001

---

#### Test A2: Web Speech API Fallback

**Objective**: Verify Web Speech API works when Whisper.cpp unavailable

**Test Steps:**
1. Disable Whisper.cpp in settings
2. Click microphone button
3. Speak clearly in English: "Mark Ahmed present"
4. Verify transcription appears
5. Verify fallback is working

**Expected Result:**
- Web Speech API activates
- Transcription appears
- No errors in console

**Test Case ID**: A2-WEBSPEECH-001

---

#### Test A3: Multi-Language Detection

**Objective**: Verify language detection works for Urdu, Hindi, and English

**Test Steps:**

**Urdu Test:**
1. Speak in Urdu: "حاضری لگانا"
2. Verify language detected as 'ur'

**Hindi Test:**
1. Speak in Hindi: "हाजिरी लगाओ"
2. Verify language detected as 'hi'

**English Test:**
1. Speak in English: "Mark attendance"
2. Verify language detected as 'en'

**Roman Urdu Test:**
1. Speak in Roman Urdu: "Attendance lagao"
2. Verify language detected appropriately

**Expected Result:**
- Language detected correctly for each test
- Language indicator shows detected language
- Confidence score > 0.6 for each

**Test Case ID**: A3-LANGUAGE-001

---

#### Test A4: Noise Cancellation

**Objective**: Verify noise cancellation reduces background noise

**Test Steps:**
1. Enable noise cancellation in settings
2. Create background noise (TV, traffic, etc.)
3. Speak command: "احمد کو پریزنٹ کر دو"
4. Verify transcription is accurate despite noise
5. Disable noise cancellation
6. Repeat with same noise
7. Compare accuracy

**Expected Result:**
- With noise cancellation: transcription accuracy > 80%
- Without noise cancellation: lower accuracy
- Visual feedback shows noise reduction active

**Test Case ID**: A4-NOISE-001

---

#### Test A5: Voice Activity Detection

**Objective**: Verify VAD correctly detects speech vs. silence

**Test Steps:**
1. Enable VAD in settings
2. Click microphone button
3. Stay silent for 5 seconds
4. Verify no transcription occurs
5. Speak command: "احمد کو پریزنٹ کر دو"
6. Verify transcription occurs
7. Stop speaking but keep microphone active
8. Verify silence is detected

**Expected Result:**
- Silence is not transcribed
- Speech is transcribed correctly
- Visual indicator shows when speech detected

**Test Case ID**: A5-VAD-001

---

### Phase B: Expanded Tool Tests

#### Test B1: Attendance Mark

**Objective**: Verify attendance marking works correctly

**Test Steps:**

**Urdu:**
1. Speak: "احمد کو آج پریزنٹ کر دو"
2. Verify attendance marked
3. Check database for record

**English:**
1. Speak: "Mark Ali present today"
2. Verify attendance marked
3. Check database for record

**Expected Result:**
- Attendance record created in database
- Correct worker matched
- Correct date used
- Correct status saved

**Test Case ID**: B1-ATTENDANCE-001

---

#### Test B2: Attendance Update

**Objective**: Verify attendance can be updated

**Test Steps:**
1. Speak: "احمد کی حاضری تبدیل کرو"
2. Follow disambiguation prompts
3. Select attendance record
4. Choose new status
5. Verify update in database

**Expected Result:**
- Attendance record updated
- Status changed correctly
- Confirmation dialog shows correct details

**Test Case ID**: B2-ATTENDANCE-001

---

#### Test B3: Bulk Attendance

**Objective**: Verify bulk attendance marking works

**Test Steps:**
1. Speak: "احمد، علی، اور رازہ کو آج پریزنٹ کر دو"
2. Verify all workers marked
3. Check database for all records

**Expected Result:**
- 3 attendance records created
- All correct workers matched
- All same date
- All correct status

**Test Case ID**: B3-ATTENDANCE-001

---

#### Test B4: Attendance Summary

**Objective**: Verify attendance summary generation

**Test Steps:**
1. Speak: "اس ہفتے کی حاضری کا خلاصہ دکھاؤ"
2. Verify summary appears
3. Check statistics accuracy

**Expected Result:**
- Summary displays correct statistics
- Total records accurate
- Present/absent counts accurate
- Attendance rate calculated correctly

**Test Case ID**: B4-ATTENDANCE-001

---

#### Test B5: Payment Create

**Objective**: Verify payment creation works

**Test Steps:**
1. Speak: "احمد کو 5000 تنخواہ دو"
2. Verify payment created
3. Check database for record
4. Verify risk-based confirmation triggers

**Expected Result:**
- Payment record created
- Correct amount
- Correct worker
- Confirmation dialog appears (medium risk)

**Test Case ID**: B5-PAYMENT-001

---

#### Test B6: Payment Query

**Objective**: Verify payment querying works

**Test Steps:**
1. Speak: "احمد کی ادائیگیاں دکھاؤ"
2. Verify payments displayed
3. Check data accuracy

**Expected Result:**
- All Ahmed's payments shown
- Correct amounts
- Correct dates
- No other workers' payments

**Test Case ID**: B6-PAYMENT-001

---

#### Test B7: Project Create

**Objective**: Verify project creation works

**Test Steps:**
1. Speak: "لبرٹی ٹاورر نام سے نیا پروجیکٹ بناؤ"
2. Verify project created
3. Check database for record

**Expected Result:**
- Project record created
- Correct name
- Default values set correctly

**Test Case ID**: B7-PROJECT-001

---

#### Test B8: Project Status

**Objective**: Verify project status query works

**Test Steps:**
1. Speak: "لبرٹی ٹاورر کا حال دکھاؤ"
2. Verify status displayed
3. Check data accuracy

**Expected Result:**
- Project status displayed
- Progress shown
- Budget information shown
- Workers assigned shown

**Test Case ID**: B8-PROJECT-001

---

#### Test B9: Material Add

**Objective**: Verify material addition works

**Test Steps:**
1. Speak: "100 بگیٹ سیمنٹ شامل کرو"
2. Verify material added
3. Check database for record

**Expected Result:**
- Material record created
- Correct quantity
- Correct unit
- Correct item name

**Test Case ID**: B9-MATERIAL-001

---

#### Test B10: Reporting

**Objective**: Verify report generation works

**Test Steps:**

**Attendance Report:**
1. Speak: "اگست کی حاضری کی رپورٹ بناؤ"
2. Verify report generated

**Expense Report:**
1. Speak: "اس ہفتے کے اخراجات کی رپورٹ بناؤ"
2. Verify report generated

**Expected Result:**
- Reports generated correctly
- Data accurate
- Format correct

**Test Case ID**: B10-REPORT-001

---

### Phase C: Enhanced AI Integration Tests

#### Test C1: Multi-Model Routing

**Objective**: Verify model routing works correctly

**Test Steps:**
1. Speak simple command: "احمد کی حاضری دکھاؤ"
2. Check which model was used (should be cost-optimized)
3. Speak complex command with reasoning
4. Check which model was used (should be higher quality)
5. Verify routing decisions logged

**Expected Result:**
- Simple tasks routed to fast/cheap models
- Complex tasks routed to quality models
- Cost optimization working
- Routing decisions logged

**Test Case ID**: C1-ROUTING-001

---

#### Test C2: Context Memory

**Objective**: Verify context is retained across turns

**Test Steps:**
1. Speak: "لبرٹی ٹاورر پروجیکٹ کی حاضری دکھاؤ"
2. Speak: "اس میں کتنے کام کر رہے ہیں؟"
3. Verify second command understands "usme" refers to Liberty Tower
4. Check context manager logs

**Expected Result:**
- Second command uses context correctly
- Project identified from context
- No disambiguation needed
- Context retained in memory

**Test Case ID**: C2-CONTEXT-001

---

#### Test C3: Conversation Memory

**Objective**: Verify conversation memory works for multi-turn dialogue

**Test Steps:**
1. Speak: "احمد کو پریزنٹ کر دو"
2. Speak: "اسے کتنے دینے ہیں؟"
3. Verify second command understands "use" refers to Ahmed
4. Check conversation memory logs

**Expected Result:**
- Reference resolved correctly
- Worker identified from context
- No disambiguation needed
- Conversation retained in memory

**Test Case ID**: C3-CONVERSATION-001

---

#### Test C4: Entity Resolution

**Objective**: Verify entity resolution with fuzzy matching

**Test Steps:**

**Nickname Test:**
1. Speak: "احمی" (nickname for Ahmed)
2. Verify resolved to Ahmed

**Phonetic Test:**
1. Speak: "احمد" with accent
2. Verify resolved correctly

**Partial Match Test:**
1. Speak: "اح" (partial name)
2. Verify disambiguation appears with options

**Expected Result:**
- Nicknames resolved correctly
- Phonetic matching works
- Partial matches trigger disambiguation

**Test Case ID**: C4-ENTITY-001

---

### Phase D: Advanced Security Tests

#### Test D1: Risk-Based Confirmation

**Objective**: Verify confirmation levels adjust based on risk

**Test Steps:**

**Low Risk:**
1. As non-owner user, speak: "احمد کی حاضری دکھاؤ"
2. Verify no confirmation required

**Medium Risk:**
1. Speak: "احمد کو 5000 دو"
2. Verify simple confirmation required

**High Risk:**
1. Speak: "احمد کی حاضری حذف کرو"
2. Verify detailed confirmation required

**Critical Risk:**
1. Speak: "پروجیکٹ حذف کرو"
3. Verify two-factor confirmation required

**Expected Result:**
- Confirmation level matches risk
- Risk factors logged
- Confirmation details accurate

**Test Case ID**: D1-RISK-001

---

#### Test D2: Audit Logging

**Objective**: Verify all events are logged

**Test Steps:**
1. Speak: "احمد کو پریزنٹ کر دو"
2. Check audit logs for:
   - Voice command event
   - Intent classification event
   - Entity resolution event
   - Tool execution event
3. Verify metadata completeness

**Expected Result:**
- All events logged
- Metadata complete
- Timestamps accurate
- User information included

**Test Case ID**: D2-AUDIT-001

---

#### Test D3: Anomaly Detection

**Objective**: Verify anomaly detection works

**Test Steps:**

**Frequency Anomaly:**
1. Issue 100+ commands in 1 minute
2. Verify anomaly detected
3. Check warning appears

**Time Anomaly:**
1. Issue command at unusual time (3 AM)
2. Verify anomaly detected
3. Check warning appears

**Amount Anomaly:**
1. Issue payment for 200,000 (unusually high)
2. Verify anomaly detected
3. Check warning appears

**Expected Result:**
- Anomalies detected correctly
- Warnings displayed
- Anomalies logged
- Severity levels correct

**Test Case ID**: D3-ANOMALY-001

---

#### Test D4: Rate Limiting

**Objective**: Verify rate limiting works

**Test Steps:**
1. Issue 35 commands in 1 minute (over limit of 30)
2. Verify rate limit triggered
3. Check error message
4. Wait 1 minute
5. Issue command again
6. Verify allowed again

**Expected Result:**
- Rate limit triggers at 30 commands
- Error message clear
- Commands blocked after limit
- Automatically unblocks after window

**Test Case ID**: D4-RATELIMIT-001

---

### Phase E: Enhanced UX Tests

#### Test E1: Rich Feedback UI

**Objective**: Verify rich feedback displays correctly

**Test Steps:**
1. Speak command
2. Verify confidence score displayed
3. Verify confidence bar shows percentage
4. Verify language indicator shows
5. Verify processing info displays
6. Verify status indicators work

**Expected Result:**
- Confidence score visible
- Confidence bar animates
- Language indicator shows
- Processing info displays model
- Status indicators change correctly

**Test Case ID**: E1-FEEDBACK-001

---

#### Test E2: Advanced Disambiguation

**Objective**: Verify advanced disambiguation works

**Test Steps:**
1. Speak: "احمد کی حاضری حذف کرو" (ambiguous if multiple Ahmeds)
2. Verify disambiguation dialog appears
3. Test search functionality
4. Test multi-select (if applicable)
5. Test voice selection by speaking number
6. Verify selection works

**Expected Result:**
- Disambiguation dialog appears
- Search filters options
- Multi-select works
- Voice selection works
- Selection processed correctly

**Test Case ID**: E2-DISAMBIGUATION-001

---

#### Test E3: Settings Customization

**Objective**: Verify settings customization works

**Test Steps:**
1. Open settings modal
2. Change language preference
3. Change voice speed
4. Change sensitivity
5. Change confirmation level
6. Save settings
7. Test voice commands with new settings
8. Verify settings applied

**Expected Result:**
- Settings save correctly
- Language preference applied
- Voice speed changed
- Sensitivity affects recognition
- Confirmation level changes
- Reset to defaults works

**Test Case ID**: E3-SETTINGS-001

---

#### Test E4: Command History Persistence

**Objective**: Verify command history persists to database

**Test Steps:**
1. Issue several voice commands
2. Close browser
3. Reopen application
4. Open command history
5. Verify previous commands present
6. Test search functionality
7. Test filters

**Expected Result:**
- Commands persisted
- Database query works
- Search finds commands
- Filters work correctly
- Export functionality works

**Test Case ID**: E4-HISTORY-001

---

#### Test E5: Analytics Dashboard

**Objective**: Verify analytics display correctly

**Test Steps:**
1. Open analytics dashboard
2. Verify total commands shown
3. Verify success rate calculated
4. Verify top intents shown
5. Verify processing time trends
6. Verify language distribution

**Expected Result:**
- Statistics accurate
- Visualizations display
- Data real-time
- Filters work

**Test Case ID**: E5-ANALYTICS-001

---

## Integration Tests

### Test IT1: End-to-End Workflow

**Objective**: Verify complete workflow from voice to database

**Test Steps:**
1. Speak: "لبرٹی ٹاورر کے لیے احمد کو آج پریزنٹ کر دو"
2. Verify context understood (project + worker)
3. Verify intent classified
4. Verify entity resolved
5. Verify tool executed
6. Verify database record created
7. Verify audit log entry
8. Verify command history entry
9. Verify rich feedback displayed

**Expected Result:**
- Complete workflow successful
- All steps pass
- No errors
- Data consistent

**Test Case ID**: IT1-E2E-001

---

### Test IT2: Multi-Turn Conversation

**Objective**: Verify multi-turn conversation works end-to-end

**Test Steps:**
1. Speak: "لبرٹی ٹاورر کی حاضری دکھاؤ"
2. Speak: "اس میں کتنے کام کر رہے ہیں؟"
3. Speak: "ان میں سے کتنے آج ہیں؟"
4. Verify context retained across all turns
5. Verify references resolved correctly
6. Verify all queries accurate

**Expected Result:**
- Context retained
- References resolved
- Queries accurate
- No disambiguation needed

**Test Case ID**: IT2-MULTITURN-001

---

## Performance Tests

### Test P1: Voice Recognition Latency

**Objective**: Verify voice recognition meets latency targets

**Test Steps:**
1. Speak command
2. Measure time to transcription
3. Repeat 10 times
4. Calculate average latency

**Expected Result:**
- Average latency < 2 seconds (Whisper.cpp)
- 95th percentile < 3 seconds
- Maximum < 5 seconds

**Test Case ID**: P1-LATENCY-001

---

### Test P2: AI Response Latency

**Objective**: Verify AI response meets latency targets

**Test Steps:**
1. Speak command
2. Measure time to response
3. Repeat 10 times
4. Calculate average latency

**Expected Result:**
- Average latency < 3 seconds
- 95th percentile < 5 seconds
- Maximum < 8 seconds

**Test Case ID**: P2-LATENCY-002

---

### Test P3: Total Command Execution Time

**Objective**: Verify total command execution meets targets

**Test Steps:**
1. Speak command
2. Measure time to completion
3. Repeat 10 times
4. Calculate average

**Expected Result:**
- Average < 5 seconds
- 95th percentile < 8 seconds
- Maximum < 10 seconds

**Test Case ID**: P3-LATENCY-003

---

## Accuracy Tests

### Test Acc1: Speech Recognition Accuracy

**Objective**: Verify speech recognition accuracy > 85%

**Test Steps:**
1. Prepare 100 test phrases (Urdu, Hindi, English)
2. Speak each phrase
3. Compare transcription to expected
4. Calculate accuracy percentage

**Expected Result:**
- Overall accuracy > 85%
- Urdu accuracy > 85%
- Hindi accuracy > 85%
- English accuracy > 90%

**Test Case ID**: ACC1-SPEECH-001

---

### Test Acc2: Intent Classification Accuracy

**Objective**: Verify intent classification accuracy > 90%

**Test Steps:**
1. Prepare 100 test commands
2. Classify each command
3. Compare to expected intent
4. Calculate accuracy percentage

**Expected Result:**
- Overall accuracy > 90%
- Simple intents > 95%
- Complex intents > 85%

**Test Case ID**: ACC2-INTENT-001

---

### Test Acc3: Entity Resolution Accuracy

**Objective**: Verify entity resolution accuracy > 85%

**Test Steps:**
1. Prepare 100 test commands with entities
2. Resolve entities
3. Compare to expected entities
4. Calculate accuracy percentage

**Expected Result:**
- Overall accuracy > 85%
- Exact matches > 95%
- Fuzzy matches > 80%

**Test Case ID**: ACC3-ENTITY-001

---

## Security Tests

### Test Sec1: SQL Injection Prevention

**Objective**: Verify SQL injection is prevented

**Test Steps:**
1. Speak command with SQL injection attempt
2. Verify command rejected or sanitized
3. Check database for injection

**Expected Result:**
- Injection attempt blocked
- No SQL injection in database
- Error logged

**Test Case ID**: SEC1-SQLI-001

---

### Test Sec2: XSS Prevention

**Objective**: Verify XSS is prevented

**Test Steps:**
1. Speak command with XSS attempt
2. Verify output sanitized
3. Check no script execution

**Expected Result:**
- XSS attempt blocked
- No script execution
- Input sanitized

**Test Case ID**: SEC2-XSS-001

---

### Test Sec3: Authentication Bypass Prevention

**Objective**: Verify authentication cannot be bypassed

**Test Steps:**
1. Try to access protected endpoint without auth
2. Verify access denied
3. Try to modify JWT token
4. Verify token invalidation

**Expected Result:**
- Access denied without auth
- Invalid tokens rejected
- Token modification detected

**Test Case ID**: SEC3-AUTH-001

---

## Browser Compatibility Tests

### Test Browser1: Chrome

**Test Steps:**
1. Open application in Chrome
2. Test all features
3. Check console for errors

**Expected Result:**
- All features work
- No console errors
- Performance acceptable

**Test Case ID**: BROWSER1-CHROME-001

---

### Test Browser2: Firefox

**Test Steps:**
1. Open application in Firefox
2. Test all features
3. Check console for errors

**Expected Result:**
- All features work
- No console errors
- Performance acceptable

**Test Case ID**: BROWSER2-FIREFOX-001

---

### Test Browser3: Edge

**Test Steps:**
1. Open application in Edge
2. Test all features
3. Check console for errors

**Expected Result:**
- All features work
- No console errors
- Performance acceptable

**Test Case ID**: BROWSER3-EDGE-001

---

## Test Execution Schedule

### Pre-Deployment Tests (Before Production)

**Critical Path (Must Pass):**
- IT1: End-to-End Workflow
- IT2: Multi-Turn Conversation
- Acc1: Speech Recognition Accuracy
- Acc2: Intent Classification Accuracy
- D1: Risk-Based Confirmation
- D2: Audit Logging
- D4: Rate Limiting

**Standard Tests:**
- All Phase A tests (Voice Recognition)
- All Phase B tests (Expanded Tools)
- All Phase E tests (Enhanced UX)

**Optional Tests:**
- Phase C tests (AI Integration)
- Phase D3: Anomaly Detection
- Performance tests
- Browser compatibility tests

### Post-Deployment Tests (After Production)

**Smoke Tests:**
- Basic voice recognition
- Simple commands
- Database connectivity
- API endpoints

**Monitoring Tests:**
- Check application logs
- Check audit logs
- Check error rates
- Check performance metrics

---

## Test Results Template

```markdown
## Test Execution Results

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Development/Staging/Production]
**Version**: Version 1.0.0

### Summary
- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Skipped: [X]
- Pass Rate: [X]%

### Failed Tests
1. [Test Case ID] - [Test Name]
   - Expected: [Expected Result]
   - Actual: [Actual Result]
   - Severity: [Critical/High/Medium/Low]

### Critical Issues
- [List any critical issues]

### Recommendations
- [List recommendations]
```

## Bug Reporting Template

```markdown
## Bug Report

**Test Case ID**: [ID]
**Title**: [Brief description]
**Severity**: [Critical/High/Medium/Low]
**Environment**: [Environment details]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots/Logs**:
[Attach screenshots or logs]

**Workaround**:
[If available]
```

## Conclusion

This test suite provides comprehensive coverage of all Version 1 features. Execute tests in the recommended order to ensure quality before deployment.

**Success Criteria for Version 1:**
- All critical path tests pass
- Speech recognition accuracy > 85%
- Intent classification accuracy > 90%
- Entity resolution accuracy > 85%
- No critical security vulnerabilities
- Performance targets met

---

**Version 1 Test Suite - Ready for Execution**
