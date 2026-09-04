const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const languageSelect = document.getElementById('languageSelect');

let currentConversationId = null;

// ---------------------------------------------------------------------
// View switching
// ---------------------------------------------------------------------
const views = {
  chat: document.getElementById('viewChat'),
  risk: document.getElementById('viewRisk'),
  misinfo: document.getElementById('viewMisinfo'),
  diseases: document.getElementById('viewDiseases'),
};
function showView(name) {
  Object.values(views).forEach(v => v.style.display = 'none');
  views[name].style.display = 'block';
}
document.getElementById('navRisk')?.addEventListener('click', () => showView('risk'));
document.getElementById('navMisinfo')?.addEventListener('click', () => showView('misinfo'));
document.getElementById('navDiseases')?.addEventListener('click', () => { showView('diseases'); loadDiseases(); });

document.querySelectorAll('.quick-btn[data-q]').forEach(btn => {
  btn.addEventListener('click', () => {
    showView('chat');
    chatInput.value = btn.dataset.q;
    sendMessage();
  });
});

// ---------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------
function appendMessage(role, text, riskLevel, sources) {
  const div = document.createElement('div');
  div.className = `msg ${role}` + (riskLevel ? ` risk-${riskLevel}` : '');
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = DOMPurify.sanitize(marked.parse(text));

  div.appendChild(content);

  if (sources && sources.length) {
    const details = document.createElement('details');
    details.className = 'sources';
    const summary = document.createElement('summary');
    summary.textContent = 'View verified information';
    details.appendChild(summary);
    const ul = document.createElement('ul');
    sources.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.disease} — ${s.source} (last updated ${s.last_updated})`;
      ul.appendChild(li);
    });
    details.appendChild(ul);
    div.appendChild(details);
  }

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  appendMessage('user', message);
  chatInput.value = '';
  sendBtn.disabled = true;

  const thinking = document.createElement('div');
  thinking.className = 'msg assistant';
  thinking.textContent = 'Thinking...';
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        language: languageSelect.value,
        conversation_id: currentConversationId,
      }),
    });
    const data = await res.json();
    thinking.remove();
    appendMessage('assistant', data.answer, data.risk_level, data.sources);
    if (data.conversation) {
      currentConversationId = data.conversation.id;
      loadConversations();
    }
  } catch (e) {
    thinking.remove();
    appendMessage('system', 'Something went wrong reaching the server. Please try again.');
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

// ---------------------------------------------------------------------
// Conversation history (registered users)
// ---------------------------------------------------------------------
async function loadConversations() {
  const list = document.getElementById('convoList');
  if (!list) return;
  const res = await fetch('/api/conversations');
  if (!res.ok) return;
  const data = await res.json();
  list.innerHTML = '';
  data.conversations.forEach(c => {
    const el = document.createElement('div');
    el.className = 'convo-item' + (c.id === currentConversationId ? ' active' : '');
    el.textContent = c.title || 'Conversation';
    el.addEventListener('click', () => openConversation(c.id));
    list.appendChild(el);
  });
}

async function openConversation(id) {
  const res = await fetch(`/api/conversations/${id}`);
  if (!res.ok) return;
  const data = await res.json();
  currentConversationId = id;
  chatWindow.innerHTML = '';
  data.conversation.messages.forEach(m => appendMessage(m.role, m.content, m.risk_level));
  showView('chat');
  loadConversations();
}

document.getElementById('newConvoBtn')?.addEventListener('click', async () => {
  const res = await fetch('/api/conversations', { method: 'POST' });
  const data = await res.json();
  currentConversationId = data.conversation.id;
  chatWindow.innerHTML = '';
  appendMessage('assistant', "New conversation started. What would you like to know?");
  loadConversations();
});

if (window.CURRENT_USER) loadConversations();

// ---------------------------------------------------------------------
// Risk assessment
// ---------------------------------------------------------------------
let selectedSymptoms = new Set();
let selectedDuration = '';

document.querySelectorAll('.symptom-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    const s = chip.dataset.symptom;
    if (selectedSymptoms.has(s)) selectedSymptoms.delete(s); else selectedSymptoms.add(s);
  });
});
document.querySelectorAll('.duration-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedDuration = chip.dataset.duration;
  });
});

document.getElementById('assessBtn')?.addEventListener('click', async () => {
  const resultDiv = document.getElementById('riskResult');
  resultDiv.innerHTML = '';
  if (selectedSymptoms.size === 0) {
    resultDiv.innerHTML = '<p style="color:var(--red)">Select at least one symptom.</p>';
    return;
  }
  const res = await fetch('/api/risk-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symptoms: Array.from(selectedSymptoms),
      duration: selectedDuration,
      language: languageSelect.value,
    }),
  });
  const data = await res.json();
  const labelMap = { RED: 'RED — SEEK IMMEDIATE PROFESSIONAL HELP', YELLOW: 'YELLOW — NEEDS ATTENTION', GREEN: 'GREEN — GENERAL AWARENESS' };
  resultDiv.innerHTML = `<div class="risk-result ${data.level}">${labelMap[data.level]}<div style="font-weight:400; margin-top:8px;">${data.message}</div></div>`;
});

// ---------------------------------------------------------------------
// Misinformation checker
// ---------------------------------------------------------------------
document.getElementById('checkClaimBtn')?.addEventListener('click', async () => {
  const claim = document.getElementById('claimInput').value.trim();
  const resultDiv = document.getElementById('claimResult');
  if (!claim) return;
  resultDiv.innerHTML = 'Checking...';
  const res = await fetch('/api/misinformation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claim, language: languageSelect.value }),
  });
  const data = await res.json();
  if (data.status === 'flagged') {
    resultDiv.innerHTML = `<div class="claim-result flagged">
      <strong>⚠️ CLAIM DETECTED — Potential misinformation</strong>
      <p>${data.message}</p>
      <p><strong>Verified information:</strong> ${data.correction}</p>
    </div>`;
  } else {
    resultDiv.innerHTML = `<div class="claim-result unverified"><p>${data.message}</p></div>`;
  }
});
document.getElementById('claimInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('checkClaimBtn').click();
});

// ---------------------------------------------------------------------
// Disease library
// ---------------------------------------------------------------------
async function loadDiseases() {
  const grid = document.getElementById('diseaseGrid');
  if (grid.dataset.loaded) return;
  const res = await fetch('/api/diseases');
  const data = await res.json();
  grid.innerHTML = '';
  data.diseases.forEach(d => {
    const card = document.createElement('div');
    card.className = 'disease-card';
    card.innerHTML = `<h4>${d.name}</h4><span style="color:var(--muted); font-size:0.8rem;">View details →</span>`;
    card.addEventListener('click', () => loadDiseaseDetail(d.key));
    grid.appendChild(card);
  });
  grid.dataset.loaded = '1';
}

async function loadDiseaseDetail(key) {
  const res = await fetch(`/api/diseases/${key}`);
  const data = await res.json();
  const d = data.disease;
  const detail = document.getElementById('diseaseDetail');
  detail.innerHTML = `
    <h3>${d.name}</h3>
    <div class="field-block"><h4>Overview</h4><p>${d.overview}</p></div>
    <div class="field-block"><h4>Common symptoms</h4><ul>${d.symptoms.map(s=>`<li>${s}</li>`).join('')}</ul></div>
    <div class="field-block"><h4>Warning signs</h4><ul>${d.warning_signs.map(s=>`<li>${s}</li>`).join('')}</ul></div>
    <div class="field-block"><h4>Transmission</h4><p>${d.transmission}</p></div>
    <div class="field-block"><h4>Prevention</h4><ul>${d.prevention.map(s=>`<li>${s}</li>`).join('')}</ul></div>
    <div class="field-block"><h4>Myths & facts</h4><ul>${d.myths_facts.map(m=>`<li><strong>Myth:</strong> ${m.myth}<br><strong>Fact:</strong> ${m.fact}</li>`).join('')}</ul></div>
    <div class="field-block"><h4>When to seek care</h4><p>${d.when_to_seek_care}</p></div>
    <div class="field-block"><h4>Source</h4><p style="color:var(--muted); font-size:0.85rem;">${d.source} — last updated ${d.last_updated}</p></div>
  `;
  detail.scrollIntoView({ behavior: 'smooth' });
}

// ---------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});
