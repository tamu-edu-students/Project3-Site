document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const cards = document.querySelectorAll(".drink-card");

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();

        cards.forEach(card => {
            const name = card.dataset.drink.toLowerCase();
            card.style.display = name.includes(query) ? "block" : "none";
        });
    });
});
