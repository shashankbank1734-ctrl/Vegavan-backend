(function () {
  // 1. Locate script and retrieve data-user-id attribute
  const scriptTag = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  
  let userId = scriptTag ? scriptTag.getAttribute('data-user-id') : null;

  // Dynamic fallback: allow reading userId from URL query parameters (perfect for live testing!)
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  if (urlUserId) {
    userId = urlUserId;
  }

  if (!userId) {
    console.error('AI Chatbot Error: data-user-id attribute is missing from the script tag.');
    return;
  }

  // 2. Define configurations & api hosts dynamically based on the script's src URL
  const scriptSrc = scriptTag ? (scriptTag.getAttribute('src') || '') : '';
  let API_HOST = 'http://localhost:5000';
  if (scriptSrc && (scriptSrc.startsWith('http://') || scriptSrc.startsWith('https://'))) {
    try {
      const url = new URL(scriptSrc);
      API_HOST = url.origin;
    } catch (err) {
      console.warn('AI Chatbot: Unable to parse script origin, utilizing fallback.', err);
    }
  }
  let sessionId = localStorage.getItem('ai_chat_session_id') || '';
  let config = {
    businessName: 'AI Support',
    primaryColor: '#6366f1',
    welcomeMessage: 'Hello! How can I help you today?',
    supportEmail: 'support@example.com',
    supportPhone: ''
  };

  // 3. Create Root Host Element for Shadow DOM isolation
  const host = document.createElement('div');
  host.id = 'ai-chatbot-root-container';
  host.style.position = 'fixed';
  host.style.bottom = '20px';
  host.style.right = '20px';
  host.style.zIndex = '999999';
  host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  document.body.appendChild(host);

  // Attach Shadow Root
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // 4. Load Chatbot Styling Configurations
  fetch(`${API_HOST}/api/chatbot/config/public?userId=${userId}`)
    .then(res => res.json())
    .then(data => {
      config = { ...config, ...data };
      initWidget();
    })
    .catch(err => {
      console.warn('AI Chatbot: Unable to fetch live config, utilizing defaults.', err);
      initWidget();
    });

  // 5. Initialize Widget Components inside Shadow DOM
  function initWidget() {
    const color = config.primaryColor || '#6366f1';

    // Reset host container styling to standard bottom-right
    host.style.top = 'auto';
    host.style.bottom = '20px';
    host.style.left = 'auto';
    host.style.right = '20px';

    // Inject Custom Isolated CSS rules inside Shadow Root
    const style = document.createElement('style');
    style.textContent = `
      .chatbot-launcher {
        position: relative;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${color};
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        color: white;
      }
      .chatbot-launcher::before {
        content: '';
        position: absolute;
        top: -4px; right: -4px; bottom: -4px; left: -4px;
        border-radius: 50%;
        background: inherit;
        opacity: 0.5;
        z-index: -1;
        animation: pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
      }
      @keyframes pulseRing {
        0% { transform: scale(0.95); opacity: 0.6; }
        70% { transform: scale(1.4); opacity: 0; }
        100% { transform: scale(1.4); opacity: 0; }
      }
      .notification-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 20px;
        height: 20px;
        background: #ef4444;
        color: white;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        z-index: 20;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        animation: bounceBadge 2s infinite ease-in-out;
      }
      @keyframes bounceBadge {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      .chatbot-launcher:hover {
        transform: scale(1.08);
      }
      .chatbot-launcher svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
      }
      .chat-window {
        position: fixed;
        bottom: 95px;
        right: 0;
        width: 380px;
        height: 520px;
        background: #111827; /* sleek dark mode default */
        border-radius: 16px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.1);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        pointer-events: none;
      }
      .chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      .chat-header {
        background: ${color};
        padding: 16px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .header-info h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .header-info p {
        margin: 4px 0 0 0;
        font-size: 12px;
        opacity: 0.8;
      }
      .close-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        font-size: 20px;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .close-btn:hover {
        opacity: 1;
      }
      .chat-messages {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #0f172a;
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
      }
      .chat-messages::-webkit-scrollbar {
        display: none; /* Safari and Chrome */
      }
      .message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.4;
        animation: messageFadeIn 0.3s ease;
      }
      @keyframes messageFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .message.user {
        background: ${color};
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 2px;
      }
      .message.assistant {
        background: rgba(255,255,255,0.08);
        color: #f1f5f9;
        align-self: flex-start;
        border-bottom-left-radius: 2px;
      }
      .chat-input-area {
        padding: 12px;
        background: #1e293b;
        border-top: 1px solid rgba(255,255,255,0.1);
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .chat-input {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px;
        padding: 8px 16px;
        color: white;
        font-size: 14px;
        outline: none;
        transition: border 0.2s;
      }
      .chat-input:focus {
        border-color: ${color};
      }
      .send-btn {
        background: ${color};
        color: white;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }
      .send-btn:hover {
        transform: scale(1.05);
      }
      .send-btn svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        background: rgba(255,255,255,0.08);
        border-radius: 12px;
        align-self: flex-start;
        display: none;
      }
      .dot {
        width: 6px;
        height: 6px;
        background: #94a3b8;
        border-radius: 50%;
        animation: wave 1.3s infinite ease-in-out;
      }
      .dot:nth-child(2) { animation-delay: -1.1s; }
      .dot:nth-child(3) { animation-delay: -0.9s; }
      @keyframes wave {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }
      .prechat-form-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #0f172a;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 24px;
        z-index: 100;
        box-sizing: border-box;
        animation: messageFadeIn 0.3s ease;
      }
      .prechat-form-overlay h4 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 700;
        color: white;
        text-align: left;
      }
      .prechat-form-overlay p {
        margin: 0 0 20px 0;
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.4;
        text-align: left;
      }
      .prechat-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
        text-align: left;
      }
      .prechat-field label {
        font-size: 12px;
        font-weight: 600;
        color: #cbd5e1;
      }
      .prechat-input {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 10px 12px;
        color: white;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
        width: 100%;
      }
      .prechat-input:focus {
        border-color: ${color};
      }
      .prechat-submit {
        background: ${color};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.2s, opacity 0.2s;
        margin-top: 10px;
        width: 100%;
      }
      .prechat-submit:hover {
        opacity: 0.9;
        transform: scale(1.02);
      }
      .prechat-close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        font-size: 24px;
        line-height: 1;
        opacity: 0.8;
        transition: color 0.2s, opacity 0.2s;
      }
      .prechat-close-btn:hover {
        color: white;
        opacity: 1;
      }

      .contact-buttons-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
        width: 100%;
      }
      .contact-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: white;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.2s, border-color 0.2s, transform 0.2s;
        box-sizing: border-box;
      }
      .contact-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: ${color};
        transform: translateY(-1px);
      }
      .contact-btn:active {
        transform: translateY(0);
      }
      .contact-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      /* Mobile responsiveness */
      @media (max-width: 480px) {
        .chat-window {
          bottom: 0;
          right: 0;
          width: 100vw;
          height: 100vh;
          border-radius: 0;
          border: none;
        }
        #ai-chatbot-root-container {
          bottom: 0px !important;
          right: 0px !important;
        }
        .chatbot-launcher {
          position: fixed;
          bottom: 20px;
          right: 20px;
        }
      }
    `;
    shadowRoot.appendChild(style);

    // 6. Create Floating Launcher Button
    const launcher = document.createElement('div');
    launcher.className = 'chatbot-launcher';
    launcher.innerHTML = `
      <div class="notification-badge">1</div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="fill: none;">
        <path d="M12 8V4H8"/>
        <rect width="16" height="12" x="4" y="8" rx="2"/>
        <path d="M2 14h2"/><path d="M20 14h2"/>
        <line x1="9" x2="9.01" y1="13" y2="13"/>
        <line x1="15" x2="15.01" y1="13" y2="13"/>
        <path d="M9 16c1.5 1 4.5 1 6 0"/>
      </svg>
    `;

    shadowRoot.appendChild(launcher);

    const visitorNameStored = localStorage.getItem('ai_chat_visitor_name') || '';
    const visitorPhoneStored = localStorage.getItem('ai_chat_visitor_phone') || '';

    // 7. Create Chat Window Frame
    const chatWindow = document.createElement('div');
    chatWindow.className = 'chat-window';
    chatWindow.innerHTML = `
      <div class="chat-header">
        <div class="header-info">
          <h3>${config.businessName}</h3>
          <p>AI Support Assistant</p>
        </div>
        <button class="close-btn">&times;</button>
      </div>
      <div class="chat-messages" id="chat-messages-container">
        <div class="message assistant">${config.welcomeMessage}</div>
        <div class="typing-indicator" id="typing-bubble">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
      <div class="chat-input-area">
        <input type="text" class="chat-input" placeholder="Type a message..." id="user-chat-text-input">
        <button class="send-btn" id="send-msg-btn">
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
        </button>
      </div>

      <div class="prechat-form-overlay" id="prechat-form" style="display: flex;">
        <button class="prechat-close-btn" id="prechat-close-btn" aria-label="Close">&times;</button>
        <h4>Welcome to ${config.businessName}!</h4>
        <p>Please share your details to start chatting with our AI receptionist instantly.</p>
        
        <div class="prechat-field">
          <label>Your Name</label>
          <input type="text" class="prechat-input" id="prechat-name-input" placeholder="Aarav Sharma">
        </div>

        <div class="prechat-field">
          <label>Phone Number</label>
          <input type="tel" class="prechat-input" id="prechat-phone-input" placeholder="+91 98765 43210">
        </div>

        <button class="prechat-submit" id="prechat-submit-btn">Start Chatting</button>
      </div>
    `;
    shadowRoot.appendChild(chatWindow);

    // 8. Grab DOM references inside Shadow DOM
    const closeBtn = chatWindow.querySelector('.close-btn');
    const messagesContainer = chatWindow.querySelector('#chat-messages-container');
    const textInput = chatWindow.querySelector('#user-chat-text-input');
    const sendBtn = chatWindow.querySelector('#send-msg-btn');
    const typingBubble = chatWindow.querySelector('#typing-bubble');

    // 9. Attach Event Listeners
    const prechatSubmitBtn = chatWindow.querySelector('#prechat-submit-btn');
    const prechatCloseBtn = chatWindow.querySelector('#prechat-close-btn');
    const prechatNameInput = chatWindow.querySelector('#prechat-name-input');
    const prechatPhoneInput = chatWindow.querySelector('#prechat-phone-input');
    const prechatForm = chatWindow.querySelector('#prechat-form');

    if (prechatCloseBtn) {
      prechatCloseBtn.addEventListener('click', () => {
        chatWindow.classList.remove('open');
        launcher.style.display = 'flex';
      });
    }

    if (prechatSubmitBtn) {
      prechatSubmitBtn.addEventListener('click', () => {
        const nameVal = prechatNameInput.value.trim();
        const phoneVal = prechatPhoneInput.value.trim();

        if (!nameVal || !phoneVal) {
          alert('Please enter both your name and phone number to continue.');
          return;
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneVal)) {
          alert('Please enter a valid 10-digit phone number.');
          return;
        }

        localStorage.setItem('ai_chat_visitor_name', nameVal);
        localStorage.setItem('ai_chat_visitor_phone', phoneVal);

        // Personalize the assistant welcome bubble with their real name
        const welcomeBubble = chatWindow.querySelector('.message.assistant');
        if (welcomeBubble) {
          welcomeBubble.innerHTML = `Hi <strong>${nameVal}</strong>! ${config.welcomeMessage}`;
        }

        // Capture lead immediately upon form submit
        fetch(`${API_HOST}/api/chat/init-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            sessionId: sessionId,
            visitorName: nameVal,
            visitorPhone: phoneVal
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.sessionId && data.sessionId !== sessionId) {
            sessionId = data.sessionId;
            localStorage.setItem('ai_chat_session_id', sessionId);
          }
        })
        .catch(err => {
          console.error('Error capturing lead immediately:', err);
        });

        prechatForm.style.display = 'none';
        textInput.focus();
      });
    }

    launcher.addEventListener('click', () => {
      chatWindow.classList.toggle('open');
      if (chatWindow.classList.contains('open')) {
        const nameField = chatWindow.querySelector('#prechat-name-input');
        if (nameField) nameField.focus();
        launcher.style.display = 'none'; // hide launcher on mobile/desktop for full experience
      }
    });

    closeBtn.addEventListener('click', () => {
      chatWindow.classList.remove('open');
      launcher.style.display = 'flex'; // show launcher again
      // Clear saved details and reset pre-chat form so it ALWAYS prompts again
      localStorage.removeItem('ai_chat_visitor_name');
      localStorage.removeItem('ai_chat_visitor_phone');
      if (prechatForm) {
        prechatForm.style.display = 'flex';
      }
      if (prechatNameInput) prechatNameInput.value = '';
      if (prechatPhoneInput) prechatPhoneInput.value = '';
    });

    // Send Message Trigger
    const sendMessage = () => {
      const text = textInput.value.trim();
      if (!text) return;

      // Append user message
      appendMessage('user', text);
      textInput.value = '';

      // Show typing animation
      typingBubble.style.display = 'flex';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      const vName = localStorage.getItem('ai_chat_visitor_name') || '';
      const vPhone = localStorage.getItem('ai_chat_visitor_phone') || '';

      // Fire HTTP Post request to live AI Engine
      fetch(`${API_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          message: text,
          sessionId: sessionId,
          visitorName: vName,
          visitorPhone: vPhone
        })
      })
      .then(res => res.json())
      .then(data => {
        // Hide typing animation
        typingBubble.style.display = 'none';

        // Set or update session ID locally
        if (data.sessionId && data.sessionId !== sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('ai_chat_session_id', sessionId);
        }

        // Append assistant response
        appendMessage('assistant', data.message);
      })
      .catch(err => {
        console.error('AI Chatbot error:', err);
        typingBubble.style.display = 'none';
        appendMessage('assistant', `I am sorry, I am currently offline. Please reach out to us at ${config.supportEmail}.`);
      });
    };

    sendBtn.addEventListener('click', sendMessage);
    textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    function formatMessageText(text) {
      if (!text) return '';
      let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      const lines = escaped.split('\n');
      const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (/^\d+\.\s+(.*)/.test(trimmed)) {
          const match = trimmed.match(/^\d+\.\s+(.*)/);
          return `<div style="margin-left: 8px; margin-top: 4px; margin-bottom: 4px;"><strong>${trimmed.match(/^\d+\./)[0]}</strong> ${match[1]}</div>`;
        }
        if (/^[\-\*]\s+(.*)/.test(trimmed)) {
          const match = trimmed.match(/^[\-\*]\s+(.*)/);
          return `<div style="margin-left: 8px; margin-top: 4px; margin-bottom: 4px;">• ${match[1]}</div>`;
        }
        return line;
      });

      return formattedLines.join('<br>');
    }

    function appendMessage(role, content) {
      const bubble = document.createElement('div');
      bubble.className = `message ${role}`;
      bubble.innerHTML = formatMessageText(content);

      if (role === 'assistant' && content) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(?:\+?\d{1,3}[ -.]?)?\(?\d{2,4}\)?[ -.]?\d{3,4}[ -.]?\d{3,4}/g;

        const emails = content.match(emailRegex) || [];
        const rawPhones = content.match(phoneRegex) || [];
        const phones = rawPhones.map(p => p.trim()).filter(p => {
          const digits = p.replace(/\D/g, '');
          return digits.length >= 8 && digits.length <= 15;
        });

        const lowercaseContent = content.toLowerCase();
        const askedForContact = lowercaseContent.includes('contact') || 
                               lowercaseContent.includes('phone') || 
                               lowercaseContent.includes('call') || 
                               lowercaseContent.includes('email') || 
                               lowercaseContent.includes('number');

        const uniqueEmails = [...new Set(emails)];
        const uniquePhones = [...new Set(phones)];

        if (askedForContact) {
          if (config.supportEmail && !uniqueEmails.includes(config.supportEmail)) {
            uniqueEmails.push(config.supportEmail);
          }
          if (config.supportPhone && !uniquePhones.includes(config.supportPhone)) {
            uniquePhones.push(config.supportPhone);
          }
        }

        if (uniqueEmails.length > 0 || uniquePhones.length > 0) {
          const btnContainer = document.createElement('div');
          btnContainer.className = 'contact-buttons-container';

          uniquePhones.forEach(phone => {
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            const callBtn = document.createElement('a');
            callBtn.href = `tel:${cleanPhone}`;
            callBtn.className = 'contact-btn';
            callBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a1 1 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.01 11.48 11.48 0 0 1-.57-3.53A1 1 0 0 0 7.36 3H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3.59a1 1 0 0 0-1-1.03z"/>
              </svg>
              Call Us: ${phone}
            `;
            btnContainer.appendChild(callBtn);
          });

          uniqueEmails.forEach(email => {
            const emailBtn = document.createElement('a');
            emailBtn.href = `mailto:${email}`;
            emailBtn.className = 'contact-btn';
            emailBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Email Us: ${email}
            `;
            btnContainer.appendChild(emailBtn);
          });

          bubble.appendChild(btnContainer);
        }
      }

      messagesContainer.insertBefore(bubble, typingBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
})();
