// Expose current page language globally so other scripts (e.g. reports)
// can respect the user's chosen language when inserting dynamic content.
window.pageLang = window.pageLang || "en";
let pageLang = window.pageLang; // actual language of the page
const btn = document.getElementById("translateBtn");

// Set initial button text with flag
if (btn) {
    btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
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

    // Update button label for UX with flag emoji
    if (pageLang === "en") {
        btn.innerHTML = `<span>🇪🇸</span> <span>Translate to Spanish</span>`;
    } else {
        btn.innerHTML = `<span>🇺🇸</span> <span>Translate to English</span>`;
    }

    console.log("Page translated to", pageLang);
});

