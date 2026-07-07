document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================================================
    // REUSABLE CAROUSEL CORE SLIDERS ENGINE (DOTS + MOUSE CLICK-AND-DRAG DETECTOR)
    // ==========================================================================
    function initializeSliderEngine(viewportId, dotsContainerId, cardSelector, gapValue) {
        const viewport = document.getElementById(viewportId);
        const dotsContainer = document.getElementById(dotsContainerId);
        
        if (!viewport || !dotsContainer) return;

        const cards = viewport.querySelectorAll(cardSelector);
        const totalItems = cards.length;
        const gapSpacing = gapValue; 

        // 1. Generate Interactive Nav Dots
        dotsContainer.innerHTML = "";
        for (let i = 0; i < totalItems; i++) {
            const dot = document.createElement("button");
            dot.classList.add("slider-dot");
            if (i === 0) dot.classList.add("active");

            dot.addEventListener("click", () => {
                const cardWidth = cards[0].offsetWidth + gapSpacing;
                viewport.scrollTo({
                    left: i * cardWidth,
                    behavior: "smooth"
                });
            });
            dotsContainer.appendChild(dot);
        }

        // 2. Track Active Dots Highlighting Indicators via Scroll Signals
        viewport.addEventListener("scroll", () => {
            const cardWidth = cards[0].offsetWidth + gapSpacing;
            const activeIndex = Math.round(viewport.scrollLeft / cardWidth);
            
            const dots = dotsContainer.querySelectorAll(".slider-dot");
            dots.forEach((dot, index) => {
                if (index === activeIndex) {
                    dot.classList.add("active");
                } else {
                    dot.classList.remove("active");
                }
            });
        });

        // 3. Mouse Click-And-Drag Tracker Layer
        let isDown = false;
        let startX;
        let scrollLeft;

        viewport.addEventListener("mousedown", (e) => {
            isDown = true;
            viewport.classList.add("grabbing");
            viewport.style.scrollBehavior = "auto"; // Kill smooth behavior during manual pull to prevent drag stutter
            startX = e.pageX - viewport.offsetLeft;
            scrollLeft = viewport.scrollLeft;
        });

        viewport.addEventListener("mouseleave", () => {
            if (!isDown) return;
            isDown = false;
            viewport.style.scrollBehavior = "smooth";
        });

        viewport.addEventListener("mouseup", () => {
            if (!isDown) return;
            isDown = false;
            viewport.style.scrollBehavior = "smooth";
            
            // Snaps fluidly to center the nearest focal card on release
            const cardWidth = cards[0].offsetWidth + gapSpacing;
            const nearestIndex = Math.round(viewport.scrollLeft / cardWidth);
            viewport.scrollTo({
                left: nearestIndex * cardWidth,
                behavior: "smooth"
            });
        });

        viewport.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault(); // Defends against browser native target image asset dragging disruption
            const x = e.pageX - viewport.offsetLeft;
            const walk = (x - startX) * 1.5; // Drag sensitivity velocity factor multiplier
            viewport.scrollLeft = scrollLeft - walk;
        });
    }

    // Initialize both sliders with their respective ID structures and gap configurations
    initializeSliderEngine("foundersViewport", "foundersDots", ".founder-card", 16);
    initializeSliderEngine("logoViewport", "logoDots", ".logo-slide-card", 20);
});

// ==========================================================================
// STORY SHIFTING TAB PANE TRACKER
// ==========================================================================
function switchStoryTab(paneId) {
    const allPanes = document.querySelectorAll('.story-pane');
    allPanes.forEach(pane => pane.classList.remove('active'));

    const allButtons = document.querySelectorAll('.story-tab-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));

    const targetPane = document.getElementById(paneId);
    if (targetPane) targetPane.classList.add('active');

    const activeBtn = Array.from(allButtons).find(btn => btn.getAttribute('onclick')?.includes(paneId));
    if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================================================
// TESTIMONIAL / CAPTION SELECTION SWITCHER
// ==========================================================================
function switchTemplateTab(targetId) {
    const panes = document.querySelectorAll('.template-pane-card');
    panes.forEach(pane => pane.classList.remove('active'));

    const buttons = document.querySelectorAll('.template-nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add('active');

    const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick')?.includes(targetId));
    if (activeBtn) activeBtn.classList.add('active');
}

// ==========================================================================
// CLIPBOARD COPY UTILS SYSTEM
// ==========================================================================
function copyTemplateText(elementId) {
    const textContent = document.getElementById(elementId)?.innerText;
    if (!textContent) return;

    navigator.clipboard.writeText(textContent).then(() => {
        const copyBtn = document.querySelector(`#${elementId}`).parentElement.querySelector('.copy-template-btn');
        if (copyBtn) {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = "✓ Copied!";
            copyBtn.style.background = "#c4df10";
            copyBtn.style.color = "#0d0d11";
            
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.background = "";
                copyBtn.style.color = "";
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy text sequence to user clipboard:', err);
    });
}

document.addEventListener('DOMContentLoaded', () => {
        const toggleButton = document.querySelector('.nav-menu-toggle');
        const navMenu = document.querySelector('.nav-auth-btns');

        toggleButton.addEventListener('click', () => {
            toggleButton.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close the menu automatically if a menu item text button is clicked
        document.querySelectorAll('.nav-link-btn').forEach(link => {
            link.addEventListener('click', () => {
                toggleButton.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
});
