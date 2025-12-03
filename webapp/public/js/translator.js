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
if (btn) {
    if (storedLang === "es") {
        btn.innerHTML = `<span>🇺🇸</span> <span>Translate to English</span>`;
    } else {
        btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
    }
}

btn?.addEventListener("click", async function () {
    // Determine target language based on current page language
    const targetLang = pageLang === "en" ? "es" : "en";

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;

    while (node = walker.nextNode()) {
        const trimmed = node.nodeValue.trim();
        if (trimmed.length > 0 && !node.parentNode.closest("script, style")) {
            const parent = node.parentNode;

            // Ensure we always capture the original English text when we first see this node
            if (!parent.dataset.originalText) {
                parent.dataset.originalText = node.nodeValue;
            }

            textNodes.push({ node, text: node.nodeValue });
        }
    }

    const originalTexts = textNodes.map(({ node }) => {
        const parent = node.parentNode;
        const storedOriginal = parent.dataset.originalText;

        // When toggling back to English, some nodes may have been added later and never
        // had an originalText stored. Fall back to the current text so they still translate.
        if (targetLang === "en") {
            return storedOriginal || node.nodeValue;
        }

        // When translating away from English, use the current text (which is the
        // original English for nodes seen for the first time on this pass).
        if (!storedOriginal) {
            parent.dataset.originalText = node.nodeValue;
        }

        return node.nodeValue;
    });

    const res = await fetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            target: targetLang,
            texts: originalTexts
        })
    });

    const data = await res.json();

    data.translations.forEach((t, i) => {
        textNodes[i].node.nodeValue = t;
    });

    // Update current page language
    pageLang = targetLang;
    window.pageLang = pageLang;

    // Save language preference to localStorage
    try {
        sessionStorage.setItem(LANGUAGE_STORAGE_KEY, pageLang);
    } catch (e) {
        console.warn("Could not save language preference to sessionStorage:", e);
    }

    // Update button label for UX with flag emoji
    if (pageLang === "en") {
        btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
    } else {
        btn.innerHTML = `<span>🇺🇸</span> <span>Translate to English</span>`;
    }

    console.log("Page translated to", pageLang);
});

// Function to translate newly added content (exposed globally for other scripts)
window.translateNewContent = async function(element = document.body) {
    // Only translate if current page language is Spanish
    if (pageLang !== "es") {
        return;
    }

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;

    while (node = walker.nextNode()) {
        const trimmed = node.nodeValue.trim();
        if (trimmed.length > 0 && !node.parentNode.closest("script, style")) {
            const parent = node.parentNode;

            // Store original text if not already stored
            // This is the English text that we want to translate
            if (!parent.dataset.originalText) {
                parent.dataset.originalText = node.nodeValue;
            }

            textNodes.push({ node, text: node.nodeValue });
        }
    }

    if (textNodes.length === 0) {
        return;
    }

    const originalTexts = textNodes.map(({ node }) => {
        const parent = node.parentNode;
        const storedOriginal = parent.dataset.originalText;
        
        // Always use the stored original (English) text for translation
        // If no original is stored, store the current text as original and use it
        if (!storedOriginal) {
            parent.dataset.originalText = node.nodeValue;
            return node.nodeValue;
        }
        
        // Use the stored original English text for translation
        return storedOriginal;
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

        const data = await res.json();

        data.translations.forEach((t, i) => {
            textNodes[i].node.nodeValue = t;
        });
    } catch (e) {
        console.warn("Failed to translate new content:", e);
    }
};

// Auto-translate on page load if language preference is Spanish
// The page content is in English, so if stored preference is Spanish, translate it
if (storedLang === "es" && pageLang === "en") {
    // Wait for DOM to be fully loaded before translating
    const performAutoTranslate = () => {
        setTimeout(() => {
            if (btn && pageLang === "en") {
                // Trigger translation to Spanish by clicking the button
                btn.click();
            }
        }, 100); // Small delay to ensure all content is rendered
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', performAutoTranslate);
    } else {
        performAutoTranslate();
    }
}
