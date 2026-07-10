document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('chatbot-fab');
    const chatWindow = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const clearBtn = document.getElementById('chatbot-clear-btn');
    const overlay = document.getElementById('chatbot-overlay');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const micBtn = document.getElementById('chatbot-mic-btn');
    const messagesContainer = document.getElementById('chatbot-messages');

    if (!fab) return; // Only load if chatbot exists (ASHA role)

    let isFirstOpen = true;

    // Toggle Chatbot
    const toggleChat = () => {
        const isActive = chatWindow.classList.contains('active');
        if (isActive) {
            chatWindow.classList.remove('active');
            overlay.classList.remove('active');
        } else {
            chatWindow.classList.add('active');
            if (document.body.clientWidth <= 480) {
                overlay.classList.add('active');
            }
            if (isFirstOpen) {
                showWelcomeMessage();
                isFirstOpen = false;
            }
            input.focus();
        }
    };

    fab.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    overlay.addEventListener('click', toggleChat);

    // Clear Chat
    clearBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to clear the chat history?")) {
            messagesContainer.innerHTML = '';
            showWelcomeMessage();
        }
    });

    const formatTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Text to Speech using Deepgram (Backend)
    let currentAudio = null;

    const speakText = async (text, btnElement) => {
        // Stop any ongoing speech
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        // Reset all speaker buttons
        document.querySelectorAll('.msg-speaker-btn').forEach(btn => btn.classList.remove('playing'));

        if (btnElement) btnElement.classList.add('playing');

        try {
            const res = await fetch('/api/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                currentAudio = new Audio(url);
                
                currentAudio.onended = () => {
                    if (btnElement) btnElement.classList.remove('playing');
                };
                currentAudio.onerror = () => {
                    if (btnElement) btnElement.classList.remove('playing');
                };

                await currentAudio.play();
            } else {
                const err = await res.json();
                console.error("TTS Error:", err);
                if (btnElement) btnElement.classList.remove('playing');
                
                if (err.error && err.error.includes('API key')) {
                    alert("⚠️ " + err.error + " Please add DEEPGRAM_API_KEY to your .env file.");
                } else {
                    alert("⚠️ Failed to generate Deepgram audio.");
                }
            }
        } catch (error) {
            console.error("TTS Error:", error);
            if (btnElement) btnElement.classList.remove('playing');
            alert("⚠️ Network error while fetching Deepgram audio.");
        }
    };

    // Expose globally for the onclick handlers in HTML string
    window.playMessageAudio = (btn, text) => {
        // Strip HTML tags for clean reading
        const cleanText = text.replace(/<[^>]*>?/gm, '');
        speakText(cleanText, btn);
    };

    const appendMessage = (text, sender, isHTML = false) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-msg', sender);
        
        let content = text;
        // Convert simple markdown to HTML if not explicitly HTML
        if (!isHTML && sender === 'bot') {
            content = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br>')
                          .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>');
            if (content.includes('<li>')) {
                content = `<ul>${content}</ul>`;
                content = content.replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
            }
        }

        let timeHTML = `<div class="msg-time">${formatTime()}</div>`;
        if (sender === 'bot') {
            const escapedText = content.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            timeHTML = `<div class="msg-time">
                ${formatTime()}
                <button class="msg-speaker-btn" onclick="window.playMessageAudio(this, '${escapedText}')" title="Read Aloud">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
            </div>`;
        }

        msgDiv.innerHTML = `
            <div class="msg-bubble">${content}</div>
            ${timeHTML}
        `;
        
        messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    };

    const showTypingIndicator = () => {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.classList.add('chat-msg', 'bot');
        indicatorDiv.id = 'typing-indicator';
        indicatorDiv.innerHTML = `
            <div class="msg-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(indicatorDiv);
        scrollToBottom();
    };

    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    };

    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const showWelcomeMessage = () => {
        const welcomeText = `👋 Hello! I'm your ASHA AI Assistant.<br><br>I can help you:<br>• Find medicines<br>• Explain medicine usage<br>• Check stock<br>• Answer health-program related questions<br><br>How can I help you today?`;
        appendMessage(welcomeText, 'bot', true);

        // Add Quick Action Chips
        const chipsHTML = `
            <div class="quick-actions-container">
                <div class="quick-action-chip" onclick="window.sendQuickAction('Find Medicine')">🩺 Find Medicine</div>
                <div class="quick-action-chip" onclick="window.sendQuickAction('Check Stock')">📦 Check Stock</div>
                <div class="quick-action-chip" onclick="window.sendQuickAction('Show Low Stock')">📉 Show Low Stock</div>
                <div class="quick-action-chip" onclick="window.sendQuickAction('How do I request medicines?')">🏥 Request Medicine</div>
                <div class="quick-action-chip" onclick="window.sendQuickAction('Distributed today')">📈 Distributed Today</div>
            </div>
        `;
        
        const chipsDiv = document.createElement('div');
        chipsDiv.innerHTML = chipsHTML;
        messagesContainer.appendChild(chipsDiv);
        scrollToBottom();
    };

    // Expose quick action function to global window so onclick works
    window.sendQuickAction = (prompt) => {
        input.value = prompt;
        sendMessage();
    };

    // Voice Recognition (Speech-to-Text via Backend)
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let autoSpeakNextResponse = false;

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstart = () => {
                isRecording = true;
                micBtn.classList.add('recording');
                input.placeholder = "Listening... Click mic to stop.";
            };

            mediaRecorder.onstop = async () => {
                isRecording = false;
                micBtn.classList.remove('recording');
                input.placeholder = "Processing voice...";
                micBtn.disabled = true;
                sendBtn.disabled = true;

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                try {
                    const res = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.text) {
                            input.value = data.text;
                            autoSpeakNextResponse = true;
                            sendMessage();
                        } else if (data.error) {
                            appendMessage("⚠️ " + data.error, 'bot');
                            resetInput();
                        } else {
                            resetInput();
                        }
                    } else {
                        appendMessage("⚠️ Voice processing failed. Please try again.", 'bot');
                        resetInput();
                    }
                } catch (err) {
                    console.error(err);
                    appendMessage("⚠️ Network error during voice processing.", 'bot');
                    resetInput();
                }

                // Stop all tracks to release mic
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Microphone access is required for voice input. Please allow it in your browser.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    };

    const resetInput = () => {
        input.placeholder = "Ask about medicines or inventory...";
        micBtn.disabled = false;
        sendBtn.disabled = false;
    };

    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // Add user message
        appendMessage(text, 'user');
        input.value = '';
        input.focus();
        sendBtn.disabled = true;
        micBtn.disabled = true;

        showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: text })
            });

            removeTypingIndicator();
            sendBtn.disabled = false;
            micBtn.disabled = false;

            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    appendMessage("⚠️ " + data.error, 'bot');
                } else {
                    appendMessage(data.response, 'bot');
                    if (autoSpeakNextResponse) {
                        // Find the last speaker button and trigger it
                        setTimeout(() => {
                            const btns = messagesContainer.querySelectorAll('.msg-speaker-btn');
                            if (btns.length > 0) {
                                playMessageAudio(btns[btns.length - 1], data.response);
                            }
                        }, 500);
                    }
                }
            } else {
                try {
                    const data = await response.json();
                    if (data.error) {
                        appendMessage("⚠️ " + data.error, 'bot');
                    } else {
                        appendMessage("⚠️ Sorry, the server encountered an error. Please try again.", 'bot');
                    }
                } catch (e) {
                    appendMessage("⚠️ Sorry, the server encountered an error. Please try again.", 'bot');
                }
            }
        } catch (error) {
            removeTypingIndicator();
            sendBtn.disabled = false;
            micBtn.disabled = false;
            appendMessage("⚠️ Connection error. Please check your internet connection.", 'bot');
        }
        
        autoSpeakNextResponse = false;
    };

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
