# 🔬 Logout Diagnostics - Comprehensive Testing Protocol

## 🎯 Objective
Identify the exact cause of logout hanging after tab switching with detailed step-by-step logging.

## 🧪 Test Scenarios

### **Scenario A: Normal Logout (Control Test)**
**Purpose**: Establish baseline behavior when logout works normally

**Steps**:
1. Open browser with DevTools console open (F12)
2. Navigate to app
3. Sign in with Telegram
4. **WITHOUT switching tabs**, click logout immediately
5. Record all console logs

**Expected Outcome**: Logout should work normally
**Key Logs to Watch**: 
- `🚪 LOGOUT: Starting logout process...`
- `🚪 SIGNOUT: Starting signOut process...` 
- `🚪 SIGNOUT: Step 7B - Manual signout completed successfully`

---

### **Scenario B: Logout After Tab Switch (Problem Test)**
**Purpose**: Reproduce the hanging issue with detailed logging

**Steps**:
1. Open browser with DevTools console open (F12)
2. Navigate to app  
3. Sign in with Telegram
4. **Switch to another tab for 10+ seconds**
5. **Return to the app tab**
6. Wait for any page visibility logs to complete
7. Click logout
8. **Record exactly where the process stops**

**Expected Outcome**: Logout should hang at some specific step
**Key Logs to Watch**:
- `👁️ PAGE VISIBILITY: Change detected`
- `👁️ PAGE VISIBILITY: Starting getCurrentUserToken() call...`
- `🔍 getCurrentUserToken: DEVELOPMENT - calling supabase.auth.getSession()`
- `🚪 LOGOUT: Starting logout process...`

---

### **Scenario C: Multiple Tab Switches**
**Purpose**: Test if multiple tab switches compound the issue

**Steps**:
1. Sign in
2. Switch tabs back and forth 3-4 times
3. Try logout
4. Record logs

---

### **Scenario D: Page Visibility Hook Disabled**
**Purpose**: Test if page visibility is the root cause

**Steps**:
1. Comment out `const isVisible = usePageVisibility()` in use-simple-auth.ts
2. Sign in
3. Switch tabs and return
4. Try logout
5. Record if logout works

---

## 📊 Log Analysis Points

### **Critical Timing Measurements**:
- `getCurrentUserToken()` duration after tab return
- Time between "Page became visible" and logout click
- Where exactly the logout process stops

### **Key State Checks**:
- localStorage tokens before/after tab switch
- Supabase session state before/after `getSession()`
- Event dispatch success for manual-signout

### **Hypothesis Testing**:

**H1: Session State Corruption**
- Look for: Long `getSession()` duration, different session data before/after
- Evidence: `🔍 getCurrentUserToken: getSession completed in XXXXms`

**H2: Event Listener Issues** 
- Look for: manual-signout event dispatched but not received
- Evidence: `🚪 SIGNOUT: manual-signout event dispatched` without corresponding `useSimpleAuth: Manual signout event detected`

**H3: localStorage Race Condition**
- Look for: Tokens being set/cleared unexpectedly
- Evidence: Different token states in consecutive logs

**H4: Async Timing Issues**
- Look for: Page visibility validation happening during logout
- Evidence: Interleaved logs between visibility and logout processes

## 🚨 Critical Questions to Answer

1. **Does `getCurrentUserToken()` complete after tab switch?**
   - If NO → Session hanging is the issue
   - If YES → Check what it returns and timing

2. **Does the logout process start?**
   - If NO → UI/event handler issue
   - If YES → Check where it stops

3. **Are manual events dispatched and received?**
   - If NO → Event system broken
   - If YES → Check auth state reset

4. **What's the exact timing?**
   - Page visibility validation time
   - Time between tab return and logout click
   - Logout process duration

## 📝 Test Results Template

```
=== SCENARIO X RESULTS ===
Environment: [Development/Production]
Browser: [Chrome/Firefox/etc]
Timestamp: [When test was run]

STEP-BY-STEP LOGS:
[Paste all console logs here with timestamps]

OBSERVATIONS:
- getCurrentUserToken() duration: XXms
- Logout process stopped at: [specific step]
- Manual events: [dispatched/received/failed]

CONCLUSION:
[Which hypothesis this supports/contradicts]
```

## 🔧 Quick Debug Commands

Run these in browser console during testing:

```javascript
// Check current localStorage state
console.log('=== localStorage State ===');
Object.keys(localStorage).forEach(key => {
  if (key.includes('sb-') || key.includes('auth') || key.includes('telegram')) {
    console.log(`${key}: ${localStorage.getItem(key)}`);
  }
});

// Test manual signout event
console.log('=== Testing Manual Signout Event ===');
window.dispatchEvent(new CustomEvent('manual-signout', { detail: { timestamp: Date.now() } }));

// Check if page visibility is working  
console.log('=== Page Visibility State ===');
console.log('document.hidden:', document.hidden);
console.log('document.visibilityState:', document.visibilityState);
```

## 📋 Next Steps After Testing

Based on the test results, we'll know:
1. **Exact failure point** in the logout process
2. **Timing relationships** between page visibility and logout
3. **Session state changes** caused by tab switching
4. **Event flow issues** in the auth system

This will allow us to implement a **targeted fix** instead of guessing! 🎯
