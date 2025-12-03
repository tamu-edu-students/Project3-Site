// Storage key for language preference
const LANGUAGE_STORAGE_KEY = 'vamsa_page_language';

// Expose current page language globally so other scripts (e.g. reports)
// can respect the user's chosen language when inserting dynamic content.
// Page always starts in English (HTML content), so pageLang starts as "en"
window.pageLang = window.pageLang || "en";
let pageLang = window.pageLang; // actual language of the page content
const btn = document.getElementById("translateBtn");

// Load stored language preference
let storedLang = "en";
try {
    storedLang = sessionStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
} catch (e) {
    // sessionStorage not available, use default
}

// Set initial button text with flag based on stored language preference
// Note: pageLang starts as "en" because HTML content is in English
// We'll translate it if storedLang is "es"

if (btn) {
    if (storedLang === "es") {
        btn.innerHTML = `<span>🇺🇸</span> <span>Translate to English</span>`;
    } else {
        btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
    }
}

// Helper function to get all text nodes that should be translated
function getAllTranslatableTextNodes(rootElement = document.body) {
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script and style tags
                if (node.parentNode.closest("script, style")) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip price elements - prices should not be translated
                if (node.parentElement && node.parentElement.classList.contains('price')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Only include nodes with non-empty text
                if (node.nodeValue.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    return textNodes;
}

// Helper function to get all input placeholders that should be translated
function getAllTranslatablePlaceholders(rootElement = document.body) {
    const inputs = rootElement.querySelectorAll('input[placeholder][data-original-placeholder]');
    return Array.from(inputs);
}

// Main translation function
async function translatePage(targetLang) {
    console.log(`translatePage called with targetLang: ${targetLang}, current pageLang: ${pageLang}`);
    
    const textNodes = getAllTranslatableTextNodes();
    console.log(`Found ${textNodes.length} text nodes to translate`);
    
    // Prepare original texts for translation
    const originalTexts = textNodes.map((node) => {
        const parent = node.parentElement;
        
        // Always store the original English text if not already stored
        // When translating to Spanish, store current text as original
        // When translating to English, we need the stored original
        if (!parent.dataset.originalText) {
            // Store current text as original (this is English when first loading)
            parent.dataset.originalText = node.nodeValue;
        }
        
        // If translating back to English, use stored original
        if (targetLang === "en" && parent.dataset.originalText) {
            return parent.dataset.originalText;
        }
        
        // If translating to Spanish, use stored original if available, otherwise current text
        if (targetLang === "es") {
            return parent.dataset.originalText || node.nodeValue;
        }
        
        return node.nodeValue;
    });

    // If translating to English, restore original texts directly
    if (targetLang === "en") {
        console.log("Translating page back to English...");
        textNodes.forEach((node, i) => {
            const parent = node.parentElement;
            if (parent.dataset.originalText) {
                node.nodeValue = parent.dataset.originalText;
            } else {
                // If no original stored, keep current text (shouldn't happen, but safety check)
                console.warn("No original text stored for node:", node.nodeValue.substring(0, 50));
            }
        });
        
        // Restore original placeholders
        const placeholders = getAllTranslatablePlaceholders();
        placeholders.forEach(input => {
            if (input.dataset.originalPlaceholder) {
                input.placeholder = input.dataset.originalPlaceholder;
            }
        });
        
        // Update page language
        pageLang = "en";
        window.pageLang = "en";
        
        // Save preference
        try {
            sessionStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
            console.log("Saved language preference: en");
        } catch (e) {
            console.warn("Could not save language preference:", e);
        }
        
        // Update button
        if (btn) {
            btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
        }
        
        console.log("Page translated to English");
        return;
    }

    // Translate to Spanish using API
    try {
        const res = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target: "es",
                texts: originalTexts
            })
        });

        if (!res.ok) {
            throw new Error(`Translation failed: ${res.status}`);
        }

        const data = await res.json();

        if (!data.translations || data.translations.length !== textNodes.length) {
            throw new Error("Translation response mismatch");
        }

        // Apply translations
        data.translations.forEach((translation, i) => {
            textNodes[i].nodeValue = translation;
        });

        // Translate placeholders
        const placeholders = getAllTranslatablePlaceholders();
        if (placeholders.length > 0) {
            const placeholderTexts = placeholders.map(input => input.dataset.originalPlaceholder || input.placeholder);
            try {
                const placeholderRes = await fetch("/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        target: "es",
                        texts: placeholderTexts
                    })
                });

                if (placeholderRes.ok) {
                    const placeholderData = await placeholderRes.json();
                    if (placeholderData.translations && placeholderData.translations.length === placeholders.length) {
                        placeholders.forEach((input, i) => {
                            input.placeholder = placeholderData.translations[i];
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to translate placeholders:", e);
            }
        }

        // Update page language
        pageLang = "es";
        window.pageLang = "es";
        
        // Save preference
        try {
            sessionStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
            console.log("Saved language preference: es");
        } catch (e) {
            console.warn("Could not save language preference:", e);
        }
        
        // Update button
        if (btn) {
            btn.innerHTML = `<span>🇺🇸</span> <span>Translate to English</span>`;
        }
        
        console.log("Page translated to Spanish successfully");
    } catch (e) {
        console.error("Translation error:", e);
        alert("Translation failed. Please try again.");
    }
}

// Button click handler
btn?.addEventListener("click", async function () {
    // Determine target language based on current page language
    const targetLang = pageLang === "en" ? "es" : "en";
    
    console.log(`Translating page from ${pageLang} to ${targetLang}`);
    await translatePage(targetLang);
    
    // After translation, also translate any dynamically added content
    if (targetLang === "es") {
        setTimeout(() => {
            translateNewContent(document.body);
        }, 500);
        setTimeout(() => {
            translateNewContent(document.body);
        }, 1500);
        setTimeout(() => {
            translateNewContent(document.body);
        }, 2500);
    }
});

// Function to translate newly added content (exposed globally for other scripts)
window.translateNewContent = async function(element = document.body) {
    // Only translate if current page language is Spanish or should be Spanish
    const shouldTranslate = pageLang === "es" || (window.shouldTranslateToSpanish && window.shouldTranslateToSpanish());
    if (!shouldTranslate) {
        return;
    }

    // If element itself has originalText (like weather badge), handle it specially
    if (element.dataset && element.dataset.originalText && element.textContent) {
        const originalText = element.dataset.originalText;
        try {
            const res = await fetch("/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    target: "es",
                    texts: [originalText]
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.translations && data.translations.length > 0) {
                    element.textContent = data.translations[0];
                }
            }
        } catch (e) {
            console.warn("Failed to translate element:", e);
        }
        return;
    }

    const textNodes = getAllTranslatableTextNodes(element);
    
    if (textNodes.length === 0) {
        return;
    }

    const originalTexts = textNodes.map((node) => {
        const parent = node.parentElement;
        
        // Store original text if not already stored
        if (!parent.dataset.originalText) {
            parent.dataset.originalText = node.nodeValue;
        }
        
        // Always use stored original for translation
        return parent.dataset.originalText || node.nodeValue;
    });

    try {
        const res = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target: "es",
                texts: originalTexts
            })
        });

        if (!res.ok) {
            throw new Error(`Translation failed: ${res.status}`);
        }

        const data = await res.json();

        if (data.translations && data.translations.length === textNodes.length) {
            data.translations.forEach((translation, i) => {
                textNodes[i].nodeValue = translation;
            });
        }
    } catch (e) {
        console.warn("Failed to translate new content:", e);
    }
};

// Auto-translate on page load if language preference is Spanish
// The page content is always in English initially, so we need to translate if preference is Spanish
function performAutoTranslate() {
    // Check stored preference
    let currentStoredLang = "en";
    try {
        currentStoredLang = sessionStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
    } catch (e) {
        console.warn("Could not read language preference:", e);
    }
    
    // Only translate if preference is Spanish and page is still in English
    if (currentStoredLang === "es" && pageLang === "en") {
        console.log("Auto-translating page to Spanish (stored preference is Spanish)...");
        translatePage("es").then(() => {
            // Also translate any content that might be added after initial load
            setTimeout(() => {
                if (window.shouldTranslateToSpanish && window.shouldTranslateToSpanish()) {
                    translateNewContent(document.body);
                }
            }, 1000);
            
            // One more pass for very late-loading content
            setTimeout(() => {
                if (window.shouldTranslateToSpanish && window.shouldTranslateToSpanish()) {
                    translateNewContent(document.body);
                }
            }, 2000);
            
            // Final pass for any remaining content
            setTimeout(() => {
                if (window.shouldTranslateToSpanish && window.shouldTranslateToSpanish()) {
                    translateNewContent(document.body);
                }
            }, 3000);
        }).catch(err => {
            console.error("Auto-translate failed:", err);
        });
    } else {
        console.log(`Skipping auto-translate: storedLang=${currentStoredLang}, pageLang=${pageLang}`);
    }
}

// Wait for DOM to be fully loaded and all scripts initialized before translating
if (storedLang === "es") {
    // Wait for all content to load
    const runAutoTranslate = () => {
        setTimeout(performAutoTranslate, 500); // Wait for initial content to render
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAutoTranslate);
    } else {
        runAutoTranslate();
    }
    
    // Also try on window load as a backup
    window.addEventListener('load', () => {
        setTimeout(performAutoTranslate, 100);
    });
}

// Expose a function to check if page should be in Spanish
window.shouldTranslateToSpanish = function() {
    try {
        return sessionStorage.getItem(LANGUAGE_STORAGE_KEY) === 'es';
    } catch (e) {
        return false;
    }
};

// Also expose translatePage globally for manual calls if needed
window.translatePage = translatePage;
