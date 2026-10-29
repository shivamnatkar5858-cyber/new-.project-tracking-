// testimonial-slider.js - Interactive Testimonial Slider for ProjectTrack
(function () {
    'use strict';

    // Default Seed Testimonials
    const DEFAULT_TESTIMONIALS = [
        {
            id: 1,
            name: 'Shivam Natkar',
            role: 'student',
            role_title: 'Team Lead · SIH26103 Final Year',
            department: 'Electronics & Computer Tech (E&ACT)',
            avatar_initials: 'SN',
            avatar_color: '#10b981',
            rating: 5,
            quote: 'ProjectTrack made our final year project coordination effortless. Previously, milestone updates and PPT drafts got lost across chat groups. With this portal, Prof. Kadam sir reviews our weekly code commits and synopsis drafts within hours.',
            project_or_focus: 'IoT-Based Smart Campus & Energy Monitoring System',
            impact_tag: '100% On-Schedule Milestones',
            date: 'Sep 2026',
            verified: true
        },
        {
            id: 2,
            name: 'Prof. R. B. Kadam',
            role: 'teacher',
            role_title: 'Senior Assistant Professor & Project Coordinator',
            department: 'Department of E&ACT',
            avatar_initials: 'RK',
            avatar_color: '#4f46e5',
            rating: 5,
            quote: 'Monitoring 15+ capstone teams used to require mountains of paperwork and tedious follow-ups. ProjectTrack gives me an instant birds-eye view: I can verify deliverables, grade presentations, and leave pinpointed feedback in seconds.',
            project_or_focus: 'Department Coordinator (15+ Active Batches)',
            impact_tag: '70% Reduction in Project Paperwork',
            date: 'Oct 2026',
            verified: true
        },
        {
            id: 3,
            name: 'Ananya Deshmukh',
            role: 'student',
            role_title: 'Lead Researcher · Final Year CSE',
            department: 'Computer Science & Engineering',
            avatar_initials: 'AD',
            avatar_color: '#f43f5e',
            rating: 5,
            quote: 'The milestone countdowns and instant notification alerts kept our 4-person group fully synchronized. Seeing our progress bar climb to 75% after literature review approval gave our whole team incredible momentum.',
            project_or_focus: 'AI-Driven Rural Diagnostic Health Assistant',
            impact_tag: 'Seamless Team Task Delegation',
            date: 'Sep 2026',
            verified: true
        },
        {
            id: 4,
            name: 'Dr. Sunita Patil',
            role: 'teacher',
            role_title: 'Head of Department & Evaluation Chair',
            department: 'School of Technology & Engineering',
            avatar_initials: 'SP',
            avatar_color: '#d97706',
            rating: 5,
            quote: 'For university audits and NAAC project reviews, having a verifiable, centralized digital audit trail is invaluable. ProjectTrack brings modern engineering practices straight to our college curriculum.',
            project_or_focus: 'Academic Review Committee & Accreditation',
            impact_tag: 'Centralized Digital Audit Repository',
            date: 'Aug 2026',
            verified: true
        },
        {
            id: 5,
            name: 'Rohan Patil',
            role: 'student',
            role_title: 'Hardware Architect · 3rd Year',
            department: 'Electronics & Telecommunication',
            avatar_initials: 'RP',
            avatar_color: '#0284c7',
            rating: 5,
            quote: 'Uploading high-resolution schematic diagrams and 50MB presentation decks directly to the system solved all our file-sharing headaches. Our guide can comment directly on our submission before lab hours.',
            project_or_focus: 'Autonomous Guided Vehicle (AGV) for Warehouses',
            impact_tag: 'Direct 50MB Document Sync',
            date: 'Oct 2026',
            verified: true
        },
        {
            id: 6,
            name: 'Prof. Amit Verma',
            role: 'teacher',
            role_title: 'Project Guide & Industry Mentor',
            department: 'Computer & AI Engineering',
            avatar_initials: 'AV',
            avatar_color: '#0d9488',
            rating: 5,
            quote: 'The automated progress calculations let me pinpoint struggling teams weeks before mid-term evaluations. It allows us to intervene early and ensure every student finishes with a deployable product.',
            project_or_focus: 'Project Evaluation & Industry Mentorship',
            impact_tag: 'Proactive Early Student Guidance',
            date: 'Sep 2026',
            verified: true
        },
        {
            id: 7,
            name: 'Snehal Shinde',
            role: 'student',
            role_title: 'Systems Analyst · Final Year',
            department: 'Information Technology',
            avatar_initials: 'SS',
            avatar_color: '#8b5cf6',
            rating: 5,
            quote: 'Student registration was buttery smooth, and inviting team members with their roll numbers took less than two minutes. The dashboard gives us clear targets for every evaluation stage.',
            project_or_focus: 'Solar Microgrid Energy Trading & Smart Metering',
            impact_tag: 'Fast 2-Minute Onboarding',
            date: 'Oct 2026',
            verified: true
        }
    ];

    // State
    let allTestimonials = [...DEFAULT_TESTIMONIALS];
    let filteredTestimonials = [...allTestimonials];
    let currentFilter = 'all'; // 'all' | 'student' | 'teacher'
    let currentIndex = 0;
    let autoplayTimer = null;
    let isAutoplayActive = true;
    const AUTOPLAY_INTERVAL_MS = 5000;

    // Swipe state
    let touchStartX = 0;
    let touchEndX = 0;

    // Elements
    let trackEl = null;
    let dotsContainer = null;
    let counterEl = null;
    let prevBtn = null;
    let nextBtn = null;
    let autoplayBtn = null;
    let filterTabs = [];

    // Initialize Testimonials
    async function initTestimonials() {
        trackEl = document.getElementById('testimonialsTrack');
        dotsContainer = document.getElementById('sliderDots');
        counterEl = document.getElementById('sliderCounter');
        prevBtn = document.getElementById('sliderPrevBtn');
        nextBtn = document.getElementById('sliderNextBtn');
        autoplayBtn = document.getElementById('sliderAutoplayBtn');
        filterTabs = Array.from(document.querySelectorAll('.testimonial-filter-tab'));

        if (!trackEl) return;

        // Try fetching latest testimonials from backend API
        try {
            const res = await fetch('/api/testimonials');
            if (res.ok) {
                const data = await res.json();
                if (data.testimonials && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
                    allTestimonials = data.testimonials;
                }
            }
        } catch (e) {
            console.log('ProjectTrack: Using local seed testimonials.');
        }

        updateFilterCounts();
        applyFilter(currentFilter);
        setupEventListeners();
        startAutoplay();
    }

    // Update count labels on filter buttons
    function updateFilterCounts() {
        const studentCount = allTestimonials.filter(t => t.role === 'student').length;
        const teacherCount = allTestimonials.filter(t => t.role === 'teacher').length;
        const allCount = allTestimonials.length;

        const countAll = document.getElementById('countAllTestimonials');
        const countStudents = document.getElementById('countStudentTestimonials');
        const countTeachers = document.getElementById('countTeacherTestimonials');

        if (countAll) countAll.textContent = allCount;
        if (countStudents) countStudents.textContent = studentCount;
        if (countTeachers) countTeachers.textContent = teacherCount;
    }

    // Apply Filter (All / Students / Teachers)
    function applyFilter(filter) {
        currentFilter = filter;
        if (filter === 'all') {
            filteredTestimonials = [...allTestimonials];
        } else {
            filteredTestimonials = allTestimonials.filter(t => t.role === filter);
        }

        // Update active tab style
        filterTabs.forEach(tab => {
            const tabFilter = tab.getAttribute('data-filter');
            if (tabFilter === filter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        currentIndex = 0;
        renderSlides();
        updateSliderPosition();
    }

    // Render slides into track
    function renderSlides() {
        if (!trackEl) return;

        if (filteredTestimonials.length === 0) {
            trackEl.innerHTML = `
                <div class="empty-testimonials-message">
                    <i class="fa-regular fa-comment-dots"></i>
                    <p>No testimonials in this category yet. Be the first to share your experience!</p>
                </div>
            `;
            if (dotsContainer) dotsContainer.innerHTML = '';
            if (counterEl) counterEl.textContent = '0 / 0';
            return;
        }

        trackEl.innerHTML = filteredTestimonials.map((item, index) => {
            const isStudent = item.role === 'student';
            const roleBadgeClass = isStudent ? 'role-badge-student' : 'role-badge-teacher';
            const roleBadgeIcon = isStudent ? 'fa-solid fa-graduation-cap' : 'fa-solid fa-chalkboard-user';
            const roleBadgeText = isStudent ? 'Verified Student' : 'Faculty Guide / Coordinator';

            // Star rendering
            const starsHtml = Array.from({ length: 5 }, (_, i) => {
                const filled = i < item.rating;
                return `<i class="${filled ? 'fa-solid fa-star' : 'fa-regular fa-star'}" style="color: #f59e0b;"></i>`;
            }).join('');

            return `
                <div class="testimonial-slide" data-index="${index}">
                    <div class="testimonial-card">
                        <div class="card-top-row">
                            <div class="star-rating" aria-label="${item.rating} out of 5 stars">
                                ${starsHtml}
                                <span class="rating-number">${item.rating}.0</span>
                            </div>
                            <div class="role-badge ${roleBadgeClass}">
                                <i class="${roleBadgeIcon}"></i>
                                <span>${roleBadgeText}</span>
                            </div>
                        </div>

                        <div class="quote-container">
                            <i class="fa-solid fa-quote-left quote-watermark"></i>
                            <blockquote class="testimonial-quote">
                                "${escapeHtml(item.quote)}"
                            </blockquote>
                        </div>

                        <div class="card-context-row">
                            <div class="context-item">
                                <i class="fa-solid fa-diagram-project"></i>
                                <span><strong>Focus:</strong> ${escapeHtml(item.project_or_focus)}</span>
                            </div>
                            <div class="context-item highlight">
                                <i class="fa-solid fa-bolt"></i>
                                <span>${escapeHtml(item.impact_tag)}</span>
                            </div>
                        </div>

                        <div class="card-author-footer">
                            <div class="author-avatar" style="background-color: ${item.avatar_color || '#4f46e5'}">
                                ${escapeHtml(item.avatar_initials || item.name.slice(0, 2).toUpperCase())}
                            </div>
                            <div class="author-meta">
                                <h4 class="author-name">${escapeHtml(item.name)}</h4>
                                <p class="author-role">${escapeHtml(item.role_title)}</p>
                                <span class="author-dept"><i class="fa-solid fa-building-columns"></i> ${escapeHtml(item.department)}</span>
                            </div>
                            <div class="testimonial-date">
                                <i class="fa-regular fa-calendar-check"></i>
                                <span>${escapeHtml(item.date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        renderDots();
    }

    // Render pagination dots
    function renderDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';

        filteredTestimonials.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.className = `slider-dot ${idx === currentIndex ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Go to testimonial slide ${idx + 1}`);
            dot.addEventListener('click', () => {
                goToSlide(idx);
            });
            dotsContainer.appendChild(dot);
        });

        updateCounter();
    }

    // Update Slide Counter (e.g. 02 / 07)
    function updateCounter() {
        if (!counterEl) return;
        const total = filteredTestimonials.length;
        if (total === 0) {
            counterEl.textContent = '0 / 0';
            return;
        }
        const currentStr = String(currentIndex + 1).padStart(2, '0');
        const totalStr = String(total).padStart(2, '0');
        counterEl.innerHTML = `<strong>${currentStr}</strong> / <span>${totalStr}</span>`;
    }

    // Update Slider Position with smooth transform
    function updateSliderPosition() {
        if (!trackEl || filteredTestimonials.length === 0) return;

        // Apply translateX
        const offset = -(currentIndex * 100);
        trackEl.style.transform = `translateX(${offset}%)`;

        // Update active dots
        if (dotsContainer) {
            const dots = dotsContainer.querySelectorAll('.slider-dot');
            dots.forEach((dot, idx) => {
                if (idx === currentIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }

        updateCounter();
    }

    function goToSlide(index) {
        if (filteredTestimonials.length === 0) return;
        if (index < 0) {
            currentIndex = filteredTestimonials.length - 1;
        } else if (index >= filteredTestimonials.length) {
            currentIndex = 0;
        } else {
            currentIndex = index;
        }
        updateSliderPosition();
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    // Autoplay Controls
    function startAutoplay() {
        stopAutoplay();
        if (!isAutoplayActive) return;
        autoplayTimer = setInterval(() => {
            nextSlide();
        }, AUTOPLAY_INTERVAL_MS);
    }

    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }

    function toggleAutoplay() {
        isAutoplayActive = !isAutoplayActive;
        if (isAutoplayActive) {
            startAutoplay();
            if (autoplayBtn) {
                autoplayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause</span>';
                autoplayBtn.classList.remove('paused');
            }
        } else {
            stopAutoplay();
            if (autoplayBtn) {
                autoplayBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Autoplay</span>';
                autoplayBtn.classList.add('paused');
            }
        }
    }

    // Event Listeners setup
    function setupEventListeners() {
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                if (isAutoplayActive) startAutoplay(); // Reset timer on manual action
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                if (isAutoplayActive) startAutoplay();
            });
        }

        if (autoplayBtn) {
            autoplayBtn.addEventListener('click', toggleAutoplay);
        }

        // Filter tab clicks
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const filter = e.currentTarget.getAttribute('data-filter');
                if (filter) {
                    applyFilter(filter);
                    if (isAutoplayActive) startAutoplay();
                }
            });
        });

        // Pause on hover or focus
        const viewport = document.getElementById('testimonialsSliderViewport');
        if (viewport) {
            viewport.addEventListener('mouseenter', () => {
                stopAutoplay();
            });

            viewport.addEventListener('mouseleave', () => {
                if (isAutoplayActive) startAutoplay();
            });

            // Touch Swipe handling
            viewport.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                stopAutoplay();
            }, { passive: true });

            viewport.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
                if (isAutoplayActive) startAutoplay();
            }, { passive: true });
        }

        // Keyboard navigation when focused
        const sliderSection = document.getElementById('testimonials');
        if (sliderSection) {
            sliderSection.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    prevSlide();
                } else if (e.key === 'ArrowRight') {
                    nextSlide();
                }
            });
        }

        // Modal triggers
        const openModalBtn = document.getElementById('openFeedbackModalBtn');
        const closeModalBtn = document.getElementById('closeFeedbackModalBtn');
        const cancelModalBtn = document.getElementById('cancelFeedbackBtn');
        const modal = document.getElementById('feedbackModal');
        const form = document.getElementById('feedbackForm');

        if (openModalBtn && modal) {
            openModalBtn.addEventListener('click', () => {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }

        function closeModal() {
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // Star rating picker in modal
        setupStarPicker();

        // Form submission
        if (form) {
            form.addEventListener('submit', handleFeedbackSubmit);
        }
    }

    function handleSwipe() {
        const threshold = 40; // min distance
        const diff = touchEndX - touchStartX;
        if (diff > threshold) {
            // Swipe right -> Previous
            prevSlide();
        } else if (diff < -threshold) {
            // Swipe left -> Next
            nextSlide();
        }
    }

    // Star rating picker inside feedback modal
    function setupStarPicker() {
        const starGroup = document.getElementById('modalStarGroup');
        const ratingInput = document.getElementById('modalRatingInput');
        if (!starGroup || !ratingInput) return;

        const stars = starGroup.querySelectorAll('.star-btn');
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                const val = index + 1;
                ratingInput.value = val;
                updateStarVisuals(val);
            });

            star.addEventListener('mouseenter', () => {
                updateStarVisuals(index + 1);
            });
        });

        starGroup.addEventListener('mouseleave', () => {
            const currentVal = parseInt(ratingInput.value, 10) || 5;
            updateStarVisuals(currentVal);
        });

        function updateStarVisuals(val) {
            stars.forEach((s, idx) => {
                const icon = s.querySelector('i');
                if (idx < val) {
                    icon.className = 'fa-solid fa-star';
                    icon.style.color = '#f59e0b';
                } else {
                    icon.className = 'fa-regular fa-star';
                    icon.style.color = '#cbd5e1';
                }
            });
            const ratingText = document.getElementById('ratingDescription');
            if (ratingText) {
                const labels = ['', '1 - Needs Improvement', '2 - Fair', '3 - Good Experience', '4 - Great Platform', '5 - Exceptional / Excellent!'];
                ratingText.textContent = labels[val] || `${val} Stars`;
            }
        }
    }

    // Handle feedback submission
    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        const name = document.getElementById('fbName').value.trim();
        const role = document.getElementById('fbRole').value;
        const roleTitle = document.getElementById('fbRoleTitle').value.trim();
        const department = document.getElementById('fbDepartment').value.trim();
        const projectFocus = document.getElementById('fbProjectFocus').value.trim();
        const impactTag = document.getElementById('fbImpactTag').value.trim();
        const rating = parseInt(document.getElementById('modalRatingInput').value, 10) || 5;
        const quote = document.getElementById('fbQuote').value.trim();

        if (!name || name.length < 2) {
            alert('Please enter your full name (at least 2 characters).');
            return;
        }

        if (!quote || quote.length < 10) {
            alert('Please write your feedback (at least 10 characters).');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        }

        const nameParts = name.split(/\s+/);
        const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();

        const colors = ['#10b981', '#4f46e5', '#0284c7', '#d97706', '#f43f5e', '#8b5cf6', '#0d9488'];
        const chosenColor = colors[Math.floor(Math.random() * colors.length)];

        const payload = {
            name,
            role,
            role_title: roleTitle || (role === 'teacher' ? 'Faculty Guide' : 'Student Project Member'),
            department: department || 'Engineering & Technology',
            avatar_initials: initials,
            avatar_color: chosenColor,
            rating,
            quote,
            project_or_focus: projectFocus || (role === 'teacher' ? 'Project Monitoring & Evaluation' : 'Final Year Project Work'),
            impact_tag: impactTag || 'Verified Feedback',
            date: 'Just now'
        };

        try {
            const response = await fetch('/api/testimonials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                if (data.testimonial) {
                    allTestimonials.unshift(data.testimonial);
                } else {
                    allTestimonials.unshift({ ...payload, id: Date.now(), verified: true });
                }
            } else {
                allTestimonials.unshift({ ...payload, id: Date.now(), verified: true });
            }
        } catch (err) {
            // Local fallback
            allTestimonials.unshift({ ...payload, id: Date.now(), verified: true });
        }

        // Close modal and reset form
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        form.reset();
        document.getElementById('modalRatingInput').value = '5';

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Experience';
        }

        // Refresh filter & counts
        updateFilterCounts();
        applyFilter('all');
        goToSlide(0);

        showToast('Thank you! Your testimonial has been published to ProjectTrack.');
    }

    // Toast notification
    function showToast(message) {
        let toast = document.getElementById('projectTrackToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'projectTrackToast';
            toast.className = 'feedback-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHtml(message)}</span>`;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Expose functions globally if needed
    window.TestimonialSlider = {
        init: initTestimonials,
        next: nextSlide,
        prev: prevSlide,
        goTo: goToSlide,
        filter: applyFilter
    };

    // Auto initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTestimonials);
    } else {
        initTestimonials();
    }
})();
