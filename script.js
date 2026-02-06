let players = [];
let isBackgroundModeActive = false;
let silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//oeAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA//oeAAABAAAAJP8AAAAA//////////////8xwABhAAABiAAAAAAACcAAABH/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////7+AAAAAA=");
silentAudio.loop = true;

function toggleBackgroundMode() {
    isBackgroundModeActive = !isBackgroundModeActive;
    const btn = document.getElementById('bgModeBtn');
    const status = document.getElementById('bgStatus');

    if (isBackgroundModeActive) {
        btn.classList.add('active');
        btn.innerHTML = "Disable Background Mode";
        status.style.display = "inline";

        // Play silent audio to keep session alive
        silentAudio.play().catch(e => console.error("Audio play failed:", e));

        // Setup Media Session
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'MultiTabz Active',
                artist: 'Background Mode On',
                album: 'MultiTabz Player',
                artwork: [
                    { src: 'favicon.png', sizes: '96x96', type: 'image/png' },
                    { src: 'logo.png', sizes: '192x192', type: 'image/png' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', function () {
                silentAudio.play();
            });
            navigator.mediaSession.setActionHandler('pause', function () {
                // Do nothing or re-play to prevent pausing
                silentAudio.play();
            });
        }

    } else {
        btn.classList.remove('active');
        btn.innerHTML = "Enable Background Mode";
        status.style.display = "none";
        silentAudio.pause();
    }
}

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
    if (totalVideos > 1000) {
        alert(`Too many videos! ${countPerLink} screens x ${validVideoIds.length} links = ${totalVideos}. Max limit is 1000 total.`);
        return;
    }

    // Performance: Explicitly destroy old players to free memory
    if (players && players.length > 0) {
        players.forEach(p => {
            try {
                if (p && typeof p.destroy === 'function') {
                    p.destroy();
                }
            } catch (e) { console.warn("Player destroy error", e); }
        });
    }

    const container = document.getElementById('playersContainer');
    // Clear previous players and placeholders
    container.innerHTML = '';

    // Performance: Switch to Lite Mode if total is high (> 20)
    const isLiteMode = totalVideos > 10;

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

    // Batch Loader Logic
    function createNextBatch() {
        if (currentSectionIndex >= sectionGrids.length) return;

        // BATCH SIZE: Create this many players per frame. 
        // 8 is a good balance between speed and UI responsiveness.
        const BATCH_SIZE = 8;

        for (let i = 0; i < BATCH_SIZE; i++) {
            // Check if we finished all sections
            if (currentSectionIndex >= sectionGrids.length) return;

            const currentSection = sectionGrids[currentSectionIndex];
            const currentGrid = currentSection.grid;
            const currentCount = parseInt(currentGrid.dataset.current);
            const maxCount = currentSection.max;

            if (currentCount >= maxCount) {
                currentSectionIndex++;
                // Decrement i so we don't skip a slot in this batch for the next section
                i--;
                continue;
            }

            // Create individual player
            createSinglePlayer(currentSection, currentGrid, currentSectionIndex, currentCount);

            // Update the grid counter manually here
            currentGrid.dataset.current = currentCount + 1;
        }

        // Schedule next batch
        requestAnimationFrame(createNextBatch);
    }

    // Helper to keep code clean
    function createSinglePlayer(currentSection, currentGrid, sectionIdx, count) {
        // Create wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = 'player-wrapper';

        // Create player div
        const playerDiv = document.createElement('div');
        const playerId = `player-${sectionIdx}-${count}`;
        playerDiv.id = playerId;

        wrapper.appendChild(playerDiv);

        // Mute Button Overlay
        const muteBtn = document.createElement('button');
        muteBtn.className = 'mute-btn';
        muteBtn.innerHTML = '🔇';
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
                'disablekb': 1,
                'fs': 0,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
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
    }

    // Start the batch loop
    createNextBatch();
}

function onPlayerReady(event) {
    event.target.mute();
    event.target.setPlaybackQuality('tiny'); // Force low quality
    event.target.playVideo();
}

function onPlayerError(event) {
    console.warn("YouTube Player Error:", event.data);
    // If error 150 or 101 (restricted), we could try reloading or just ignoring
}


function onPlayerStateChange(event) {
    // YT.PlayerState.ENDED = 0
    // YT.PlayerState.PAUSED = 2

    if (event.data === YT.PlayerState.ENDED) {
        event.target.playVideo(); // Auto Loop
    }

    if (event.data === YT.PlayerState.PAUSED) {
        // Force resume if it pauses (since we hid controls, this is likely automated stops OR background throttling)
        // If Background Mode is active, we AGGRESSIVELY resume.
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
            try {
                if (player && typeof player.setPlaybackQuality === 'function') {
                    // Force tiny quality (144p)
                    player.setPlaybackQuality('tiny');

                    // Also ensure it's muted to save audio processing
                    if (!player.isMuted()) {
                        // Optional: Force mute if strict mode (commented out for user freedom)
                        // player.mute(); 
                    }
                }
            } catch (e) {
                // Ignore errors from destroyed players
            }
        });
    }
}, 3000); // Check every 3 seconds

document.getElementById('playBtn').addEventListener('click', loadVideo);
document.getElementById('bgModeBtn').addEventListener('click', toggleBackgroundMode);

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
