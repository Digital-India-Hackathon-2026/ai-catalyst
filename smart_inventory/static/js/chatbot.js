document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('chatbot-fab');
    const window = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const clearBtn = document.getElementById('chatbot-clear-btn');
    const overlay = document.getElementById('chatbot-overlay');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const messagesContainer = document.getElementById('chatbot-messages');

    if (!fab) return; // Only load if chatbot exists (ASHA role)

    let isFirstOpen = true;

    // Toggle Chatbot
    const toggleChat = () => {
        const isActive = window.classList.contains('active');
        if (isActive) {
            window.classList.remove('active');
            overlay.classList.remove('active');
        } else {
            window.classList.add('active');
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

        msgDiv.innerHTML = `
            <div class="msg-bubble">${content}</div>
            <div class="msg-time">${formatTime()}</div>
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

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // Add user message
        appendMessage(text, 'user');
        input.value = '';
        input.focus();
        sendBtn.disabled = true;

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

            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    appendMessage("⚠️ " + data.error, 'bot');
                } else {
                    appendMessage(data.response, 'bot');
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
            appendMessage("⚠️ Connection error. Please check your internet connection.", 'bot');
        }
    };

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
