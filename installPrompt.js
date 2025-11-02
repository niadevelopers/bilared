 // public/installPrompt.js
window.addEventListener('load', () => {
  let deferredPrompt = null;

  // Only show prompt if not previously installed
  if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('pwaInstalled')) {
    return; // Already installed
  }

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevent automatic prompt
    deferredPrompt = e;

    // Show our custom prompt after 3.5 seconds
    setTimeout(showCustomInstallPrompt, 3500);
  });

  function showCustomInstallPrompt() {
    // Create overlay div
    const overlay = document.createElement('div');
    overlay.id = 'pwa-install-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '9999'
    });

    // Create prompt box
    const box = document.createElement('div');
    Object.assign(box.style, {
      backgroundColor: '#49cbf2ff',
      padding: '20px',
      borderRadius: '12px',
      width: '90%',
      maxWidth: '400px',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      fontFamily: 'Arial, sans-serif'
    });

    // Add content
    const title = document.createElement('h2');
    title.innerText = 'Install Our App?';
    title.style.marginBottom = '12px';
    const message = document.createElement('p');
    message.innerText = 'Get quick access by installing this app on your device.';
    message.style.marginBottom = '20px';
    
    // Buttons
    const btnInstall = document.createElement('button');
    btnInstall.innerText = 'Install';
    Object.assign(btnInstall.style, {
      padding: '10px 20px',
      marginRight: '10px',
      backgroundColor: '#4f46e5',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer'
    });

    const btnCancel = document.createElement('button');
    btnCancel.innerText = 'Cancel';
    Object.assign(btnCancel.style, {
      padding: '10px 20px',
      backgroundColor: '#ddd',
      color: '#333',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer'
    });

    // Button logic
    btnInstall.addEventListener('click', async () => {
      overlay.remove();
      if (deferredPrompt) {
        deferredPrompt.prompt(); // Show native install prompt
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('PWA installed');
          localStorage.setItem('pwaInstalled', 'true');
        }
        deferredPrompt = null;
      }
    });

    btnCancel.addEventListener('click', () => {
      overlay.remove();
      console.log('User dismissed install prompt');
    });

    // Append elements
    box.appendChild(title);
    box.appendChild(message);
    box.appendChild(btnInstall);
    box.appendChild(btnCancel);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // Detect if user installed PWA via native prompt (some browsers)
  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    localStorage.setItem('pwaInstalled', 'true');
  });
});
