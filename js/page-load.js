// Disable transitions on page load to prevent jarring animations
// This runs before the DOM is fully loaded to prevent any transition flashes

document.documentElement.classList.add('no-transition');

window.addEventListener('load', () => {
    // Re-enable transitions after a brief delay
    setTimeout(() => {
        document.documentElement.classList.remove('no-transition');
    }, 100);
});
