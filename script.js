// ===== API CONFIGURATION =====
const GEMINI_API_KEY = 'AIzaSyCibEkTzzJ_lF3XS6nc64Ch2NHFbbGLbkM';

// DOM Elements
const sourceCodeTextarea = document.getElementById('sourceCode');
const refactorBtn = document.getElementById('refactorBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const demoModeCheckbox = document.getElementById('demoMode');

const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');

const originalCodeDiv = document.getElementById('originalCode');
const refactoredCodeDiv = document.getElementById('refactoredCode');
const explanationDiv = document.getElementById('explanation');

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
clearBtn.addEventListener('click', clearCode);
refactorBtn.addEventListener('click', refactorCode);
copyBtn.addEventListener('click', copyRefactoredCode);

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        sourceCodeTextarea.value = e.target.result;
        fileInput.value = ''; // Reset input
    };
    reader.onerror = () => {
        showError('Error reading file. Please try again.');
    };
    reader.readAsText(file);
}

// Clear code
function clearCode() {
    sourceCodeTextarea.value = '';
    resultsSection.style.display = 'none';
    errorMessage.style.display = 'none';
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingSpinner.style.display = 'none';
    resultsSection.style.display = 'none';
}

// Hide error message
function hideError() {
    errorMessage.style.display = 'none';
}

// Refactor code using Gemini API
async function refactorCode() {
    const sourceCode = sourceCodeTextarea.value.trim();
    const isDemo = demoModeCheckbox.checked;

    // Validation
    if (!sourceCode) {
        showError('Please enter or upload source code to refactor.');
        return;
    }

    if (!GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY') && !isDemo) {
        // API key is configured, proceed
    } else if (!isDemo) {
        showError('Please configure your Gemini API key in the code or enable Demo Mode.');
        return;
    }

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
        showError(`Please wait ${waitTime} second(s) before making another request.`);
        return;
    }

    hideError();
    loadingSpinner.style.display = 'flex';
    resultsSection.style.display = 'none';
    refactorBtn.disabled = true;

    try {
        lastRequestTime = Date.now();
        
        // Update loading message
        const spinnerMessage = loadingSpinner.querySelector('p');
        if (isDemo) {
            spinnerMessage.textContent = 'Refactoring your code (Demo Mode)...';
            // Simulate a small delay for demo mode
            await new Promise(resolve => setTimeout(resolve, 800));
        } else {
            spinnerMessage.textContent = 'Processing your code...';
        }
        
        let refactoredCode;
        if (isDemo) {
            // Use mock refactoring
            refactoredCode = getMockRefactoring(sourceCode);
        } else {
            // Use actual API
            refactoredCode = await callGeminiAPI(sourceCode, GEMINI_API_KEY);
        }
        
        // Parse response (assumes format: "EXPLANATION:\n...\n\nREFACTORED_CODE:\n...")
        const { explanation, code } = parseGeminiResponse(refactoredCode);
        
        // Display results
        displayResults(sourceCode, code, explanation);
        resultsSection.style.display = 'block';
    } catch (error) {
        console.error('Error:', error);
        
        // Handle specific API errors
        let errorMsg = error.message || 'An error occurred while refactoring. Please check your API key and try again.';
        
        if (errorMsg.includes('Quota exceeded') || errorMsg.includes('quota')) {
            errorMsg = `⏱️ API Quota Exceeded: The free tier limit has been reached. Please try Demo Mode (enabled above) or upgrade your plan at https://ai.google.dev/gemini-api/docs/rate-limits`;
        } else if (errorMsg.includes('403') || errorMsg.includes('Invalid API')) {
            errorMsg = '❌ Invalid or Expired API Key: Please check your Gemini API Key at https://aistudio.google.com';
        } else if (errorMsg.includes('429')) {
            errorMsg = '⏱️ Rate Limited: Too many requests. Please wait a moment and try again.';
        }
        
        showError(errorMsg);
    } finally {
        loadingSpinner.style.display = 'none';
        refactorBtn.disabled = false;
    }
}

// Get Mock Refactoring (for demo mode)
function getMockRefactoring(code) {
    // Detect language and apply language-specific refactoring
    let refactoredCode = code;
    let explanation = '';

    // Simple JavaScript/TypeScript refactoring
    if (code.includes('function') || code.includes('const') || code.includes('var')) {
        // Example refactoring: convert var to const, arrow functions, etc.
        refactoredCode = code
            .replace(/var\s+/g, 'const ')
            .replace(/function\s+(\w+)\s*\(/g, 'const $1 = (')
            .replace(/}\s*;/g, '};');
        
        explanation = `EXPLANATION:
• Converted 'var' declarations to 'const' for better scoping and immutability
• Converted named function declarations to arrow function expressions for consistency
• Updated function declarations to use modern JavaScript syntax
• Improved code readability with modern ES6+ conventions
• Better variable scoping prevents global namespace pollution`;
    }
    // Python refactoring
    else if (code.includes('def ') || code.includes('import ')) {
        refactoredCode = code
            .replace(/\s{4,}/g, (match) => '    ')
            .replace(/(\w+)\s*=\s*\[\]/g, '$1: list = []');
        
        explanation = `EXPLANATION:
• Standardized indentation to 4 spaces as per PEP 8
• Added type hints for better code clarity and IDE support
• Improved variable naming for better readability
• Organized imports in alphabetical order
• Added docstrings for functions`;
    }
    // Java/C++ refactoring
    else if (code.includes('public class') || code.includes('class ')) {
        explanation = `EXPLANATION:
• Extracted complex methods into smaller, single-responsibility functions
• Added proper access modifiers (private, public) for encapsulation
• Removed duplicate code and consolidated logic
• Improved naming conventions for better readability
• Added type safety with proper generic types`;
    }
    // Generic refactoring
    else {
        explanation = `EXPLANATION:
• Improved code structure and readability
• Removed unnecessary whitespace and formatting inconsistencies
• Enhanced variable and function naming for clarity
• Consolidated duplicate logic where applicable
• Applied language-specific best practices`;

        // Basic refactoring - remove extra spaces, trim lines
        refactoredCode = code
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    return `${explanation}\n\nREFACTORED_CODE:\n\`\`\`\n${refactoredCode}\n\`\`\``;
}

// Call Gemini API
async function callGeminiAPI(code, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert code refactoring assistant. Please refactor the following code to improve its quality, readability, and efficiency. Provide your response in this exact format:

EXPLANATION:
[Provide a detailed explanation of the refactoring changes you made, separated by bullet points]

REFACTORED_CODE:
[Provide the complete refactored code here]

Source code to refactor:
\`\`\`
${code}
\`\`\``;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: prompt
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || `HTTP Error: ${response.status}`;
            
            // Create a more detailed error message
            let fullError = errorMsg;
            if (response.status === 429) {
                fullError = '429: ' + errorMsg;
            } else if (response.status === 403) {
                fullError = '403: Invalid API Key - ' + errorMsg;
            } else if (response.status === 400) {
                fullError = '400: Bad Request - ' + errorMsg;
            }
            
            throw new Error(fullError);
        }

        const data = await response.json();
        
        // Extract text from response
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts[0]) {
            throw new Error('Invalid response format from Gemini API');
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        // Re-throw with more context
        if (error instanceof TypeError) {
            throw new Error('Network error: Unable to reach the Gemini API. Please check your internet connection.');
        }
        throw error;
    }
}

// Parse Gemini response
function parseGeminiResponse(response) {
    try {
        // Look for EXPLANATION and REFACTORED_CODE sections
        const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)(?=REFACTORED_CODE:|$)/i);
        const codeMatch = response.match(/REFACTORED_CODE:\s*([\s\S]*?)$/i);

        let explanation = explanationMatch ? explanationMatch[1].trim() : 'No explanation provided.';
        let refactoredCode = codeMatch ? codeMatch[1].trim() : response;

        // Clean up markdown code blocks if present
        refactoredCode = refactoredCode.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

        return { explanation, code: refactoredCode };
    } catch (error) {
        console.error('Error parsing response:', error);
        return {
            explanation: 'Could not parse explanation',
            code: response
        };
    }
}

// Display results
function displayResults(originalCode, refactoredCode, explanation) {
    originalCodeDiv.textContent = originalCode;
    refactoredCodeDiv.textContent = refactoredCode;
    explanationDiv.textContent = explanation;
}

// Copy refactored code to clipboard
function copyRefactoredCode() {
    const code = refactoredCodeDiv.textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.backgroundColor = '#10b981';
        copyBtn.style.color = 'white';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = '';
            copyBtn.style.color = '';
        }, 2000);
    }).catch(() => {
        showError('Failed to copy to clipboard');
    });
}

// Prevent form submission on Enter in textarea
sourceCodeTextarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        refactorCode();
    }
});
