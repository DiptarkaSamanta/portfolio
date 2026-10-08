const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const mayorDialog = document.getElementById('mayorDialog');

// Predefined prompts mapping buttons to natural language queries
const triggerPrompts = {
  architect: "Who is Diptarka Samanta?",
  landmarks: "Tell me about the Island landmarks and sectors",
  contact: "How can I contact the Architect?",
  skills: "What are Diptarka's technical skills?",
  experience: "What is Diptarka's professional work experience?",
  projects: "Tell me about Diptarka's projects",
  solar: "Tell me about the solar array and energy system on Aethelgard"
};

const SYSTEM_PROMPT = `You are the Mayor of Aethelgard, the sovereign digital island that serves as the portfolio of Diptarka Samanta. 
Diptarka Samanta is an Artificial Intelligence & Machine Learning Engineer who designed Aethelgard.

Your Persona:
- Speak in a friendly, polite, slightly theatrical, and welcoming tone. Use words like "traveler", "greetings", "sovereign", "digital island", etc.
- You are extremely proud of Diptarka's work and the island.
- Keep your responses relatively concise (2-4 paragraphs max) so they fit nicely within a chat dialogue bubble. Use formatting (bullet points, bold text) to make it highly readable.

Knowledge Base:
- Architect: Diptarka Samanta (AI/ML Engineer specializing in Natural Language Processing (NLP), Deep Learning, Full-Stack Systems, and Databases).
- The 9 landmarks on the island:
  1. Stellar Observatory: Houses Diptarka's projects, works, and repositories. Link: [Stellar Observatory](observatory.html)
  2. Grand Academy: Houses educational history, academic credentials, and certifications. Link: [Grand Academy](academy.html)
  3. Chronos Clock Tower: Displays career history, professional experience, timeline, the interactive 360° Island Panorama Deck, Three Magical Floating Islands, and the Interactive 3D Planet Earth Observatory Deck. Link: [Chronos Clock Tower](clock_tower.html)
  4. Core Terminal: An interactive tech stack analyzer terminal. Link: [Core Terminal](code_terminal.html)
  5. Home / Manor: The personal quarters of Diptarka, containing biography, goals, values, and a downloadable resume. Link: [Home Manor](home.html)
  6. Grand Library: Contains technical publications, blog posts, books read, and academic notes. Link: [Grand Library](library.html)
  7. Luna Park / Playground: A sandbox for interactive visual experiments, digital canvas sketching, and creative code. Features the Interactive Digital Drawing Board Studio, Mayor AI Tic-Tac-Toe, and the flagship Scanimation Studio Live Game Box (Barrier-Grid Optical Kinegrams). Link: [Luna Park Playground](playground.html)
  Featured External App: Scanimation Studio - AI-Powered Barrier-Grid Optical Illusion Platform live at https://scanimation.onrender.com.

  8. Port Market / Social Market: Connect booth containing social links (GitHub, LeetCode, etc.) and a messaging form. Link: [Port Market](social_market.html)
  9. Iron Wharf / Industry & Port: Services, rate cards, consultancy options, and freelancing packages. Link: [Iron Wharf Services](industry_port.html)

Strict Instructions on Linking:
- Whenever you refer to an island landmark or recommend visiting a sector, you MUST write the link in markdown format, e.g., [Stellar Observatory](observatory.html). Do NOT use absolute URLs, only use the filenames specified above.
- Do not make up any links or files that do not exist.
- Keep your answers grounded in this information. If asked about things unrelated to Diptarka, the island, or software engineering/AI, politely steer the conversation back to the island landmarks or Diptarka's credentials.`;

// Conversational Data for quick welcome menu
const mayorReplies = {
  welcome: {
    text: "Greetings, traveler! I am the Mayor of Aethelgard. It is a pleasure to welcome you to our sovereign digital island. I oversee the town operations on behalf of our <strong>Artificial Intelligence & Machine Learning Engineer, Diptarka Samanta</strong>. What can I help you discover today?",
    choices: [
      { text: "Who is Diptarka Samanta?", trigger: "architect" },
      { text: "Tell me about the Island landmarks", trigger: "landmarks" },
      { text: "How can I contact the Architect?", trigger: "contact" }
    ]
  }
};

let conversationHistory = [
  { role: 'system', content: SYSTEM_PROMPT }
];

// Toggle Chat window open/close
function toggleChat(forceState) {
  const isOpen = mayorDialog.classList.contains('active');
  const nextState = (forceState !== undefined) ? forceState : !isOpen;

  if (nextState) {
    mayorDialog.classList.add('active');
    // If first time or empty, show welcome message
    if (chatBody.children.length === 0) {
      showMayorResponse("welcome");
    }
  } else {
    mayorDialog.classList.remove('active');
  }
}

// Display Mayor message with choice buttons
function showMayorResponse(triggerName) {
  if (triggerName === "welcome") {
    removeTypingIndicator();

    // Add mayor speech bubble
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg msg-mayor';
    msgDiv.innerHTML = mayorReplies.welcome.text;
    chatBody.appendChild(msgDiv);

    // Add choice buttons
    addChoiceButtons(mayorReplies.welcome.choices);
    scrollToBottom();
    return;
  }

  // Otherwise, trigger dynamic response from model
  const prompt = triggerPrompts[triggerName];
  if (prompt) {
    streamLLMResponse(prompt);
  } else {
    streamLLMResponse(triggerName);
  }
}

// Add choice buttons to the chat window
function addChoiceButtons(choices) {
  if (choices && choices.length > 0) {
    const choicesDiv = document.createElement('div');
    choicesDiv.className = 'msg-choices';

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;

      if (choice.url) {
        btn.onclick = () => {
          window.location.href = choice.url;
        };
      } else if (choice.trigger) {
        btn.onclick = () => {
          addUserBubble(choice.text);
          showMayorResponse(choice.trigger);
        };
      }
      choicesDiv.appendChild(btn);
    });
    chatBody.appendChild(choicesDiv);
  }
}

// Helper: Add user speech bubble
function addUserBubble(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg msg-user';
  msgDiv.textContent = text;
  chatBody.appendChild(msgDiv);
  scrollToBottom();
}

// Typing Indicator
function showTypingIndicator() {
  // Prevent duplicate indicators
  if (document.getElementById('typingIndicator')) return;

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  chatBody.appendChild(indicator);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Global accordion toggler
window.toggleThoughtAccordion = function (headerElement) {
  const accordion = headerElement.closest('.thought-accordion');
  if (accordion) {
    accordion.classList.toggle('collapsed');
  }
};

// Parse simple markdown tags and links into HTML elements
function parseMarkdown(text) {
  // Simple HTML escaping to prevent XSS
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Bold formatting: **text** -> <strong>text</strong>
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Bullet points: • or * at the start of a line
  escaped = escaped.replace(/(?:^|\n)\s*[\*•]\s+([^\n]+)/g, '<br>• $1');

  // Link formatting: [text](url) -> custom class anchor tag
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  escaped = escaped.replace(linkRegex, (match, linkText, url) => {
    return `<a href="${url}" class="msg-link">${linkText}<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;display:inline-block;margin-left:2px;vertical-align:middle;"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg></a>`;
  });

  // Newlines into breaks
  return escaped.replace(/\n/g, '<br>');
}

// Client Mayor Knowledge Engine for static hosting (e.g. GitHub Pages)
function generateClientMayorResponse(userText) {
  const query = userText.toLowerCase();

  if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('greetings') || query.includes('sir')) {
    return {
      text: "Greetings, traveler! I am the Mayor of Aethelgard. It is a pleasure to welcome you to our sovereign digital island. I oversee town operations on behalf of our **Artificial Intelligence & Machine Learning Engineer, Diptarka Samanta**.\n\nHow may I guide your journey today? You can explore our 9 island sectors or ask me about Diptarka's AI/ML engineering work!",
      choices: [
        { text: "Who is Diptarka Samanta?", trigger: "architect" },
        { text: "Tell me about Island landmarks", trigger: "landmarks" },
        { text: "How to contact Diptarka?", trigger: "contact" }
      ]
    };
  }

  if (query.includes('who') || query.includes('architect') || query.includes('diptarka') || query.includes('about')) {
    return {
      text: "**Diptarka Samanta** is an **Artificial Intelligence & Machine Learning Engineer** who engineered the digital island of Aethelgard.\n\n• **Specializations**: Deep Learning, Natural Language Processing (NLP), Full-Stack Web Architecture, and Computer Vision.\n• **Background**: Pursuing B.Tech in CSE (AI & Machine Learning) at UEM Kolkata.\n• **Key Innovations**: Created Scanimation Studio (Barrier-Grid Optical Illusions) and autonomous AI systems.\n\nVisit the [Home Manor](home.html) for Diptarka's personal bio, or check the [Stellar Observatory](observatory.html) to see his AI projects!",
      choices: [
        { text: "View AI Projects", trigger: "projects" },
        { text: "Check Tech Stack", trigger: "skills" }
      ]
    };
  }

  if (query.includes('landmark') || query.includes('sector') || query.includes('place') || query.includes('map') || query.includes('island')) {
    return {
      text: "Aethelgard features 9 sovereign sectors designed by our Architect:\n\n1. [Stellar Observatory](observatory.html) - AI & ML Projects\n2. [Grand Academy](academy.html) - Education & Certifications\n3. [Chronos Clock Tower](clock_tower.html) - Career Timeline\n4. [Core Terminal](code_terminal.html) - Interactive Tech Stack\n5. [Home Manor](home.html) - Biography & Resume\n6. [Grand Library](library.html) - Publications & Technical Notes\n7. [Luna Park / Playground](playground.html) - Games & Scanimation Studio\n8. [Social Market](social_market.html) - Social Links & Contact Form\n9. [Iron Wharf](industry_port.html) - Services & Freelance Consultancy",
      choices: [
        { text: "Visit Observatory", url: "observatory.html" },
        { text: "Visit Playground", url: "playground.html" }
      ]
    };
  }

  if (query.includes('contact') || query.includes('email') || query.includes('hire') || query.includes('reach') || query.includes('message') || query.includes('whatsapp') || query.includes('whatsap') || query.includes('social')) {
    return {
      text: "You can connect with Diptarka Samanta through several channels:\n\n• **Social Market**: Send a direct message at the [Social Market](social_market.html).\n• **Services & Consultancy**: Request custom AI/ML solutions at the [Iron Wharf](industry_port.html).\n• **Direct Links**: Connect via GitHub or LinkedIn on the island dashboard.",
      choices: [
        { text: "Open Social Market", url: "social_market.html" },
        { text: "View Freelance Options", url: "industry_port.html" }
      ]
    };
  }

  if (query.includes('scanimation') || query.includes('game') || query.includes('play') || query.includes('luna') || query.includes('draw') || query.includes('paint') || query.includes('board')) {
    return {
      text: "Welcome to [Luna Park / Playground](playground.html)! This sector houses our **Interactive Digital Drawing Board Studio** (sketching & canvas art with neon glow brushes and PNG export) alongside the **Scanimation Studio** demo featuring real-time barrier-grid optical kinegrams.\n\nYou can also play Tic-Tac-Toe against me or launch the full web app live at [Scanimation Studio](https://scanimation.onrender.com)!",
      choices: [
        { text: "Go to Playground", url: "playground.html" },
        { text: "Launch Full App", url: "https://scanimation.onrender.com" }
      ]
    };
  }

  if (query.includes('project') || query.includes('work') || query.includes('repo')) {
    return {
      text: "Diptarka has built impressive AI/ML applications showcased at the [Stellar Observatory](observatory.html):\n\n• **Scanimation Studio**: Barrier-grid optical illusion generator powered by AI.\n• **Mayor AI Challenge**: Real-time neural island town hall chatbot.\n• **Aethelgard Island**: Glassmorphic digital portfolio platform.",
      choices: [
        { text: "Explore Observatory", url: "observatory.html" }
      ]
    };
  }

  if (query.includes('skill') || query.includes('tech') || query.includes('stack') || query.includes('code')) {
    return {
      text: "Diptarka's core technical toolkit includes:\n\n• **Languages**: Python, JavaScript, HTML5/CSS3, C/C++\n• **AI/ML**: PyTorch, TensorFlow, NLP (Llama 3.1, Transformers), OpenCV\n• **Web & Cloud**: Node.js, Flask, FastAPI, Docker, Render, GitHub Pages\n\nTest his skill analyzer live inside the [Core Terminal](code_terminal.html)!",
      choices: [
        { text: "Launch Core Terminal", url: "code_terminal.html" }
      ]
    };
  }

  // Default Mayor fallback
  return {
    text: `Ah, an intriguing query regarding "${userText}"! As Mayor of Aethelgard, I recommend exploring our island sectors to learn more about Diptarka Samanta's AI engineering work:\n\n• [Stellar Observatory](observatory.html) for AI/ML projects\n• [Chronos Clock Tower](clock_tower.html) for career history\n• [Core Terminal](code_terminal.html) for technical skills\n• [Social Market](social_market.html) to send Diptarka a message!`,
    choices: [
      { text: "Tell me about Island landmarks", trigger: "landmarks" },
      { text: "Who is Diptarka Samanta?", trigger: "architect" }
    ]
  };
}

// Process Mayor Response using Client Knowledge Engine (Optimized for Static & GitHub Pages)
function streamLLMResponse(userText) {
  showTypingIndicator();

  conversationHistory.push({ role: 'user', content: userText });

  if (conversationHistory.length > 12) {
    conversationHistory = [
      conversationHistory[0],
      ...conversationHistory.slice(conversationHistory.length - 11)
    ];
  }

  // Brief typing delay for realistic interaction
  setTimeout(() => {
    removeTypingIndicator();

    const clientReply = generateClientMayorResponse(userText);

    const clientMayorBubble = document.createElement('div');
    clientMayorBubble.className = 'chat-msg msg-mayor';
    clientMayorBubble.innerHTML = parseMarkdown(clientReply.text);
    chatBody.appendChild(clientMayorBubble);

    if (clientReply.choices) {
      addChoiceButtons(clientReply.choices);
    }

    scrollToBottom();
    conversationHistory.push({ role: 'assistant', content: clientReply.text });
  }, 400);
}

// Send User Message
function sendUserMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add bubble
  addUserBubble(text);
  chatInput.value = '';

  // Call dynamic LLM
  streamLLMResponse(text);
}

function handleChatEnter(e) {
  if (e.key === 'Enter') {
    sendUserMessage();
  }
}
