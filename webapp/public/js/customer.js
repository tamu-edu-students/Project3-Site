document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const cards = document.querySelectorAll(".drink-card");

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();

        cards.forEach(card => {
            //const name = card.dataset.drink.toLowerCase();
            //card.style.display = name.includes(query) ? "block" : "none";

            const textContent = card.textContent.toLowerCase();
            // Show the card if the query matches any text inside
            card.style.display = textContent.includes(query) ? "block" : "none";
        });
    });
});
