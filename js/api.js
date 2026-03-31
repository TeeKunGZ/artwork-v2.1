// =============================================================================
// Constants & Custom Dialog System
// =============================================================================
const API_BASE = "/api";

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function closeCustomDialog() {
    document.getElementById('customDialogOverlay').classList.add('hidden');
    document.getElementById('customAlertBox').classList.add('hidden');
    document.getElementById('customConfirmBox').classList.add('hidden');
    document.getElementById('customPromptBox').classList.add('hidden');
}

window.customAlert = (message, type = 'info') => {
    return new Promise((resolve) => {
        document.getElementById('customDialogOverlay').classList.remove('hidden');
        document.getElementById('customAlertBox').classList.remove('hidden');
        
        const titleEl = document.getElementById('customAlertTitle');
        const msgEl = document.getElementById('customAlertMessage');
        const iconEl = document.getElementById('customAlertIcon');
        
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        
        if (type === 'error') {
            titleEl.textContent = 'เกิดข้อผิดพลาด';
            titleEl.className = 'text-lg font-bold text-red-600 mb-2';
            iconEl.innerHTML = '<div class="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100"><i class="fa-solid fa-triangle-exclamation text-red-600 text-2xl"></i></div>';
        } else if (type === 'success') {
            titleEl.textContent = 'สำเร็จ';
            titleEl.className = 'text-lg font-bold text-emerald-600 mb-2';
            iconEl.innerHTML = '<div class="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100"><i class="fa-solid fa-check text-emerald-600 text-2xl"></i></div>';
        } else if (type === 'warning') {
            titleEl.textContent = 'แจ้งเตือน';
            titleEl.className = 'text-lg font-bold text-amber-600 mb-2';
            iconEl.innerHTML = '<div class="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-amber-100"><i class="fa-solid fa-circle-exclamation text-amber-600 text-2xl"></i></div>';
        } else {
            titleEl.textContent = 'ข้อความระบบ';
            titleEl.className = 'text-lg font-bold text-indigo-600 mb-2';
            iconEl.innerHTML = '<div class="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-indigo-100"><i class="fa-solid fa-circle-info text-indigo-600 text-2xl"></i></div>';
        }

        const btn = document.getElementById('customAlertBtn');
        btn.onclick = () => { closeCustomDialog(); resolve(); };
    });
};

window.customConfirm = (message, title = 'ยืนยันการดำเนินการ', type = 'warning') => {
    return new Promise((resolve) => {
        document.getElementById('customDialogOverlay').classList.remove('hidden');
        document.getElementById('customConfirmBox').classList.remove('hidden');
        
        document.getElementById('customConfirmTitle').textContent = title;
        document.getElementById('customConfirmMessage').innerHTML = message.replace(/\n/g, '<br>');
        
        const btnCancel = document.getElementById('customConfirmCancel');
        const btnOk = document.getElementById('customConfirmOk');
        
        if(type === 'danger') {
            btnOk.className = "flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition shadow-md";
        } else {
            btnOk.className = "flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow-md";
        }

        btnCancel.onclick = () => { closeCustomDialog(); resolve(false); };
        btnOk.onclick = () => { closeCustomDialog(); resolve(true); };
    });
};

window.customPrompt = (message, title = 'กรอกข้อมูล', placeholder = '') => {
    return new Promise((resolve) => {
        document.getElementById('customDialogOverlay').classList.remove('hidden');
        document.getElementById('customPromptBox').classList.remove('hidden');
        
        document.getElementById('customPromptTitle').textContent = title;
        document.getElementById('customPromptMessage').innerHTML = message.replace(/\n/g, '<br>');
        
        const inputEl = document.getElementById('customPromptInput');
        inputEl.value = '';
        inputEl.placeholder = placeholder;
        inputEl.focus();
        
        const btnCancel = document.getElementById('customPromptCancel');
        const btnOk = document.getElementById('customPromptOk');
        
        btnCancel.onclick = () => { closeCustomDialog(); resolve(null); };
        btnOk.onclick = () => { closeCustomDialog(); resolve(inputEl.value); };
        
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') { closeCustomDialog(); resolve(inputEl.value); }
        };
    });
};

// =============================================================================
// Auth & User Profile API
// =============================================================================
function getAuthToken() { return localStorage.getItem("artportal_token"); }

function logout() {
    localStorage.removeItem("artportal_token");
    document.getElementById("loginModal").classList.remove("hidden");
    ["loginEmpId", "loginPassword"].forEach(id => document.getElementById(id).value = "");
    ["adminModal", "changePasswordModal", "editUserModal"].forEach(id => document.getElementById(id).classList.add("hidden"));
}

async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    if (!token) { logout(); throw new Error("No token found"); }
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, options);
    if (res.status === 401) { logout(); throw new Error("Token expired"); }
    return res;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnLogin");
    const errorBox = document.getElementById("loginError");
    setBtn(btn, true, "กำลังตรวจสอบ...");
    errorBox.classList.add("hidden");
    
    const fd = new FormData();
    fd.append("username", document.getElementById("loginEmpId").value);
    fd.append("password", document.getElementById("loginPassword").value);
    
    try {
        const res = await fetch("/api/login", { method: "POST", body: fd });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem("artportal_token", data.access_token);
            document.getElementById("loginModal").classList.add("hidden");
            setupUserProfile(data.user);
            loadMasterTeamsForMapping();
            autoLoadTemplate();
        } else {
            errorBox.textContent = (await res.json()).detail || "เข้าสู่ระบบไม่สำเร็จ";
            errorBox.classList.remove("hidden");
        }
    } catch (e) { 
        errorBox.textContent = "ไม่สามารถเชื่อมต่อ Server ได้"; 
        errorBox.classList.remove("hidden"); 
    }
    setBtn(btn, false, `เข้าสู่ระบบ <i class="fa-solid fa-arrow-right-to-bracket ml-2"></i>`);
});

function setupUserProfile(user) {
    document.getElementById("userNameDisplay").textContent = `${user.first_name} ${user.last_name || ''}`;
    document.getElementById("userTeamDisplay").textContent = `Team: ${user.team_name} | Role: ${user.role.toUpperCase()}`;
    document.getElementById("userInitial").textContent = user.first_name.charAt(0).toUpperCase();
    document.getElementById("btnAdminMenu").classList.toggle("hidden", user.role !== 'admin');
}

window.openChangePasswordModal = () => { 
    document.getElementById("changePasswordModal").classList.remove("hidden"); 
    document.getElementById("changePasswordForm").reset(); 
    document.getElementById("cpError").classList.add("hidden"); 
};
window.closeChangePasswordModal = () => { document.getElementById("changePasswordModal").classList.add("hidden"); };

document.getElementById("changePasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnChangePassword"); 
    const errBox = document.getElementById("cpError");
    setBtn(btn, true); 
    errBox.classList.add("hidden");
    
    const fd = new FormData(); 
    fd.append("old_password", document.getElementById("cpOldPassword").value); 
    fd.append("new_password", document.getElementById("cpNewPassword").value);
    
    try {
        const res = await fetchWithAuth("/api/users/me/password", { method: "PUT", body: fd });
        if (res.ok) { 
            await customAlert("เปลี่ยนรหัสผ่านสำเร็จ!", "success"); 
            closeChangePasswordModal(); 
        } else { 
            errBox.textContent = (await res.json()).message || "เปลี่ยนไม่สำเร็จ"; 
            errBox.classList.remove("hidden"); 
        }
    } catch (e) { 
        errBox.textContent = "ไม่สามารถเชื่อมต่อระบบได้"; 
        errBox.classList.remove("hidden"); 
    }
    setBtn(btn, false, "ยืนยันการเปลี่ยนรหัสผ่าน");
});

// =============================================================================
// Admin Dashboard
// =============================================================================
window.setRoleUI = (form, role) => {
    document.getElementById(`${form}Role`).value = role;
    const btnUser = document.getElementById(`btn-${form}Role-user`);
    const btnAdmin = document.getElementById(`btn-${form}Role-admin`);
    const activeClass = "flex-1 py-1.5 px-3 rounded-lg text-sm font-bold border transition-all bg-indigo-50 border-indigo-400 text-indigo-700 ring-1 ring-indigo-400 shadow-sm";
    const inactiveClass = "flex-1 py-1.5 px-3 rounded-lg text-sm font-bold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all";
    
    if (role === 'admin') { 
        btnAdmin.className = activeClass; 
        btnUser.className = inactiveClass; 
    } else { 
        btnUser.className = activeClass; 
        btnAdmin.className = inactiveClass; 
    }
};

window.openAdminModal = async () => {
    document.getElementById("adminModal").classList.remove("hidden");
    switchAdminTab('users');
    await loadAdminTeams(); 
    await loadAdminUsers();
    // Start AI Monitor SSE stream
    if (typeof AI_MONITOR !== 'undefined') AI_MONITOR.connect();
};
window.closeAdminModal = () => {
    document.getElementById("adminModal").classList.add("hidden");
};

window.switchAdminTab = (tab) => {
    const tabs = ['users', 'teams', 'ai'];
    tabs.forEach(t => {
        const panel = document.getElementById("adminTab" + t.charAt(0).toUpperCase() + t.slice(1));
        if (panel) panel.classList.toggle("hidden", tab !== t);
    });

    const activeClass  = "px-4 py-2 rounded-lg font-bold text-sm bg-indigo-100 text-indigo-700 transition";
    const inactiveClass = "px-4 py-2 rounded-lg font-bold text-sm text-slate-500 hover:bg-slate-100 transition";
    const btnMap = { users: "tabUsersBtn", teams: "tabTeamsBtn", ai: "tabAiBtn" };
    Object.entries(btnMap).forEach(([t, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        // preserve icon/badge children for ai tab
        if (id === "tabAiBtn") {
            btn.className = tab === t ? activeClass + " flex items-center gap-1.5" : inactiveClass + " flex items-center gap-1.5";
        } else {
            btn.className = tab === t ? activeClass : inactiveClass;
        }
    });
};

async function loadAdminTeams() {
    const list = document.getElementById("adminTeamsList");
    const ddAdd = document.getElementById("addTeamName");
    const ddEdit = document.getElementById("editTeamName");
    list.innerHTML = `<p class="col-span-2 text-center text-slate-400 text-xs py-4"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดชื่อทีม...</p>`;
    
    try {
        const res = await fetchWithAuth("/api/teams");
        const teams = await res.json();
        list.innerHTML = ""; 
        ddAdd.innerHTML = `<option value="">-- เลือกทีม --</option>`; 
        ddEdit.innerHTML = `<option value="">-- เลือกทีม --</option>`;
        
        teams.forEach(t => {
            const safeName = escapeHtml(t.name);
            list.insertAdjacentHTML('beforeend', `
                <div class="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                    <span class="font-bold text-slate-700 text-sm"><i class="fa-solid fa-hashtag text-indigo-300 mr-2"></i>${safeName}</span>
                    <button onclick="deleteTeam(${Number(t.id)}, '${safeName}')" class="text-slate-300 hover:text-red-500 p-1 transition" title="ลบชื่อทีมนี้"><i class="fa-solid fa-trash"></i></button>
                </div>
            `);
            ddAdd.insertAdjacentHTML('beforeend', `<option value="${safeName}">${safeName}</option>`);
            ddEdit.insertAdjacentHTML('beforeend', `<option value="${safeName}">${safeName}</option>`);
        });
        if(teams.length === 0) list.innerHTML = `<p class="col-span-2 text-center text-slate-400 text-xs py-4">ยังไม่มีชื่อทีมในระบบ</p>`;
    } catch (e) { list.innerHTML = `<p class="col-span-2 text-center text-red-500 text-xs py-4">ดึงข้อมูลทีมล้มเหลว</p>`; }
}

document.getElementById("addTeamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnAddTeam"); 
    setBtn(btn, true);
    
    const fd = new FormData(); 
    fd.append("name", document.getElementById("addTeamNameInput").value);
    
    try {
        const res = await fetchWithAuth("/api/admin/teams", { method: "POST", body: fd });
        if (res.ok) {
            document.getElementById("addTeamNameInput").value = "";
            await loadAdminTeams();
            loadMasterTeamsForMapping(); 
        } else {
            await customAlert(`Error: ${(await res.json()).message}`, "error");
        }
    } catch (e) {}
    setBtn(btn, false, `<i class="fa-solid fa-plus mr-2"></i> บันทึกชื่อทีม`);
});

window.deleteTeam = async (id, name) => {
    if(!(await customConfirm(`ลบชื่อทีม [ ${name} ] ออกจากระบบ Master หรือไม่?`, "ลบข้อมูล", "danger"))) return;
    try {
        const res = await fetchWithAuth(`/api/admin/teams/${id}`, { method: "DELETE" });
        if (res.ok) { 
            await loadAdminTeams(); 
            loadMasterTeamsForMapping(); 
        }
    } catch (e) { await customAlert("Network Error", "error"); }
};

async function loadMasterTeamsForMapping() {
    try {
        const res = await fetchWithAuth("/api/teams");
        if(res.ok) {
            const teams = await res.json();
            const dl = document.getElementById("masterTeamList"); 
            dl.innerHTML = "";
            teams.forEach(t => dl.insertAdjacentHTML('beforeend', `<option value="${t.name}">`));
        }
    } catch(e){}
}

async function loadAdminUsers() {
    const list = document.getElementById("adminUsersList");
    list.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังดึงข้อมูล...</td></tr>`;
    try {
        const res = await fetchWithAuth("/api/admin/users");
        const users = await res.json();
        list.innerHTML = "";
        
        users.forEach(u => {
            const statusBadge = u.is_active 
                ? `<span class="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1 rounded-full font-black border border-emerald-200">ACTIVE</span>` 
                : `<span class="bg-red-100 text-red-700 text-[10px] px-3 py-1 rounded-full font-black border border-red-200">INACTIVE</span>`;
                
            const toggleActionBtn = u.is_active 
                ? `<button onclick="toggleUserStatus('${u.emp_id}', 1)" class="w-full mt-2 bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 px-2 py-1.5 rounded-lg text-[10px] font-bold transition shadow-sm"><i class="fa-solid fa-ban mr-1"></i> ระงับบัญชี</button>` 
                : `<button onclick="toggleUserStatus('${u.emp_id}', 0)" class="w-full mt-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-300 px-2 py-1.5 rounded-lg text-[10px] font-bold transition shadow-sm"><i class="fa-solid fa-check mr-1"></i> เปิดใช้งาน</button>`;
                
            const roleBadge = u.role === 'admin' 
                ? `<span class="text-xs font-bold text-indigo-600"><i class="fa-solid fa-user-shield mr-1"></i> Admin</span>` 
                : `<span class="text-xs font-bold text-slate-600"><i class="fa-solid fa-user mr-1"></i> User</span>`;
                
            const lastLogin = u.last_login ? new Date(u.last_login).toLocaleString('th-TH') : '-';
            
            const safeEmpId = escapeHtml(u.emp_id);
            const safeFirst = escapeHtml(u.first_name);
            const safeLast  = escapeHtml(u.last_name || '');
            const safeTeam  = escapeHtml(u.team_name);
            const userDataAttr = escapeHtml(JSON.stringify(u));

            list.insertAdjacentHTML('beforeend', `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td class="p-3 font-bold text-slate-700">${safeEmpId}</td>
                    <td class="p-3">
                        <p class="font-bold text-slate-800 text-sm">${safeFirst} ${safeLast}</p>
                        <p class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-users text-slate-300 mr-1"></i> ทีม: ${safeTeam}</p>
                        <p class="text-[10px] text-slate-400"><i class="fa-regular fa-clock mr-1"></i> ล่าสุด: ${lastLogin}</p>
                    </td>
                    <td class="p-3">
                        <div class="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg">
                            <div class="flex items-center gap-2 mb-1">${roleBadge} ${statusBadge}</div>
                            ${toggleActionBtn}
                        </div>
                    </td>
                    <td class="p-3 text-center">
                        <div class="flex justify-center gap-2">
                            <button data-user="${userDataAttr}" onclick="openEditUserModal(JSON.parse(this.dataset.user))" class="w-8 h-8 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded transition shadow-sm bg-white" title="แก้ไขข้อมูลพนักงาน"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="resetUserPassword('${safeEmpId}')" class="w-8 h-8 flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 rounded transition shadow-sm bg-white" title="รีเซ็ตรหัสผ่าน"><i class="fa-solid fa-key"></i></button>
                            <button onclick="deleteUser('${safeEmpId}')" class="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition shadow-sm bg-white" title="ลบบัญชีถาวร"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `);
        });
    } catch (e) { list.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`; }
}

document.getElementById("addUserForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnAddUser"); 
    setBtn(btn, true);
    
    const fd = new FormData();
    fd.append("emp_id", document.getElementById("addEmpId").value); 
    fd.append("password", document.getElementById("addPassword").value);
    fd.append("first_name", document.getElementById("addFirstName").value); 
    fd.append("last_name", document.getElementById("addLastName").value);
    fd.append("team_name", document.getElementById("addTeamName").value); 
    fd.append("role", document.getElementById("addRole").value);
    
    try {
        const res = await fetchWithAuth("/api/admin/users", { method: "POST", body: fd });
        if (res.ok) { 
            await customAlert("เพิ่มผู้ใช้งานสำเร็จ!", "success"); 
            document.getElementById("addUserForm").reset(); 
            setRoleUI('add','user'); 
            await loadAdminUsers(); 
        } else {
            const err = await res.json(); 
            let msg = err.message || err.detail || "เกิดข้อผิดพลาด"; 
            if (Array.isArray(msg)) msg = "กรอกข้อมูลไม่ครบถ้วน";
            await customAlert(`Error: ${msg}`, "error");
        }
    } catch (e) { await customAlert("Cannot connect to server", "error"); }
    setBtn(btn, false, "เพิ่มบัญชีนี้ลงระบบ");
});

window.openEditUserModal = (u) => {
    document.getElementById("editEmpId").value = u.emp_id; 
    document.getElementById("editFirstName").value = u.first_name;
    document.getElementById("editLastName").value = u.last_name || ""; 
    document.getElementById("editTeamName").value = u.team_name;
    setRoleUI('edit', u.role); 
    document.getElementById("editUserModal").classList.remove("hidden");
};
window.closeEditUserModal = () => { document.getElementById("editUserModal").classList.add("hidden"); };

document.getElementById("editUserForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitEditUser"); 
    setBtn(btn, true);
    
    const empId = document.getElementById("editEmpId").value;
    const fd = new FormData();
    fd.append("first_name", document.getElementById("editFirstName").value); 
    fd.append("last_name", document.getElementById("editLastName").value);
    fd.append("team_name", document.getElementById("editTeamName").value); 
    fd.append("role", document.getElementById("editRole").value);
    
    try {
        const res = await fetchWithAuth(`/api/admin/users/${empId}`, { method: "PUT", body: fd });
        if (res.ok) { 
            await customAlert("บันทึกการแก้ไขสำเร็จ!", "success"); 
            closeEditUserModal(); 
            await loadAdminUsers(); 
        } else {
            await customAlert(`Error: ${(await res.json()).message || "เกิดข้อผิดพลาด"}`, "error");
        }
    } catch (e) { await customAlert("Network Error", "error"); }
    setBtn(btn, false, "บันทึกการแก้ไข");
});

window.deleteUser = async (empId) => {
    if (!(await customConfirm(`⚠️ คำเตือน! ลบบัญชี [ ${empId} ] ถาวรหรือไม่?\n(ข้อมูลจะไม่สามารถกู้คืนได้)`, "ลบบัญชีผู้ใช้", "danger"))) return;
    try {
        const res = await fetchWithAuth(`/api/admin/users/${empId}`, { method: "DELETE" });
        if (res.ok) { 
            await customAlert("ลบบัญชีเรียบร้อยแล้ว", "success"); 
            await loadAdminUsers(); 
        } else {
            await customAlert(`Error: ${(await res.json()).message}`, "error");
        }
    } catch (e) { await customAlert("Network Error", "error"); }
};

window.toggleUserStatus = async (empId, currentStatus) => {
    const action = currentStatus ? "ระงับการใช้งาน" : "เปิดใช้งาน";
    if (!(await customConfirm(`ยืนยันการ ${action} บัญชี [ ${empId} ] ?`, "เปลี่ยนสถานะบัญชี"))) return;
    try {
        const res = await fetchWithAuth(`/api/admin/users/${empId}/status`, { method: "PUT" });
        if (res.ok) await loadAdminUsers();
        else await customAlert(`Error: ${(await res.json()).message}`, "error");
    } catch (e) { await customAlert("Network Error", "error"); }
};

window.resetUserPassword = async (empId) => {
    const newPw = await customPrompt(`กรุณาตั้งรหัสผ่านใหม่สำหรับพนักงาน [ ${empId} ] :`, "รีเซ็ตรหัสผ่าน");
    if (!newPw) return;
    
    const fd = new FormData(); 
    fd.append("new_password", newPw);
    
    try {
        const res = await fetchWithAuth(`/api/admin/users/${empId}/reset-password`, { method: "PUT", body: fd });
        if (res.ok) await customAlert("เปลี่ยนรหัสผ่านให้พนักงานสำเร็จ!", "success");
        else await customAlert("เกิดข้อผิดพลาด", "error");
    } catch (e) { await customAlert("Network Error", "error"); }
    
};

window.trainAIModel = async () => {
    if (!(await customConfirm("ระบบจะทำการอ่านรูปภาพทั้งหมดในประวัติเพื่อสร้างสมองให้ AI ใหม่ (อาจใช้เวลาสักครู่)\n\nยืนยันการเทรน AI หรือไม่?", "Train AI Model"))) return;
    
    showLoader("กำลังประมวลผล Feature Extraction (ResNet18)...");
    try {
        const res = await fetchWithAuth("/api/ai/train", { method: "POST" });
        const data = await res.json();
        
        if (data.status === "success") {
            await customAlert(`🎉 AI เทรนเสร็จสิ้น!\nเรียนรู้และจดจำชิ้นส่วนไปทั้งหมด ${data.trained_items} รูป`, "success");
        } else {
            await customAlert(`Error: ${data.message}`, "error");
        }
    } catch (e) {
        await customAlert("ไม่สามารถเชื่อมต่อระบบ AI ได้", "error");
    } finally {
        hideLoader();
    }
};