(function(){
  "use strict";

  // ---------- КОНФИГУРАЦИЯ ----------
  // Хеш из config.js (если есть), иначе null
  let ADMIN_PASSWORD_HASH = typeof window.ADMIN_PASSWORD_HASH !== 'undefined' 
    ? window.ADMIN_PASSWORD_HASH 
    : null;
  
  const LOCAL_HASH_KEY = 'classSiteAdminHash';
  const STORAGE_KEY = 'classSiteData_v2';
  const DATA_URL = 'data.json'; // файл с данными в корне репозитория

  // ---------- СОСТОЯНИЕ ----------
  let isAdmin = false;
  let dataLoadedFromServer = false; // флаг, загружены ли данные с сервера

  // Стартовая заглушка (будет перезаписана при загрузке)
  let appData = {
    students: [],
    news: [],
    events: [],
    tests: [],
    photos: [],
    about: {
      teacher: '',
      studentsCount: '',
      profile: '',
      motto: '',
      achievements: []
    }
  };

  // ---------- ЗАГРУЗКА ДАННЫХ ----------
  async function loadData() {
    // 1. Пробуем загрузить с сервера (data.json)
    try {
      const response = await fetch(DATA_URL);
      if (response.ok) {
        const serverData = await response.json();
        // Объединяем с дефолтными полями about, если их нет
        appData = {
          students: serverData.students || [],
          news: serverData.news || [],
          events: serverData.events || [],
          tests: serverData.tests || [],
          photos: serverData.photos || [],
          about: { ...appData.about, ...(serverData.about || {}) }
        };
        dataLoadedFromServer = true;
        console.log('✅ Данные загружены с сервера');
      }
    } catch (e) {
      console.warn('⚠️ Не удалось загрузить data.json, используем localStorage');
    }

    // 2. Если с сервера не загрузили – берём из localStorage
    if (!dataLoadedFromServer) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          appData = JSON.parse(saved);
        } catch(e) {}
      }
    }

    // 3. Сохраняем в localStorage для резерва и офлайн-доступа
    saveDataToLocal();
  }

  function saveDataToLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }

  // Вызывается после любого изменения данных (добавление/удаление/редактирование)
  function afterDataChange() {
    saveDataToLocal();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'home';
    renderContent(activeTab);
    if (dataLoadedFromServer && isAdmin) {
      showToast('💾 Изменения сохранены локально. Для публикации на сайте экспортируйте данные и замените файл data.json в репозитории.', 6000);
    } else {
      showToast('Изменения сохранены', 2000);
    }
  }

  // Принудительное обновление данных с сервера (для админа)
  async function refreshFromServer() {
    try {
      const response = await fetch(DATA_URL + '?v=' + Date.now()); // кэш-брейкер
      if (response.ok) {
        const serverData = await response.json();
        appData = {
          students: serverData.students || [],
          news: serverData.news || [],
          events: serverData.events || [],
          tests: serverData.tests || [],
          photos: serverData.photos || [],
          about: { ...appData.about, ...(serverData.about || {}) }
        };
        saveDataToLocal();
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'home';
        renderContent(activeTab);
        showToast('🔄 Данные обновлены с сервера', 2000);
      } else {
        showToast('❌ Не удалось загрузить данные с сервера', 3000);
      }
    } catch(e) {
      showToast('❌ Ошибка соединения', 3000);
    }
  }

  // Утилиты
  function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
  }

  async function hashPassword(pwd) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Лайтбокс для фото
  window.openLightbox = function(src) {
    document.getElementById('lightboxImage').src = src;
    document.getElementById('lightboxModal').classList.add('active');
  };

  window.closeLightbox = function() {
    document.getElementById('lightboxModal').classList.remove('active');
  };

  // ---------- РЕНДЕРИНГ ----------
  function renderContent(tabId) {
    const container = document.getElementById('contentArea');
    container.classList.remove('fade-transition');
    void container.offsetWidth;
    container.classList.add('fade-transition');

    switch(tabId) {
      case 'home': container.innerHTML = renderHome(); break;
      case 'about': container.innerHTML = renderAbout(); break;
      case 'students': container.innerHTML = renderStudents(); break;
      case 'events': container.innerHTML = renderEvents(); break;
      case 'tests': container.innerHTML = renderTests(); break;
      case 'gallery': container.innerHTML = renderGallery(); break;
    }
    attachCardListeners();
    if (tabId === 'students') initStudentControls();
    if (isAdmin) showAdminInlineControls();
  }

  // ---------- ГЛАВНАЯ ----------
  function renderHome() {
    const latestEvents = [...appData.events].reverse().slice(0, 3);
    const eventsHtml = latestEvents.map(e => `
      <div class="event-item">
        <strong>${e.date}</strong> — ${e.title}<br><small>${e.desc}</small>
      </div>
    `).join('') || '<p>Пока нет мероприятий</p>';

    const latestPhotos = [...appData.photos].reverse().slice(0, 3);
    const photosHtml = latestPhotos.map(p => `<img src="${p}" class="photo-thumb" alt="фото" onclick="window.openLightbox('${p}')">`).join('') || '<p>Нет фотографий</p>';

    const latestNews = [...appData.news].reverse().slice(0, 4);
    const newsHtml = latestNews.map(n => `
      <div class="news-item">
        <div class="news-date">${n.date}</div>
        <div>${n.text}</div>
        ${isAdmin ? `<i class="fas fa-trash-alt edit-icon" style="float:right;" onclick="window.deleteNews('${n.date}${n.text}')"></i>` : ''}
      </div>
    `).join('') || '<p>Пока новостей нет</p>';

    return `
      <div class="home-layout">
        <div>
          <div class="info-card">
            <h2 class="section-title"><i class="fas fa-graduation-cap"></i> Добро пожаловать!</h2>
            <p style="font-size:1.2rem; margin:16px 0 8px;">🎓 МАОУ СОШ №13 с углублённым изучением отдельных предметов</p>
            <p>Дружный, активный 6М класс. Мы учимся, дружим и достигаем новых высот вместе!</p>
            <div style="margin-top:20px;"><i class="fas fa-map-pin"></i> г. Электросталь, ул. Тевосяна, 23</div>
          </div>
          <div class="info-card">
            <h3><i class="fas fa-calendar-alt"></i> Ближайшие мероприятия</h3>
            <div class="event-preview">${eventsHtml}</div>
          </div>
          <div class="info-card">
            <h3><i class="fas fa-camera-retro"></i> Последние фотографии</h3>
            <div class="photo-strip">${photosHtml}</div>
          </div>
          ${isAdmin ? adminPanel() : ''}
        </div>
        <div class="news-sidebar">
          <h3>📰 Последние новости</h3>
          ${newsHtml}
          ${isAdmin ? `<div style="margin-top:16px"><button class="btn" onclick="window.addNewsPrompt()"><i class="fas fa-plus"></i> Добавить новость</button></div>` : ''}
        </div>
      </div>
    `;
  }

  function adminPanel() {
    return `<div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap;">
      <button class="btn" onclick="window.showDataModal()"><i class="fas fa-database"></i> Управление данными</button>
      <button class="btn" onclick="window.refreshFromServer()"><i class="fas fa-sync-alt"></i> Обновить с сервера</button>
    </div>`;
  }

  // ---------- О КЛАССЕ ----------
  function renderAbout() {
    const achievementsHtml = appData.about.achievements.map(a => `<li>${a}</li>`).join('');
    return `
      <h2 class="section-title">📚 О нашем классе</h2>
      <div class="about-grid">
        <div class="about-card">
          <h3><i class="fas fa-chalkboard-teacher"></i> Классный руководитель</h3>
          <p>${appData.about.teacher}</p>
          <h3 style="margin-top:20px;"><i class="fas fa-users"></i> 6М класс</h3>
          <p>Количество учеников: ${appData.about.studentsCount}</p>
          <p>Профиль: ${appData.about.profile}</p>
          <p>Девиз: ${appData.about.motto}</p>
        </div>
        <div class="about-card">
          <h3><i class="fas fa-trophy"></i> Достижения</h3>
          <ul style="margin-left:20px;">${achievementsHtml}</ul>
          ${isAdmin ? `<button class="btn" style="margin-top:16px;" onclick="window.editAboutPrompt()"><i class="fas fa-edit"></i> Редактировать</button>` : ''}
        </div>
      </div>
    `;
  }

  // ---------- УЧЕНИКИ ----------
  let currentStudentFilter = '';
  let currentSort = 'name';

  function renderStudents() {
    let filtered = appData.students.filter(s => s.name.toLowerCase().includes(currentStudentFilter.toLowerCase()));
    if (currentSort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name));
    const cards = filtered.map((s, idx) => `
      <div class="student-card" data-student-id="${s.id}" style="--i:${idx}">
        <img src="${s.photo}" class="student-avatar" alt="${s.name}">
        <h3>${s.name}</h3>
        <p>${s.desc.substring(0,40)}${s.desc.length>40?'…':''}</p>
        ${isAdmin ? `<i class="fas fa-pen edit-icon" onclick="event.stopPropagation(); window.editStudentPrompt('${s.id}')"></i>` : ''}
      </div>
    `).join('');
    return `
      <h2 class="section-title">👥 Ученики 6М</h2>
      <div class="students-controls">
        <input type="text" class="search-box" id="studentSearch" placeholder="🔍 Поиск по имени..." value="${currentStudentFilter}">
        <select class="sort-select" id="studentSort">
          <option value="name" ${currentSort==='name'?'selected':''}>По имени</option>
        </select>
        ${isAdmin ? `<button class="btn" onclick="window.addStudentPrompt()"><i class="fas fa-user-plus"></i> Добавить</button>` : ''}
      </div>
      <div class="students-grid">${cards || '<p>Ученики не найдены</p>'}</div>
    `;
  }

  function initStudentControls() {
    document.getElementById('studentSearch')?.addEventListener('input', (e) => {
      currentStudentFilter = e.target.value;
      renderContent('students');
    });
    document.getElementById('studentSort')?.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderContent('students');
    });
  }

  // ---------- МЕРОПРИЯТИЯ ----------
  function renderEvents() {
    const items = appData.events.map(e => `
      <div style="background:white; border-radius:20px; padding:16px; margin-bottom:12px;">
        <strong>${e.date}</strong> — ${e.title}<br><small>${e.desc}</small>
        ${isAdmin ? `<i class="fas fa-trash-alt edit-icon" style="float:right;" onclick="window.deleteEventPrompt('${e.date}${e.title}')"></i>` : ''}
      </div>
    `).join('');
    return `
      <h2 class="section-title">📅 Мероприятия</h2>
      ${isAdmin ? `<button class="btn" onclick="window.addEventPrompt()"><i class="fas fa-plus"></i> Добавить</button>` : ''}
      <div style="margin-top:20px;">${items || 'Пока нет мероприятий'}</div>
    `;
  }

  // ---------- КОНТРОЛЬНЫЕ ----------
  function renderTests() {
    const items = appData.tests.map(t => `
      <div style="background:white; border-radius:20px; padding:16px; margin-bottom:12px;">
        <strong>${t.date}</strong> — ${t.subject}: ${t.topic}
        ${isAdmin ? `<i class="fas fa-trash-alt edit-icon" style="float:right;" onclick="window.deleteTestPrompt('${t.date}${t.subject}')"></i>` : ''}
      </div>
    `).join('');
    return `
      <h2 class="section-title">📝 Контрольные работы</h2>
      ${isAdmin ? `<button class="btn" onclick="window.addTestPrompt()"><i class="fas fa-plus"></i> Добавить</button>` : ''}
      <div style="margin-top:20px;">${items || 'Контрольных пока нет'}</div>
    `;
  }

  // ---------- ФОТОАЛЬБОМ ----------
  function renderGallery() {
    const imgs = appData.photos.map((p, i) => `
      <div style="position:relative;">
        <img src="${p}" style="width:180px; height:140px; object-fit:cover; border-radius:24px; margin:6px; cursor:pointer;" onclick="window.openLightbox('${p}')">
        ${isAdmin ? `<i class="fas fa-times-circle" style="position:absolute; top:10px; right:10px; color:red; cursor:pointer;" onclick="event.stopPropagation(); window.deletePhoto(${i})"></i>` : ''}
      </div>
    `).join('');
    return `
      <h2 class="section-title">🖼️ Фотоальбом</h2>
      ${isAdmin ? `<button class="btn" onclick="window.addPhotoPrompt()"><i class="fas fa-plus"></i> Добавить фото</button>` : ''}
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:20px;">${imgs || 'Нет фотографий'}</div>
    `;
  }

  // ---------- МОДАЛЬНОЕ ОКНО УЧЕНИКА ----------
  function openStudentModal(studentId) {
    const student = appData.students.find(s => s.id === studentId);
    if(!student) return;
    document.getElementById('modalAvatar').src = student.photo;
    document.getElementById('modalName').innerText = student.name;
    document.getElementById('modalDesc').innerText = student.desc;
    const adminDiv = document.getElementById('modalAdminActions');
    if(isAdmin) {
      adminDiv.innerHTML = `
        <button class="btn" onclick="window.editStudentPrompt('${student.id}'); window.closeModal();"><i class="fas fa-edit"></i> Редактировать</button>
        <button class="btn" onclick="window.deleteStudentPrompt('${student.id}'); window.closeModal();"><i class="fas fa-trash"></i> Удалить</button>
      `;
    } else adminDiv.innerHTML = '';
    document.getElementById('studentModal').classList.add('active');
  }

  window.closeModal = () => document.getElementById('studentModal').classList.remove('active');
  window.closeDataModal = () => document.getElementById('dataModal').classList.remove('active');
  window.showDataModal = () => document.getElementById('dataModal').classList.add('active');

  function attachCardListeners() {
    document.querySelectorAll('.student-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if(e.target.closest('.edit-icon')) return;
        openStudentModal(card.dataset.studentId);
      });
    });
  }

  // ---------- АДМИН-ФУНКЦИИ (редактирование данных) ----------
  window.editAboutPrompt = function() {
    const newTeacher = prompt('Классный руководитель:', appData.about.teacher);
    if (newTeacher) appData.about.teacher = newTeacher;
    const newCount = prompt('Количество учеников:', appData.about.studentsCount);
    if (newCount) appData.about.studentsCount = newCount;
    const newProfile = prompt('Профиль:', appData.about.profile);
    if (newProfile) appData.about.profile = newProfile;
    const newMotto = prompt('Девиз:', appData.about.motto);
    if (newMotto) appData.about.motto = newMotto;
    const newAchievements = prompt('Достижения (через запятую):', appData.about.achievements.join(', '));
    if (newAchievements) appData.about.achievements = newAchievements.split(',').map(s => s.trim());
    afterDataChange();
  };

  window.addStudentPrompt = function() {
    const name = prompt('Имя ученика:');
    if(!name) return;
    const desc = prompt('Описание:') || '';
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          appData.students.push({ id: Date.now().toString(), name, desc, photo: ev.target.result });
          afterDataChange();
        };
        reader.readAsDataURL(file);
      } else {
        appData.students.push({ id: Date.now().toString(), name, desc, photo: 'https://i.pravatar.cc/200?img=7' });
        afterDataChange();
      }
    };
    photoInput.click();
  };

  window.editStudentPrompt = function(id) {
    const student = appData.students.find(s => s.id === id);
    if(!student) return;
    const newName = prompt('Новое имя:', student.name);
    if(newName) student.name = newName;
    const newDesc = prompt('Описание:', student.desc);
    if(newDesc) student.desc = newDesc;
    const changePhoto = confirm('Изменить фото?');
    if (changePhoto) {
      const photoInput = document.createElement('input');
      photoInput.type = 'file';
      photoInput.accept = 'image/*';
      photoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            student.photo = ev.target.result;
            afterDataChange();
          };
          reader.readAsDataURL(file);
        }
      };
      photoInput.click();
    } else {
      afterDataChange();
    }
  };

  window.deleteStudentPrompt = function(id) {
    if(confirm('Удалить ученика?')) {
      appData.students = appData.students.filter(s => s.id !== id);
      afterDataChange();
    }
  };

  window.addNewsPrompt = function() {
    const text = prompt('Текст новости:');
    if(!text) return;
    appData.news.unshift({ date: new Date().toISOString().slice(0,10), text });
    afterDataChange();
  };

  window.deleteNews = function(composite) {
    if(confirm('Удалить новость?')) {
      appData.news = appData.news.filter(n => (n.date+n.text) !== composite);
      afterDataChange();
    }
  };

  window.addEventPrompt = function() {
    const date = prompt('Дата (ГГГГ-ММ-ДД):');
    const title = prompt('Название:');
    const desc = prompt('Описание:');
    if(date && title) {
      appData.events.push({date,title,desc});
      afterDataChange();
    }
  };

  window.deleteEventPrompt = function(composite) {
    if(confirm('Удалить мероприятие?')) {
      appData.events = appData.events.filter(e => (e.date+e.title) !== composite);
      afterDataChange();
    }
  };

  window.addTestPrompt = function() {
    const date = prompt('Дата (ГГГГ-ММ-ДД):');
    const subject = prompt('Предмет:');
    const topic = prompt('Тема:');
    if(date && subject) {
      appData.tests.push({date,subject,topic});
      afterDataChange();
    }
  };

  window.deleteTestPrompt = function(composite) {
    if(confirm('Удалить контрольную?')) {
      appData.tests = appData.tests.filter(t => (t.date+t.subject) !== composite);
      afterDataChange();
    }
  };

  window.addPhotoPrompt = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      let loaded = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          appData.photos.push(ev.target.result);
          loaded++;
          if(loaded === files.length) {
            afterDataChange();
          }
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  };

  window.deletePhoto = function(index) {
    if(confirm('Удалить фото?')) {
      appData.photos.splice(index, 1);
      afterDataChange();
    }
  };

  // Экспорт/импорт
  function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Резервная копия скачана. Замените этим файлом data.json в репозитории.', 5000);
  }

  function importData(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        appData = {
          students: imported.students || [],
          news: imported.news || [],
          events: imported.events || [],
          tests: imported.tests || [],
          photos: imported.photos || [],
          about: { ...appData.about, ...(imported.about || {}) }
        };
        afterDataChange();
        closeDataModal();
        showToast('Данные импортированы. Не забудьте экспортировать и заменить data.json в репозитории.', 5000);
      } catch(ex) {
        alert('Ошибка: неверный формат файла');
      }
    };
    reader.readAsText(file);
  }

  // ---------- АВТОРИЗАЦИЯ ----------
  async function getAdminHash() {
    if (ADMIN_PASSWORD_HASH) return ADMIN_PASSWORD_HASH;
    let savedHash = localStorage.getItem(LOCAL_HASH_KEY);
    if (savedHash) return savedHash;
    const pass = prompt('🔐 Первый вход. Придумайте пароль администратора:');
    if (!pass) return null;
    const newHash = await hashPassword(pass);
    localStorage.setItem(LOCAL_HASH_KEY, newHash);
    showToast('Пароль администратора установлен', 2000);
    return newHash;
  }

  async function loginAdmin() {
    const currentHash = await getAdminHash();
    if (!currentHash) {
      alert('Не удалось установить пароль.');
      return;
    }
    const pass = prompt('Введите пароль администратора:');
    if (!pass) return;
    const hash = await hashPassword(pass);
    if (hash === currentHash) {
      isAdmin = true;
      showAdminInlineControls();
      const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'home';
      renderContent(activeTab);
      showToast('Вы вошли как администратор', 2000);
    } else {
      alert('Неверный пароль');
    }
  }

  window.resetAdminPassword = function() {
    if (!isAdmin) {
      alert('Только администратор может сбросить пароль.');
      return;
    }
    if (confirm('Сбросить пароль администратора? После этого потребуется установить новый.')) {
      localStorage.removeItem(LOCAL_HASH_KEY);
      ADMIN_PASSWORD_HASH = null;
      alert('Пароль сброшен.');
    }
  };

  function logoutAdmin() {
    isAdmin = false;
    hideAdminControls();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'home';
    renderContent(activeTab);
    showToast('Вы вышли из режима администратора', 2000);
  }

  function showAdminInlineControls() {
    document.getElementById('adminBadge').style.display = 'inline-block';
    document.getElementById('adminLogoutBtn').classList.remove('hidden');
    document.getElementById('adminLoginBtn').classList.add('hidden');
  }

  function hideAdminControls() {
    document.getElementById('adminBadge').style.display = 'none';
    document.getElementById('adminLogoutBtn').classList.add('hidden');
    document.getElementById('adminLoginBtn').classList.remove('hidden');
  }

  // Переключение вкладок
  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    renderContent(tabId);
  }

  // Инициализация
  async function init() {
    await loadData();
    renderContent('home');
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('adminLoginBtn').addEventListener('click', loginAdmin);
    document.getElementById('adminLogoutBtn').addEventListener('click', logoutAdmin);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importFileInput').addEventListener('change', importData);
    document.getElementById('lightboxModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('lightboxModal')) closeLightbox();
    });

    // Глобальная функция для кнопки "Обновить с сервера"
    window.refreshFromServer = refreshFromServer;
  }

  init();
})();
