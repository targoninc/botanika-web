export function highlightInElement(element: HTMLElement, searchTerm: string, caseSensitive = false) {
    let count = 0;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(searchTerm), flags);

    // Create a TreeWalker to find all text nodes
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip script and style elements
                const parent = node.parentElement;
                if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;

    // Collect all text nodes first
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    // Process each text node
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const matches = text.match(regex);

        if (matches) {
            count += matches.length;

            // Replace text with highlighted version
            const highlightedHTML = text.replace(regex, '<span class="highlight">$&</span>');

            // Create temporary container and replace the text node
            const temp = document.createElement('div');
            temp.innerHTML = highlightedHTML;

            const parent = textNode.parentNode;
            while (temp.firstChild) {
                parent.insertBefore(temp.firstChild, textNode);
            }
            parent.removeChild(textNode);
        }
    });

    return count;
}


export function clearHighlights() {
    const highlights = document.querySelectorAll('.highlight');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize(); // Merge adjacent text nodes
    });
}

export function escapeRegex(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
