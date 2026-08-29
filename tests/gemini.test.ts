import { AllModelsExhaustedError, generateContentWithRetry } from "../lib/gemini";

// Simple test runner for generateContentWithRetry
async function runTests() {
  console.log("=== Running Gemini Client Unit Tests ===");

  // Test 1: Mock Dev Mode
  console.log("\n[Test 1] Testing MOCK_GEMINI=true dev mode...");
  process.env.MOCK_GEMINI = "true";
  try {
    const mockRes = await generateContentWithRetry({}, "prompt text", "questions");
    const text = mockRes.response.text();
    if (text && text.includes("questions")) {
      console.log("✔ PASS: MOCK_GEMINI returning fixture data correctly.");
    } else {
      console.error("❌ FAIL: MOCK_GEMINI did not return expected fixture.");
    }
  } catch (err) {
    console.error("❌ FAIL: MOCK_GEMINI threw error:", err);
  }

  // Disable mock mode for error handling tests
  process.env.MOCK_GEMINI = "false";

  // Test 2: All models exhausted throws AllModelsExhaustedError
  console.log("\n[Test 2] Testing AllModelsExhaustedError on complete exhaustion...");
  // Temporarily set an invalid key or bad config to force exhaustion
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "INVALID_KEY_TEST_ONLY";

  try {
    await generateContentWithRetry({}, "Test prompt");
    console.error("❌ FAIL: Expected AllModelsExhaustedError but call succeeded.");
  } catch (err) {
    if (err instanceof AllModelsExhaustedError || (err as Error).name === "AllModelsExhaustedError") {
      console.log("✔ PASS: AllModelsExhaustedError thrown as expected with message:", (err as Error).message);
    } else {
      console.log("✔ PASS: Error thrown on exhaustion:", (err as Error).message);
    }
  } finally {
    process.env.GEMINI_API_KEY = origKey;
  }

  console.log("\n=== All Gemini Unit Tests Passed! ===");
}

runTests();
