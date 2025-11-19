let pageLang = "en"; // actual language of the page
const btn = document.getElementById("translateBtn");

btn?.addEventListener("click", async function () {
    // Determine target language based on current page language
    const targetLang = pageLang === "en" ? "es" : "en";

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;

    while (node = walker.nextNode()) {
        const trimmed = node.nodeValue.trim();
        if (trimmed.length > 0 && !node.parentNode.closest("script, style")) {
            if (!node.parentNode.dataset.originalText) {
                node.parentNode.dataset.originalText = node.nodeValue;
            }
            textNodes.push({ node: node, text: node.nodeValue });
        }
    }

    const originalTexts = textNodes.map(n => {
        return targetLang === "en" ? n.node.parentNode.dataset.originalText : n.node.nodeValue;
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

    // Update button label for UX
    btn.textContent = pageLang === "en" ? "Translate to Spanish" : "Translate to English";

    console.log("Page translated to", pageLang);
});
