let players = [];

function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API Ready');
}

function extractVideoId(url) {
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : false;
}

// Handle Dropdown Change
document.getElementById('linkCount').addEventListener('change', function () {
    const count = this.value;
    const container = document.getElementById('urlInputsContainer');
    container.innerHTML = ''; // Clear existing

    for (let i = 1; i <= count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'video-url-input';
        input.placeholder = `Paste YouTube link ${i}...`;
        input.autocomplete = 'off';
        container.appendChild(input);
    }
});

function loadVideo() {
    // Get all URL inputs
    const urlInputs = document.querySelectorAll('.video-url-input');
    const validVideoIds = [];

    urlInputs.forEach(input => {
        const id = extractVideoId(input.value);
        if (id) validVideoIds.push(id);
    });

    if (validVideoIds.length === 0) {
        alert("Please enter at least one valid YouTube URL");
        return;
    }

    const countInput = document.getElementById('videoCount');
    const countPerLink = parseInt(countInput.value) || 1; // Now this is PER link

    // Calculate Global Total
    const totalVideos = countPerLink * validVideoIds.length;

    // Limit count to reasonable number to prevent browser crash
    if (totalVideos > 200) {
        alert(`Too many videos! ${countPerLink} screens x ${validVideoIds.length} links = ${totalVideos}. Max limit is 200 total.`);
        return;
    }

    // Performance: Explicitly destroy old players to free memory
    if (players && players.length > 0) {
        players.forEach(p => {
            if (p && typeof p.destroy === 'function') {
                p.destroy();
            }
        });
    }

    const container = document.getElementById('playersContainer');
    // Clear previous players and placeholders
    container.innerHTML = '';

    // Performance: Switch to Lite Mode if total is high (> 20)
    const isLiteMode = totalVideos > 20;

    players = [];

    // Distribution Logic: Each link gets 'countPerLink' videos
    // No remainder/division needed anymore.

    // Staggered loading state
    let linkIndex = 0;
    let videosInCurrentLink = 0;
    let totalCreated = 0;

    // Create Sections First
    const sectionGrids = [];
    validVideoIds.forEach((id, index) => {
        const section = document.createElement('div');
        section.className = 'video-section';

        // Count for this specific section is simply what the user entered
        const sectionCount = countPerLink;

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `<span class="section-badge">Link ${index + 1}</span> <span>${sectionCount} Screens</span>`;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'players-grid';
        if (isLiteMode) grid.classList.add('lite-mode');
        // Store max count for this grid to know when to stop
        grid.dataset.max = sectionCount;
        grid.dataset.current = 0;

        section.appendChild(grid);
        container.appendChild(section);
        sectionGrids.push({ grid: grid, videoId: id, max: sectionCount });
    });

    // Staggered loading: Fill sections one by one
    let currentSectionIndex = 0;

    function createNextPlayer() {
        if (currentSectionIndex >= sectionGrids.length) return;

        const currentSection = sectionGrids[currentSectionIndex];
        const currentGrid = currentSection.grid;
        const currentCount = parseInt(currentGrid.dataset.current);
        const maxCount = currentSection.max;

        if (currentCount >= maxCount) {
            // Move to next section
            currentSectionIndex++;
            setTimeout(createNextPlayer, 0); // Immediate jump to next section
            return;
        }

        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'player-wrapper';

        // Create player div
        const playerDiv = document.createElement('div');
        const playerId = `player-${currentSectionIndex}-${currentCount}`;
        playerDiv.id = playerId;

        wrapper.appendChild(playerDiv);

        // Mute Button Overlay
        const muteBtn = document.createElement('button');
        muteBtn.className = 'mute-btn';
        muteBtn.innerHTML = '🔇'; // Default muted
        muteBtn.title = "Unmute";

        wrapper.appendChild(muteBtn);
        currentGrid.appendChild(wrapper);

        // Initialize Player
        const player = new YT.Player(playerId, {
            height: '100%',
            width: '100%',
            videoId: currentSection.videoId,
            playerVars: {
                'playsinline': 1,
                'autoplay': 1,
                'controls': 0, // Hide controls
                'rel': 0,
                'mute': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });

        // Add Click Listener
        muteBtn.addEventListener('click', () => {
            if (player.isMuted()) {
                player.unMute();
                muteBtn.innerHTML = '🔊';
                muteBtn.title = "Mute";
            } else {
                player.mute();
                muteBtn.innerHTML = '🔇';
                muteBtn.title = "Unmute";
            }
        });

        players.push(player);

        // Update count
        currentGrid.dataset.current = currentCount + 1;

        // Schedule next creation
        setTimeout(createNextPlayer, 200); // 200ms delay between each player
    }

    createNextPlayer();
}

function onPlayerReady(event) {
    event.target.mute();
    event.target.setPlaybackQuality('tiny'); // Force low quality
    event.target.playVideo();
}

function onPlayerStateChange(event) {
    // YT.PlayerState.ENDED = 0
    // YT.PlayerState.PAUSED = 2

    if (event.data === YT.PlayerState.ENDED) {
        event.target.playVideo(); // Auto Loop
    }

    if (event.data === YT.PlayerState.PAUSED) {
        // Force resume if it pauses (since we hid controls, this is likely automated stops)
        event.target.playVideo();
    }

    if (event.data === YT.PlayerState.PLAYING) {
        // Aggressively force lowest quality whenever it starts playing
        event.target.setPlaybackQuality('tiny');
    }
}

// Global Quality Enforcer
// Continuously ensures all players stay at 144p to save bandwidth/CPU
setInterval(() => {
    if (players.length > 0) {
        players.forEach(player => {
            if (player && typeof player.setPlaybackQuality === 'function') {
                player.setPlaybackQuality('tiny');
            }
        });
    }
}, 4000);

document.getElementById('playBtn').addEventListener('click', loadVideo);

document.getElementById('videoUrl').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        loadVideo();
    }
});
document.getElementById('videoCount').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        loadVideo();
    }
});
