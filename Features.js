document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       1. MOBILE NAVIGATION TOGGLE ENGINE
       ========================================================================== */
    const menuToggleBtn = document.querySelector('.nav-menu-toggle');
    const navigationMenuTray = document.querySelector('.nav-auth-btns');

    if (menuToggleBtn && navigationMenuTray) {
        menuToggleBtn.addEventListener('click', () => {
            const isExpanded = menuToggleBtn.getAttribute('aria-expanded') === 'true';
            
            menuToggleBtn.setAttribute('aria-expanded', !isExpanded);
            menuToggleBtn.classList.toggle('active');
            navigationMenuTray.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link-btn').forEach(linkItem => {
            linkItem.addEventListener('click', () => {
                menuToggleBtn.setAttribute('aria-expanded', 'false');
                menuToggleBtn.classList.remove('active');
                navigationMenuTray.classList.remove('active');
            });
        });
    }

    /* ==========================================================================
       2. SMOOTH SLIDER, DOT TRACKING & DRAG-TO-SCROLL ENGINE
       ========================================================================== */
    const teamGrid = document.querySelector('.team-scroll-grid');
    
    if (teamGrid) {
        let isProgrammaticScroll = false;
        let scrollTimeout = null;

        // --- Drag Engine Variables ---
        let isDown = false;
        let startX;
        let scrollLeft;
        let isDragging = false; 

        // Expose scrollToTeamCard to the window scope
        window.scrollToTeamCard = function(index) {
            const cards = document.querySelectorAll('.team-scroll-grid .team-card');
            const dots = document.querySelectorAll('.team-dots-indicator .dot');
            
            if (cards[index]) {
                isProgrammaticScroll = true;
                
                dots.forEach((dot, idx) => {
                    dot.classList.toggle('active', idx === index);
                });

                const gridPaddingLeft = parseInt(window.getComputedStyle(teamGrid).paddingLeft) || 0;
                const targetScrollPosition = cards[index].offsetLeft - teamGrid.offsetLeft - gridPaddingLeft;
                
                teamGrid.scrollTo({
                    left: targetScrollPosition,
                    behavior: 'smooth'
                });
            }
        };

        // Track swipe gestures, wheels, or dragging to sync active dot highlights
        teamGrid.addEventListener('scroll', function() {
            clearTimeout(scrollTimeout);

            if (isProgrammaticScroll) {
                scrollTimeout = setTimeout(() => {
                    isProgrammaticScroll = false;
                }, 100); 
                return;
            }

            const cards = document.querySelectorAll('.team-scroll-grid .team-card');
            const dots = document.querySelectorAll('.team-dots-indicator .dot');
            
            let currentActiveIndex = 0;
            let minClosestDistance = Infinity;
            
            cards.forEach((card, i) => {
                const cardCenterPosition = card.offsetLeft + (card.offsetWidth / 2);
                const gridScrollCenterPosition = teamGrid.scrollLeft + (teamGrid.offsetWidth / 2);
                const relativeDistanceOffset = Math.abs(cardCenterPosition - gridScrollCenterPosition);
                
                if (relativeDistanceOffset < minClosestDistance) {
                    minClosestDistance = relativeDistanceOffset;
                    currentActiveIndex = i;
                }
            });
            
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === currentActiveIndex);
            });
        });

        /* --- 🌟 DESKTOP CLICK & HOLD DRAG LOGIC --- */
        
        // Prevent default ghost image trailing when dragging profile pictures
        teamGrid.querySelectorAll('img').forEach(img => {
            img.addEventListener('dragstart', (e) => e.preventDefault());
        });

        teamGrid.addEventListener('mousedown', (e) => {
            isDown = true;
            isDragging = false;
            teamGrid.style.cursor = 'grabbing';
            teamGrid.style.scrollSnapType = 'none'; // Temporarily disable snap physics so dragging is fluid
            startX = e.pageX - teamGrid.offsetLeft;
            scrollLeft = teamGrid.scrollLeft;
        });

        teamGrid.addEventListener('mouseleave', () => {
            if (!isDown) return;
            isDown = false;
            teamGrid.style.cursor = 'grab';
            teamGrid.style.scrollSnapType = 'x mandatory'; // Re-enable snappy behavior
        });

        teamGrid.addEventListener('mouseup', (e) => {
            isDown = false;
            teamGrid.style.cursor = 'grab';
            teamGrid.style.scrollSnapType = 'x mandatory'; // Re-enable snappy behavior
            
            // If the user actually moved their mouse, prevent accidental child card link clicks
            if (isDragging) {
                const preventClick = (e) => {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    teamGrid.removeEventListener('click', preventClick, true);
                };
                teamGrid.addEventListener('click', preventClick, true);
            }
        });

        teamGrid.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            
            const x = e.pageX - teamGrid.offsetLeft;
            const walk = (x - startX) * 1.5; // Drag speed multiplier configuration
            
            // Verify actual movement before setting drag lockouts
            if (Math.abs(walk) > 5) {
                isDragging = true;
                e.preventDefault(); 
                teamGrid.scrollLeft = scrollLeft - walk;
            }
        });
        
        // Set fallback base grab indicator cursor
        teamGrid.style.cursor = 'grab';
    }
});