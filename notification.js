const bellWrapper = document.getElementById("bellWrapper");
const badge = document.getElementById("notifyBadge");
let notifyModal = null;

const BADGE_RESPAWN_INTERVAL = 60000;
let badgeTimer = null;

const messages = [
  {
    text: "Stand a chance of being selected as our <strong>Midweek Winner of KES 1,000</strong> when you share our site with friends. The more you spread the word, the brighter your chances!",
    share: "Think you’ve got real skill? Prove it. Play BilaRed — where your focus earns real cash, starting from just 10 bob."
  },
  {
    text: "You might unlock <strong>15 free game rounds</strong> simply by sharing our site. Every share helps more players discover BilaRed—and might just reward you next!",
    share: "Forget betting. This is skill. Play BilaRed and turn quick reflexes into real KES wins. Payable via M-Pesa."
  },
  {
    text: "You could be the <strong>lucky winner of KES 5,000</strong> in our weekly appreciation draw for top sharers. Share BilaRed now and see where luck takes you!",
    share: "Forget gambling. You control the game. You earn the win. Join BilaRed — play from 10 bob and withdraw your winnings to M-Pesa."
  }
];

let messagePool = shuffle([...messages]);

function getNextMessage() {
  if (messagePool.length === 0) messagePool = shuffle([...messages]);
  return messagePool.pop();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

bellWrapper.addEventListener("click", (e) => {
  e.stopPropagation();

  badge.style.display = "none";
  resetBadgeRespawn();

  const { text, share } = getNextMessage();

  if (notifyModal) {
    updateModal(text, share);
    const isVisible = notifyModal.style.opacity === "1";
    isVisible ? closeModal() : openModal();
    return;
  }

  notifyModal = document.createElement("div");
  Object.assign(notifyModal.style, {
    position: "fixed",
    background: "#222",
    color: "#fff",
    padding: "15px 18px",
    borderRadius: "10px",
    maxWidth: "280px",
    width: "auto",
    boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
    transformOrigin: "top right",
    opacity: "0",
    pointerEvents: "none",
    transition: "all 0.25s ease",
    zIndex: "99999",
    wordWrap: "break-word",
    overflowWrap: "anywhere",
    boxSizing: "border-box",
  });

  notifyModal.innerHTML = buildModalHTML(text);
  document.body.appendChild(notifyModal);
  openModal();
  attachShareHandler(share);
});

function buildModalHTML(innerText) {
  return `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;text-align:center;">${innerText}</p>
    <button id="shareBtnDynamic" style="
      background:#e60023;
      color:#fff;
      border:none;
      padding:8px 12px;
      border-radius:8px;
      cursor:pointer;
      font-weight:bold;
      width:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      transition:background 0.3s;">
      Share Now
    </button>
    <small id="shareHint" style="display:none; margin-top:8px; text-align:center; font-size:12px; color:#aaa;">
      Share window opened — complete the share to stand a chance!
    </small>
  `;
}

function updateModal(innerText, shareText) {
  notifyModal.innerHTML = buildModalHTML(innerText);
  attachShareHandler(shareText);
}

function attachShareHandler(shareText) {
  const shareHint = notifyModal.querySelector("#shareHint");
  const shareBtn = notifyModal.querySelector("#shareBtnDynamic");

  shareBtn.addEventListener("click", async () => {
    const randomId = "BR-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const idTag = document.createElement("div");
    idTag.textContent = randomId;
    Object.assign(idTag.style, {
      fontFamily: "'Courier New', monospace",
      fontSize: "11px",
      fontStyle: "italic",
      color: "#999",
      marginTop: "6px",
      textAlign: "center",
      letterSpacing: "1px",
    });

    const existingTag = notifyModal.querySelector("div[data-id-tag]");
    if (existingTag) existingTag.remove();
    idTag.dataset.idTag = "true";
    notifyModal.appendChild(idTag);

    const shareData = {
      title: "BilaRed – Skill-Based Fun",
      text: `${shareText}  ...referrer: ${randomId}`,
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareHint.style.display = "block";
      } else {
        alert("Share feature not supported on your browser. Copy the link and share manually!");
      }
    } catch (err) {
      console.log("Share canceled or failed:", err);
    }
  });
}



function openModal() {
  const bellRect = bellWrapper.getBoundingClientRect();
  notifyModal.style.top = `${bellRect.bottom + 8}px`;
  notifyModal.style.right = `${window.innerWidth - bellRect.right}px`;
  notifyModal.style.opacity = "1";
  notifyModal.style.pointerEvents = "auto";
  notifyModal.style.transform = "scale(1) translateY(0)";
}

function closeModal() {
  notifyModal.style.opacity = "0";
  notifyModal.style.pointerEvents = "none";
  notifyModal.style.transform = "scale(0.95) translateY(-10px)";
}

document.addEventListener("click", (e) => {
  if (notifyModal && !bellWrapper.contains(e.target) && !notifyModal.contains(e.target)) {
    closeModal();
  }
});

function resetBadgeRespawn() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => {
    badge.style.display = "inline-block";
  }, BADGE_RESPAWN_INTERVAL);
}

// start initial cycle
resetBadgeRespawn();
