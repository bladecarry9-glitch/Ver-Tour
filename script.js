import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc, 
    query, where, orderBy, onSnapshot, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmrascMIBNuLm78nr6pZXybTG0cqJFmHg",
    authDomain: "appfoe.firebaseapp.com",
    databaseURL: "https://appfoe-default-rtdb.firebaseio.com",
    projectId: "appfoe",
    storageBucket: "appfoe.firebasestorage.app",
    messagingSenderId: "754473691414",
    appId: "1:754473691414:web:0e9cf7c0d8a2d1bf474837"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let messaging = null;
try {
    messaging = getMessaging(app);
} catch (e) {
    console.log("FCM not supported on this platform.");
}

window.currentUser = null;
window.userData = null;
window.activeTab = 'auth';

window.calculateLiveRank = function(points) {
    if (points >= 2500) return { rank: 'Grandmaster', progress: 100, next: 'Max Rank' };
    if (points >= 1800) return { rank: 'Heroic', progress: Math.floor(((points - 1800) / 700) * 100), next: 'Grandmaster (2500 pts)' };
    if (points >= 1200) return { rank: 'Diamond', progress: Math.floor(((points - 1200) / 600) * 100), next: 'Heroic (1800 pts)' };
    if (points >= 800) return { rank: 'Platinum', progress: Math.floor(((points - 800) / 400) * 100), next: 'Diamond (1200 pts)' };
    if (points >= 400) return { rank: 'Gold', progress: Math.floor(((points - 400) / 400) * 100), next: 'Platinum (800 pts)' };
    if (points >= 150) return { rank: 'Silver', progress: Math.floor(((points - 150) / 250) * 100), next: 'Gold (400 pts)' };
    return { rank: 'Bronze', progress: Math.floor((points / 150) * 100), next: 'Silver (150 pts)' };
};

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

window.togglePasswordVisibility = function(fieldId, iconElem) {
    const field = document.getElementById(fieldId);
    if (field.type === 'password') {
        field.type = 'text';
        iconElem.className = 'fa-solid fa-eye-slash toggle-password';
    } else {
        field.type = 'password';
        iconElem.className = 'fa-solid fa-eye toggle-password';
    }
};

window.toggleAuthMode = function(mode) {
    if (mode === 'signup') {
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('signup-form-container').classList.remove('hidden');
    } else {
        document.getElementById('signup-form-container').classList.add('hidden');
        document.getElementById('login-form-container').classList.remove('hidden');
    }
};

window.switchTab = function(tabName) {
    document.getElementById('modal-container').innerHTML = '';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    window.activeTab = tabName;
    
    if (tabName === 'auth') {
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('main-header').style.display = 'none';
        document.getElementById('main-bottom-nav').style.display = 'none';
        return;
    }

    document.getElementById('main-header').style.display = 'flex';
    document.getElementById('main-bottom-nav').style.display = 'flex';

    const targetScreen = document.getElementById(`tab-${tabName}`);
    if (targetScreen) targetScreen.classList.add('active');

    const targetNav = document.getElementById(`nav-${tabName}`);
    if (targetNav) targetNav.classList.add('active');

    if (tabName === 'home') loadHomeData();
    if (tabName === 'tournaments') loadTournaments();
    if (tabName === 'chat') loadGlobalChat();
    if (tabName === 'notifications') loadNotifications();
    if (tabName === 'wallet') loadWalletData();
    if (tabName === 'profile') loadProfileData();
    if (tabName === 'support') loadSupportTickets();
};

window.handleSignup = async function() {
    const ffUid = document.getElementById('signup-ff-uid').value.trim();
    const nickname = document.getElementById('signup-nickname').value.trim();
    const fullName = document.getElementById('signup-fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!ffUid || !nickname || !fullName || !email || !password) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const usersRef = collection(db, 'users');
        const qUid = query(usersRef, where('ffUid', '==', ffUid));
        const snapUid = await getDocs(qUid);
        if (!snapUid.empty) {
            showToast('This Free Fire UID is already registered.', 'error');
            return;
        }

        const qNick = query(usersRef, where('nickname', '==', nickname));
        const snapNick = await getDocs(qNick);
        if (!snapNick.empty) {
            showToast('This nickname is already taken.', 'error');
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            firebaseUid: user.uid,
            ffUid: ffUid,
            nickname: nickname,
            fullName: fullName,
            email: email,
            walletBalance: 0,
            rank: 'Bronze',
            achievementPoints: 0,
            vipStatus: 'VIP 1',
            profilePic: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200',
            isBanned: false,
            createdAt: serverTimestamp()
        });

        showToast('Account created successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.handleLogin = async function() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast('Please enter email and password.', 'error');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Logged in successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
};

window.handleLogout = async function() {
    try {
        await signOut(auth);
        window.currentUser = null;
        window.userData = null;
        switchTab('auth');
        showToast('Logged out successfully.', 'success');
    } catch (error) {
        showToast('Logout failed.', 'error');
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                window.userData = userSnap.data();

                if (window.userData.isBanned) {
                    document.getElementById('ban-reason-text').innerText = window.userData.banReason || 'Policy violation detected.';
                    document.getElementById('ban-screen').classList.remove('hidden');
                    return;
                } else {
                    document.getElementById('ban-screen').classList.add('hidden');
                }

                const points = window.userData.achievementPoints || 0;
                const liveRankData = window.calculateLiveRank(points);
                window.userData.rank = liveRankData.rank;

                document.getElementById('header-nickname').innerText = window.userData.nickname;
                document.getElementById('header-rank').innerText = liveRankData.rank;
                document.getElementById('header-wallet').innerText = `৳${window.userData.walletBalance || 0}`;
                if (window.userData.profilePic) {
                    document.getElementById('header-avatar').src = window.userData.profilePic;
                }

                if (window.activeTab === 'auth') {
                    switchTab('home');
                }
            }
        } catch (err) {
            console.error("Error loading profile:", err);
        }
    } else {
        window.currentUser = null;
        window.userData = null;
        switchTab('auth');
    }
});

async function loadHomeData() {
    if (!window.userData) return;
    const points = window.userData.achievementPoints || 0;
    const liveRankData = window.calculateLiveRank(points);

    document.getElementById('dash-nickname').innerText = window.userData.nickname;
    document.getElementById('dash-ff-uid').innerText = window.userData.ffUid;
    document.getElementById('dash-rank-name').innerText = liveRankData.rank;
    document.getElementById('dash-vip-badge').innerText = window.userData.vipStatus || 'VIP 1';
    if (window.userData.profilePic) {
        document.getElementById('dash-avatar').src = window.userData.profilePic;
    }

    try {
        const noticesSnap = await getDocs(collection(db, 'notices'));
        const noticesContainer = document.getElementById('home-notices-list');
        noticesContainer.innerHTML = '';
        if (noticesSnap.empty) {
            noticesContainer.innerHTML = `<div class="glass-card"><p style="color:var(--text-muted);font-size:0.85rem;">No notices published.</p></div>`;
        } else {
            noticesSnap.forEach(d => {
                const notice = d.data();
                noticesContainer.innerHTML += `
                    <div class="glass-card" style="margin-bottom:8px;">
                        <h4 style="font-size:0.95rem; color:var(--cyan-highlight);">${notice.title}</h4>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${notice.description}</p>
                    </div>
                `;
            });
        }

        const tourneySnap = await getDocs(collection(db, 'tournaments'));
        const featContainer = document.getElementById('home-featured-tournament');
        if (tourneySnap.empty) {
            featContainer.innerHTML = `<div class="glass-card"><p style="color:var(--text-muted);font-size:0.85rem;">No tournaments available right now.</p></div>`;
        } else {
            const tList = [];
            tourneySnap.forEach(t => tList.push({ id: t.id, ...t.data() }));
            const latest = tList[0];
            featContainer.innerHTML = `
                <div class="tournament-card">
                    <img src="${latest.banner || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}" class="tournament-banner" alt="Banner">
                    <div class="tournament-info">
                        <h3 style="font-size:1.1rem; color:var(--electric-blue);">${latest.name}</h3>
                        <div class="match-meta">
                            <span>Mode: ${latest.gameMode}</span>
                            <span>Map: ${latest.mapName}</span>
                        </div>
                        <div class="flex justify-between items-center" style="margin-top:10px;">
                            <span style="color:var(--cyan-highlight); font-weight:700;">Fee: ৳${latest.entryFee}</span>
                            <button class="btn-outline" style="padding:6px 14px; font-size:0.85rem;" onclick="switchTab('tournaments')">View All</button>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error("Error loading home data:", e);
    }
}

window.loadTournaments = async function() {
    const container = document.getElementById('tournaments-list');
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); margin-top:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i><p>Loading tournaments...</p></div>`;

    try {
        const querySnapshot = await getDocs(collection(db, 'tournaments'));
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="glass-card" style="text-align:center; padding:40px;">
                    <i class="fa-solid fa-gamepad" style="font-size:3rem; color:var(--text-muted); margin-bottom:12px;"></i>
                    <p style="color:var(--text-muted); font-size:1rem;">No tournaments available right now.</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const t = docSnap.data();
            const tId = docSnap.id;
            const filled = t.registeredCount || 0;
            const total = t.maxSlots || 48;
            const percent = Math.min(100, (filled / total) * 100);

            container.innerHTML += `
                <div class="tournament-card">
                    <img src="${t.banner || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}" class="tournament-banner" alt="Banner">
                    <div class="tournament-info">
                        <h3 style="font-size:1.2rem; color:var(--electric-blue);">${t.name}</h3>
                        <div class="match-meta">
                            <span><i class="fa-solid fa-crosshairs"></i> ${t.gameMode}</span>
                            <span><i class="fa-solid fa-map"></i> ${t.mapName}</span>
                            <span><i class="fa-solid fa-calendar"></i> ${t.matchTime || 'Soon'}</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin: 6px 0;">${t.description || ''}</p>
                        <div class="flex justify-between" style="font-size:0.8rem; color:var(--text-muted);">
                            <span>Slots Available</span>
                            <span>${filled}/${total}</span>
                        </div>
                        <div class="slots-progress">
                            <div class="slots-fill" style="width: ${percent}%;"></div>
                        </div>
                        <div class="flex justify-between items-center" style="margin-top:12px;">
                            <div>
                                <span style="font-size:0.75rem; color:var(--text-muted);">Entry Fee</span>
                                <h4 style="color:var(--cyan-highlight); font-size:1.1rem;">৳${t.entryFee}</h4>
                            </div>
                            <button class="btn-primary" style="width:auto; padding:10px 20px;" onclick="openJoinTournamentModal('${tId}', '${t.name}', ${t.entryFee})">Join Match</button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        container.innerHTML = `<div class="glass-card"><p style="color:var(--danger); text-align:center;">Failed to load tournaments.</p></div>`;
    }
};

window.openJoinTournamentModal = function(tournamentId, name, fee) {
    if (window.userData.isBanned) {
        showToast('Your account is banned. You cannot join tournaments.', 'error');
        return;
    }

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <h2 class="brand-font" style="font-size:1.2rem; color:var(--electric-blue); margin-bottom:12px;">Confirm Registration</h2>
                <p style="font-size:0.9rem; margin-bottom:8px;">Tournament: <b>${name}</b></p>
                <p style="font-size:0.9rem; margin-bottom:8px;">Entry Fee: <span style="color:var(--cyan-highlight); font-weight:700;">৳${fee}</span></p>
                <p style="font-size:0.9rem; margin-bottom:16px;">Your Balance: <b>৳${window.userData.walletBalance || 0}</b></p>
                <div class="flex gap-2">
                    <button class="btn-outline" style="flex:1;" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
                    <button class="btn-primary" style="flex:1;" onclick="confirmJoinTournament('${tournamentId}', ${fee})">Confirm & Pay</button>
                </div>
            </div>
        </div>
    `;
};

window.confirmJoinTournament = async function(tournamentId, fee) {
    if ((window.userData.walletBalance || 0) < fee) {
        showToast('Insufficient wallet balance. Please add money.', 'error');
        document.getElementById('modal-container').innerHTML = '';
        return;
    }

    try {
        const newBalance = window.userData.walletBalance - fee;
        await updateDoc(doc(db, 'users', window.currentUser.uid), {
            walletBalance: newBalance
        });
        window.userData.walletBalance = newBalance;
        document.getElementById('header-wallet').innerText = `৳${newBalance}`;

        await addDoc(collection(db, 'registrations'), {
            tournamentId: tournamentId,
            userId: window.currentUser.uid,
            ffUid: window.userData.ffUid,
            nickname: window.userData.nickname,
            joinedAt: serverTimestamp()
        });

        document.getElementById('modal-container').innerHTML = '';
        showToast('Tournament registration confirmed!', 'success');
        loadTournaments();
    } catch (e) {
        showToast('Registration failed: ' + e.message, 'error');
    }
};

window.loadWalletData = async function() {
    if (!window.userData) return;
    document.getElementById('wallet-balance-amount').innerText = `৳${window.userData.walletBalance || 0}`;

    const txListContainer = document.getElementById('transaction-history-list');
    try {
        const q = query(collection(db, 'transactions'), where('userId', '==', window.currentUser.uid));
        const querySnapshot = await getDocs(q);
        txListContainer.innerHTML = '';
        if (querySnapshot.empty) {
            txListContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; margin-top:20px;">No transactions recorded yet.</p>`;
            return;
        }
        querySnapshot.forEach(docSnap => {
            const tx = docSnap.data();
            let color = 'var(--warning)';
            if (tx.status === 'Approved') color = 'var(--success)';
            if (tx.status === 'Rejected') color = 'var(--danger)';

            txListContainer.innerHTML += `
                <div class="glass-card" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <p style="font-size:0.9rem; font-weight:600;">${tx.method.toUpperCase()} - ৳${tx.amount}</p>
                        <p style="font-size:0.75rem; color:var(--text-muted);">TrxID: ${tx.trxId}</p>
                    </div>
                    <span style="font-size:0.8rem; font-weight:700; color:${color};">${tx.status}</span>
                </div>
            `;
        });
    } catch (e) {
        console.error("Error loading transactions:", e);
    }
};

window.openAddMoneyModal = async function() {
    let bkashNum = "01700000000";
    let nagadNum = "01800000000";
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'paymentNumbers'));
        if (settingsDoc.exists()) {
            bkashNum = settingsDoc.data().bkash || bkashNum;
            nagadNum = settingsDoc.data().nagad || nagadNum;
        }
    } catch(e) {}

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-card">
                <h2 class="brand-font" style="font-size:1.2rem; color:var(--cyan-highlight); margin-bottom:12px;">Add Money Instructions</h2>
                
                <div style="background: rgba(0, 240, 255, 0.05); border: 1px dashed var(--electric-blue); padding: 10px; border-radius: 10px; margin-bottom: 14px; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                    <b style="color:var(--text-main);">How to Add Money:</b><br>
                    1. Select bKash or Nagad below.<br>
                    2. Copy the active number and complete a <b>Send Money</b> from your personal app.<br>
                    3. Enter the exact amount sent and paste your unique <b>TrxID</b> below.
                </div>

                <div class="input-group">
                    <label>Select Payment Method</label>
                    <select id="payment-method-select" onchange="updatePaymentNumberDisplay('${bkashNum}', '${nagadNum}')">
                        <option value="bkash">bKash (Send Money)</option>
                        <option value="nagad">Nagad (Send Money)</option>
                    </select>
                </div>

                <div class="input-group">
                    <label>Agent / Personal Number to Send Money</label>
                    <div class="flex gap-2">
                        <input type="text" id="active-payment-number-field" readonly value="${bkashNum}" style="font-weight:700; color:var(--cyan-highlight); background: rgba(0,255,204,0.05);">
                        <button type="button" class="btn-outline" style="padding: 0 14px; white-space: nowrap;" onclick="copyPaymentNumber()"><i class="fa-solid fa-copy"></i> Copy</button>
                    </div>
                </div>

                <div class="input-group">
                    <label>Amount Sent (BDT)</label>
                    <input type="number" id="deposit-amount" placeholder="e.g. 500">
                </div>

                <div class="input-group">
                    <label>Transaction ID (TrxID)</label>
                    <input type="text" id="deposit-trxid" placeholder="Enter Transaction ID">
                </div>

                <div class="flex gap-2">
                    <button class="btn-outline" style="flex:1;" onclick="document.getElementById('modal-container').innerHTML = ''">Cancel</button>
                    <button class="btn-primary" style="flex:1;" onclick="submitDepositRequest()">Submit Request</button>
                </div>
            </div>
        </div>
    `;
};

window.updatePaymentNumberDisplay = function(bkashNum, nagadNum) {
    const method = document.getElementById('payment-method-select').value;
    const field = document.getElementById('active-payment-number-field');
    if (field) {
        field.value = method === 'bkash' ? bkashNum : nagadNum;
    }
};

window.copyPaymentNumber = function() {
    const field = document.getElementById('active-payment-number-field');
    if (field) {
        navigator.clipboard.writeText(field.value);
        showToast('Number copied to clipboard!', 'success');
    }
};

window.submitDepositRequest = async function() {
    const method = document.getElementById('payment-method-select').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const trxId = document.getElementById('deposit-trxid').value.trim();

    if (!amount || amount <= 0 || !trxId) {
        showToast('Please enter a valid amount and TrxID.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'transactions'), {
            userId: window.currentUser.uid,
            nickname: window.userData.nickname,
            ffUid: window.userData.ffUid,
            method: method,
            amount: amount,
            trxId: trxId,
            status: 'Pending',
            createdAt: serverTimestamp()
        });

        document.getElementById('modal-container').innerHTML = '';
        showToast('Payment request submitted. Pending verification.', 'success');
        loadWalletData();
    } catch (e) {
        showToast('Failed to submit deposit request.', 'error');
    }
};

let chatUnsubscribe = null;
window.loadGlobalChat = function() {
    if (chatUnsubscribe) chatUnsubscribe();

    const chatBox = document.getElementById('chat-messages-box');
    chatBox.innerHTML = '';

    const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'asc'));
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = '';
        if (snapshot.empty) {
            chatBox.innerHTML = `<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; margin-top:20px;">No messages yet. Say hello!</p>`;
            return;
        }
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const isAdminNotice = msg.isAdminNotice || false;
            chatBox.innerHTML += `
                <div class="chat-msg ${isAdminNotice ? 'admin-notice' : ''}">
                    <div class="flex justify-between items-center" style="margin-bottom:4px;">
                        <span style="font-size:0.75rem; font-weight:700; color:${isAdminNotice ? 'var(--cyan-highlight)' : 'var(--electric-blue)'};">${msg.nickname} (${msg.vipStatus || 'VIP 1'})</span>
                        <span style="font-size:0.65rem; color:var(--text-muted);">${msg.rank || 'Bronze'}</span>
                    </div>
                    <p style="font-size:0.9rem; word-break:break-word;">${msg.text}</p>
                </div>
            `;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
};

window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    if (window.userData.isBanned) {
        showToast('Your account is banned. Chat restricted.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'globalChat'), {
            userId: window.currentUser.uid,
            nickname: window.userData.nickname,
            rank: window.userData.rank,
            vipStatus: window.userData.vipStatus,
            text: text,
            createdAt: serverTimestamp()
        });
        input.value = '';
    } catch (e) {
        showToast('Failed to send message.', 'error');
    }
};

window.loadNotifications = async function() {
    const container = document.getElementById('notifications-list');
    try {
        const q = query(collection(db, 'notifications'), where('userId', '==', window.currentUser.uid));
        const querySnapshot = await getDocs(q);
        container.innerHTML = '';
        if (querySnapshot.empty) {
            container.innerHTML = `<div class="glass-card" style="text-align:center;"><p style="color:var(--text-muted);">No notifications available.</p></div>`;
            return;
        }
        querySnapshot.forEach(docSnap => {
            const n = docSnap.data();
            container.innerHTML += `
                <div class="glass-card" style="margin-bottom:8px; border-left:4px solid var(--electric-blue);">
                    <h4 style="font-size:0.95rem; color:var(--text-main);">${n.title}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${n.message}</p>
                </div>
            `;
        });
        document.getElementById('notification-dot').classList.add('hidden');
    } catch (e) {
        container.innerHTML = `<div class="glass-card"><p style="color:var(--text-muted); text-align:center;">Failed to load notifications.</p></div>`;
    }
};

window.markAllNotificationsRead = function() {
    document.getElementById('notification-dot').classList.add('hidden');
    showToast('All notifications marked as read.', 'success');
};

window.loadProfileData = function() {
    if (!window.userData) return;
    const points = window.userData.achievementPoints || 0;
    const liveRankData = window.calculateLiveRank(points);

    document.getElementById('profile-nickname').innerText = window.userData.nickname;
    document.getElementById('profile-fullname').innerText = window.userData.fullName;
    document.getElementById('profile-ff-uid').innerText = window.userData.ffUid;
    document.getElementById('profile-fb-uid').innerText = window.currentUser.uid;
    
    document.getElementById('profile-rank-name').innerText = liveRankData.rank;
    document.getElementById('profile-points').innerText = points;
    document.getElementById('profile-rank-progress').style.width = `${liveRankData.progress}%`;
    document.getElementById('profile-next-rank-info').innerText = `Next Target: ${liveRankData.next}`;

    document.getElementById('profile-vip-status').innerText = window.userData.vipStatus || 'VIP 1';
    if (window.userData.profilePic) {
        document.getElementById('profile-avatar').src = window.userData.profilePic;
    }
};

window.updateProfilePicture = async function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Img = e.target.result;
            document.getElementById('profile-avatar').src = base64Img;
            document.getElementById('dash-avatar').src = base64Img;
            document.getElementById('header-avatar').src = base64Img;

            try {
                await updateDoc(doc(db, 'users', window.currentUser.uid), {
                    profilePic: base64Img
                });
                window.userData.profilePic = base64Img;
                showToast('Profile picture updated successfully!', 'success');
            } catch(err) {
                showToast('Failed to save profile picture.', 'error');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.loadSupportTickets = async function() {
    const container = document.getElementById('support-tickets-list');
    try {
        const q = query(collection(db, 'supportMessages'), where('userId', '==', window.currentUser.uid));
        const snapshot = await getDocs(q);
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">No support tickets submitted.</p>`;
            return;
        }
        snapshot.forEach(docSnap => {
            const ticket = docSnap.data();
            container.innerHTML += `
                <div class="glass-card" style="margin-bottom:8px;">
                    <div class="flex justify-between items-center" style="margin-bottom:4px;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--electric-blue); text-transform:uppercase;">[${ticket.type}]</span>
                        <span style="font-size:0.75rem; color:${ticket.reply ? 'var(--success)' : 'var(--warning)'};">${ticket.reply ? 'Replied' : 'Pending'}</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-main);"><b>You:</b> ${ticket.message}</p>
                    ${ticket.reply ? `<p style="font-size:0.85rem; color:var(--cyan-highlight); margin-top:4px;"><b>Admin Reply:</b> ${ticket.reply}</p>` : ''}
                </div>
            `;
        });
    } catch(e) {}
};

window.submitSupportTicket = async function() {
    const type = document.getElementById('support-type').value;
    const message = document.getElementById('support-msg').value.trim();

    if (!message) {
        showToast('Please enter your support message.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'supportMessages'), {
            userId: window.currentUser.uid,
            nickname: window.userData.nickname,
            ffUid: window.userData.ffUid,
            type: type,
            message: message,
            reply: '',
            createdAt: serverTimestamp()
        });

        document.getElementById('support-msg').value = '';
        showToast('Support ticket submitted successfully!', 'success');
        loadSupportTickets();
    } catch (e) {
        showToast('Failed to submit support ticket.', 'error');
    }
};
